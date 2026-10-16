import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { InputState } from './types';

export interface WheelVisualState {
  position: THREE.Vector3;
  rotation: number;
  steering: number;
  isInContact: boolean;
  suspensionLength: number;
}

export class PhysicsEngine {
  public rapier: typeof RAPIER | null = null;
  public world: RAPIER.World | null = null;
  public vehicle: RAPIER.DynamicRayCastVehicleController | null = null;
  public chassisBody: RAPIER.RigidBody | null = null;
  public chassisCollider: RAPIER.Collider | null = null;

  // 고정 시간 간격 물리 루프 (1/60초 = 약 16.67ms)
  public readonly fixedTimeStep = 1 / 60;
  private accumulator = 0;
  public physicsStepTimeMs = 0;

  // 조향 및 구동 제어 파라미터
  private currentSteer = 0;
  private currentEngineForce = 0;
  private currentBrake = 0;

  // 휠 인덱스: 0=FL, 1=FR, 2=RL, 3=RR
  private readonly wheelOffsets = [
    { x: -0.98, y: -0.42, z: 1.05, isFront: true },  // FL
    { x: 0.98, y: -0.42, z: 1.05, isFront: true },   // FR
    { x: -0.98, y: -0.42, z: -1.05, isFront: false }, // RL
    { x: 0.98, y: -0.42, z: -1.05, isFront: false }  // RR
  ];

  public async init(): Promise<void> {
    await RAPIER.init();
    this.rapier = RAPIER;
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
  }

  // 지면 콜라이더 추가 (아스팔트 바닥)
  public addGround(width: number, length: number): void {
    if (!this.world || !this.rapier) return;
    const groundDesc = this.rapier.ColliderDesc.cuboid(width / 2, 0.5, length / 2)
      .setTranslation(0, -0.5, 0)
      .setFriction(1.2);
    this.world.createCollider(groundDesc);
  }

  // 박스형 장애물/건물 콜라이더 추가
  public addBoxCollider(x: number, y: number, z: number, halfW: number, halfH: number, halfD: number): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;
    const desc = this.rapier.ColliderDesc.cuboid(halfW, halfH, halfD)
      .setTranslation(x, y, z)
      .setFriction(0.6)
      .setRestitution(0.3); // 통~ 튕기는 탄성
    return this.world.createCollider(desc);
  }

  // 원기둥(나무/가로등) 콜라이더 추가
  public addCylinderCollider(x: number, y: number, z: number, radius: number, halfH: number): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;
    const desc = this.rapier.ColliderDesc.cylinder(halfH, radius)
      .setTranslation(x, y, z)
      .setFriction(0.6)
      .setRestitution(0.4);
    return this.world.createCollider(desc);
  }

  // 테스트용 완만한 경사로(Ramp) 콜라이더 추가
  public addRamp(x: number, y: number, z: number, width: number, height: number, length: number, rotY: number = 0): void {
    if (!this.world || !this.rapier) return;

    // 회전된 얇은 경사 상판 콜라이더
    const angleX = Math.atan2(height, length);
    const rampLength = Math.sqrt(length * length + height * height);

    const rot = new THREE.Quaternion();
    const euler = new THREE.Euler(angleX, rotY, 0, 'YXZ');
    rot.setFromEuler(euler);

    const desc = this.rapier.ColliderDesc.cuboid(width / 2, 0.25, rampLength / 2)
      .setTranslation(x, y + height / 2, z)
      .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
      .setFriction(1.4);
    this.world.createCollider(desc);
  }

  // 차량 생성 (Rapier VehicleController 탑재)
  public createVehicle(x: number, y: number, z: number, headingRad: number = 0): void {
    if (!this.world || !this.rapier) return;

    // 1. 차체 리지드바디 생성
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(0.6)
      .setAngularDamping(2.8); // 팽이처럼 빙글빙글 도는 현상 방지
    this.chassisBody = this.world.createRigidBody(bodyDesc);

    // 2. 차체 콜라이더 (반너비 0.95, 반높이 0.9, 반길이 1.7)
    // 차체 무게를 900kg으로 설정
    const colDesc = this.rapier.ColliderDesc.cuboid(0.95, 0.88, 1.7)
      .setMass(900)
      .setFriction(0.4)
      .setRestitution(0.3);
    this.chassisCollider = this.world.createCollider(colDesc, this.chassisBody);

    // 3. 차체 무게중심을 대폭 낮춤 (CoM Y = -0.55m) -> 5세 아이의 급회전 시에도 전복 방지!
    this.chassisBody.setAdditionalMassProperties(
      0, // 추가 질량 0 (콜라이더 질량 유지)
      { x: 0.0, y: -0.55, z: 0.0 }, // 무게중심을 바닥 쪽으로 대폭 하향
      { x: 900, y: 1500, z: 900 }, // 회전 관성 모멘트
      { w: 1, x: 0, y: 0, z: 0 },
      true
    );

    // 4. Rapier Vehicle Controller 생성
    this.vehicle = this.world.createVehicleController(this.chassisBody);
    // 전방 축을 Z축(+Z)으로 설정
    this.vehicle.setIndexForwardAxis = 2;

    // 5. 4개의 바퀴 등록
    const suspensionRestLength = 0.45;
    const wheelRadius = 0.42;

    this.wheelOffsets.forEach((w, idx) => {
      if (!this.vehicle) return;
      const connectionPoint = { x: w.x, y: w.y, z: w.z };
      const directionCs = { x: 0.0, y: -1.0, z: 0.0 }; // 아래 방향
      const axleCs = { x: -1.0, y: 0.0, z: 0.0 };      // 좌측 방향

      this.vehicle.addWheel(
        connectionPoint,
        directionCs,
        axleCs,
        suspensionRestLength,
        wheelRadius
      );

      // 서스펜션 및 접지력 튜닝 (안정적이고 부드러운 승차감)
      this.vehicle.setWheelSuspensionStiffness(idx, 38.0);
      this.vehicle.setWheelSuspensionCompression(idx, 4.2);
      this.vehicle.setWheelSuspensionRelaxation(idx, 4.6);
      this.vehicle.setWheelMaxSuspensionTravel(idx, 0.35);
      this.vehicle.setWheelFrictionSlip(idx, 2.2); // 미끄러짐 방지 마찰력
      this.vehicle.setWheelSideFrictionStiffness(idx, 2.0);
    });
  }

  // 4세 키즈 운전 보조 (목적지 방향 부드러운 자동 조향 보조)
  public kidAssistEnabled: boolean = true;
  public kidAssistTarget: THREE.Vector3 | null = null;

  // 고정 시간 간격 물리 시뮬레이션 및 제어
  public step(frameDelta: number, input: InputState): void {
    if (!this.world || !this.vehicle || !this.chassisBody) return;

    // 프레임 델타 누적 (렌더링 프레임과 물리 업데이트 완전 분리)
    this.accumulator += Math.min(frameDelta, 0.1);

    const tStart = performance.now();

    while (this.accumulator >= this.fixedTimeStep) {
      this.fixedUpdate(input, this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
    }

    this.physicsStepTimeMs = performance.now() - tStart;
  }

  private fixedUpdate(input: InputState, dt: number): void {
    if (!this.vehicle || !this.chassisBody || !this.world) return;

    const speedKmh = Math.abs(this.vehicle.currentVehicleSpeed() * 3.6);

    // 1. 속도 감응형 조향각 제한 (저속: 0.54 rad (~31도), 고속: 0.24 rad (~14도))
    const speedRatio = Math.min(1.0, speedKmh / 35);
    const maxSteerAtSpeed = 0.54 - speedRatio * 0.28;

    let targetSteer = 0;
    if (input.left) targetSteer += maxSteerAtSpeed;
    if (input.right) targetSteer -= maxSteerAtSpeed;

    // 4세 운전 보조: 아이가 전진만 누르고 있을 때 목적지 방향으로 핸들을 부드럽게 보조해 줌
    if (
      this.kidAssistEnabled &&
      this.kidAssistTarget &&
      input.forward &&
      !input.left &&
      !input.right
    ) {
      const pos = this.chassisBody.translation();
      const rot = this.chassisBody.rotation();
      const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
      const toTarget = new THREE.Vector3(this.kidAssistTarget.x - pos.x, 0, this.kidAssistTarget.z - pos.z);
      if (toTarget.length() > 5.0) {
        toTarget.normalize();
        const crossY = forwardDir.x * toTarget.z - forwardDir.z * toTarget.x;
        targetSteer = THREE.MathUtils.clamp(-crossY * 0.55, -maxSteerAtSpeed * 0.65, maxSteerAtSpeed * 0.65);
      }
    }

    // 부드러운 핸들 조작 응답 (러프하지 않고 자연스러움)
    const steerRate = 8.5 * dt;
    this.currentSteer += (targetSteer - this.currentSteer) * steerRate;

    this.vehicle.setWheelSteering(0, this.currentSteer); // FL
    this.vehicle.setWheelSteering(1, this.currentSteer); // FR

    // 2. 가속, 후진, 제동 계산
    const maxForwardForce = 1750;
    const maxReverseForce = -950;
    const brakeForce = 2800;

    let targetForce = 0;
    let targetBrake = 0;

    if (input.brake) {
      targetBrake = brakeForce;
      targetForce = 0;
    } else {
      if (input.forward) {
        targetForce += maxForwardForce;
      }
      if (input.backward) {
        targetForce += maxReverseForce;
      }
      // 엑셀을 뗐을 때 자연스러운 엔진 브레이크 감속
      if (!input.forward && !input.backward) {
        targetBrake = 180;
      }
    }

    // 부드러운 가속 페달 전환
    this.currentEngineForce += (targetForce - this.currentEngineForce) * 12.0 * dt;
    this.currentBrake += (targetBrake - this.currentBrake) * 15.0 * dt;

    // 전륜 및 후륜 4륜 구동으로 언덕/경사로 등판 능력 강화
    for (let i = 0; i < 4; i++) {
      this.vehicle.setWheelEngineForce(i, this.currentEngineForce);
      this.vehicle.setWheelBrake(i, this.currentBrake);
    }

    // 3. 저속 회전 보조 (정지 상태에서 4~5세 어린이가 쉽게 방향을 틀 수 있도록 부드러운 토크 보조)
    if (Math.abs(targetSteer) > 0.05 && speedKmh < 4.5) {
      const yawAssist = (targetSteer > 0 ? 1 : -1) * (input.forward ? 260 : input.backward ? -260 : 190);
      this.chassisBody.applyTorqueImpulse({ x: 0, y: yawAssist * dt, z: 0 }, true);
    }

    // 4. 차량 컨트롤러 및 월드 업데이트
    this.vehicle.updateVehicle(dt);
    this.world.step();
  }

  // 차체 전복 복구 (Unflip / Recovery 기능)
  public recoverVehicle(): void {
    if (!this.chassisBody || !this.vehicle) return;

    const pos = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    // 현재 바라보던 방위각(Yaw)만 유지하고, Roll과 Pitch를 0으로 바로 세움
    const currentQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const euler = new THREE.Euler().setFromQuaternion(currentQuat, 'YXZ');
    const uprightQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);

    // 공중 1.2m 위로 살짝 들어 올려 안전하게 착지하도록 설정
    this.chassisBody.setTranslation({ x: pos.x, y: pos.y + 1.2, z: pos.z }, true);
    this.chassisBody.setRotation({ x: uprightQuat.x, y: uprightQuat.y, z: uprightQuat.z, w: uprightQuat.w }, true);
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.currentSteer = 0;
    this.currentEngineForce = 0;
    this.currentBrake = 0;
    for (let i = 0; i < 4; i++) {
      this.vehicle.setWheelEngineForce(i, 0);
      this.vehicle.setWheelBrake(i, 0);
    }
  }

  // 시각 모델과 동기화를 위한 물리 트랜스폼 반환
  public getChassisTransform(): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    if (!this.chassisBody) {
      return { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    }
    const t = this.chassisBody.translation();
    const r = this.chassisBody.rotation();
    return {
      position: new THREE.Vector3(t.x, t.y, t.z),
      quaternion: new THREE.Quaternion(r.x, r.y, r.z, r.w)
    };
  }

  // 바퀴들의 물리 상태 반환 (서스펜션 길이, 조향각, 회전각)
  public getWheelStates(): WheelVisualState[] {
    if (!this.vehicle) return [];
    const states: WheelVisualState[] = [];

    for (let i = 0; i < 4; i++) {
      const suspensionLength = this.vehicle.wheelSuspensionLength(i) ?? 0.45;
      const isContact = this.vehicle.wheelIsInContact(i) ?? false;
      const rotation = this.vehicle.wheelRotation(i) ?? 0;
      const offset = this.wheelOffsets[i];

      states.push({
        position: new THREE.Vector3(offset.x, offset.y - suspensionLength, offset.z),
        rotation: rotation,
        steering: offset.isFront ? this.currentSteer : 0,
        isInContact: isContact,
        suspensionLength: suspensionLength
      });
    }

    return states;
  }

  // 현재 속도 (km/h)
  public getSpeedKmh(): number {
    if (!this.vehicle) return 0;
    return this.vehicle.currentVehicleSpeed() * 3.6;
  }
}
