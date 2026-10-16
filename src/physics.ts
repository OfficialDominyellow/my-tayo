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

  // 조향 및 구동 제어 파라미터 (부드러운 조향 및 파워핸들 자동 복원)
  public currentSteer = 0;
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
      .setFriction(1.4);
    this.world.createCollider(groundDesc);
  }

  // 박스형 장애물/건물/보도턱 콜라이더 추가
  public addBoxCollider(x: number, y: number, z: number, halfW: number, halfH: number, halfD: number): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;
    const desc = this.rapier.ColliderDesc.cuboid(halfW, halfH, halfD)
      .setTranslation(x, y, z)
      .setFriction(0.8)
      .setRestitution(0.2); // 과하지 않은 안정적인 탄성
    return this.world.createCollider(desc);
  }

  // 원기둥(나무/가로등) 콜라이더 추가
  public addCylinderCollider(x: number, y: number, z: number, radius: number, halfH: number): RAPIER.Collider | null {
    if (!this.world || !this.rapier) return null;
    const desc = this.rapier.ColliderDesc.cylinder(halfH, radius)
      .setTranslation(x, y, z)
      .setFriction(0.7)
      .setRestitution(0.3);
    return this.world.createCollider(desc);
  }

  // 완만한 경사로(Ramp) 콜라이더 추가
  public addRamp(x: number, y: number, z: number, width: number, height: number, length: number, rotY: number = 0): void {
    if (!this.world || !this.rapier) return;

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

  // 차량 생성 (바퀴 분리 방지 및 안정된 차체 리지드바디)
  public createVehicle(x: number, y: number, z: number, headingRad: number = 0): void {
    if (!this.world || !this.rapier) return;

    // 1. 차체 리지드바디 생성
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingRad);
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(0.65)
      .setAngularDamping(3.2); // 팽이 회전 및 롤링 방지
    this.chassisBody = this.world.createRigidBody(bodyDesc);

    // 2. 차체 콜라이더 (반너비 0.96, 반높이 0.88, 반길이 1.72)
    const colDesc = this.rapier.ColliderDesc.cuboid(0.96, 0.88, 1.72)
      .setMass(950)
      .setFriction(0.4)
      .setRestitution(0.25);
    this.chassisCollider = this.world.createCollider(colDesc, this.chassisBody);

    // 3. 차체 무게중심을 낮춤 (CoM Y = -0.58m) -> 급커브 시에도 안정적인 접지력
    this.chassisBody.setAdditionalMassProperties(
      0,
      { x: 0.0, y: -0.58, z: 0.0 },
      { x: 1000, y: 1600, z: 1000 },
      { w: 1, x: 0, y: 0, z: 0 },
      true
    );

    // 4. Rapier Vehicle Controller 생성
    this.vehicle = this.world.createVehicleController(this.chassisBody);
    this.vehicle.setIndexForwardAxis = 2; // +Z 전방 축

    // 5. 4개의 바퀴 등록 (서스펜션 유격을 엄격히 제한하여 바퀴 이탈 방지)
    const suspensionRestLength = 0.42;
    const wheelRadius = 0.42;

    this.wheelOffsets.forEach((w, idx) => {
      if (!this.vehicle) return;
      const connectionPoint = { x: w.x, y: w.y, z: w.z };
      const directionCs = { x: 0.0, y: -1.0, z: 0.0 };
      const axleCs = { x: -1.0, y: 0.0, z: 0.0 };

      this.vehicle.addWheel(
        connectionPoint,
        directionCs,
        axleCs,
        suspensionRestLength,
        wheelRadius
      );

      // 서스펜션 탄성 및 댐핑 강화 (바퀴가 튀어 나가거나 분리되지 않도록 꽉 잡아줌)
      this.vehicle.setWheelSuspensionStiffness(idx, 45.0);
      this.vehicle.setWheelSuspensionCompression(idx, 5.0);
      this.vehicle.setWheelSuspensionRelaxation(idx, 5.5);
      this.vehicle.setWheelMaxSuspensionTravel(idx, 0.18); // 최대 유격을 18cm로 좁혀 절대 분리 안 됨!
      this.vehicle.setWheelFrictionSlip(idx, 2.6);
      this.vehicle.setWheelSideFrictionStiffness(idx, 2.4);
    });
  }

  // 4세 키즈 운전 보조 (기본값은 OFF: 아이가 원할 때만 활성화)
  public kidAssistEnabled: boolean = false;
  public kidAssistTarget: THREE.Vector3 | null = null;

  // 고정 시간 간격 물리 시뮬레이션
  public step(frameDelta: number, input: InputState): void {
    if (!this.world || !this.vehicle || !this.chassisBody) return;

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

    // 1. 속도 감응형 최대 조향각 (저속: 0.52 rad (~30도), 고속: 0.25 rad (~14도))
    const speedRatio = Math.min(1.0, speedKmh / 36);
    const maxSteerAtSpeed = 0.52 - speedRatio * 0.27;

    // 조향 제어: 천천히 꺾이고, 손을 떼면 파워핸들이 스르륵 풀리는 감성적 물리
    const steerTurnRate = 2.8; // 초당 라디안 (약 0.35초에 걸쳐 부드럽게 꺾임)
    const baseReturnRate = 2.5; // 정지 시 복원 속도
    const casterReturnBoost = Math.min(speedKmh / 16, 1.8) * 3.2; // 주행 속도가 붙을수록 바퀴가 스스로 정렬되는 캐스터 복원력
    const powerSteerReturnRate = baseReturnRate + casterReturnBoost;

    let targetSteer = 0;
    if (input.left) {
      targetSteer += maxSteerAtSpeed;
    }
    if (input.right) {
      targetSteer -= maxSteerAtSpeed;
    }

    // 4세 운전보조가 켜져 있고 직진 중일 때만 미세한 목표 유도 보조
    if (this.kidAssistEnabled && this.kidAssistTarget && input.forward && !input.left && !input.right) {
      const pos = this.chassisBody.translation();
      const rot = this.chassisBody.rotation();
      const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
      const toTarget = new THREE.Vector3(this.kidAssistTarget.x - pos.x, 0, this.kidAssistTarget.z - pos.z);
      if (toTarget.length() > 6.0) {
        toTarget.normalize();
        const crossY = forwardDir.x * toTarget.z - forwardDir.z * toTarget.x;
        targetSteer = THREE.MathUtils.clamp(-crossY * 0.45, -maxSteerAtSpeed * 0.5, maxSteerAtSpeed * 0.5);
      }
    }

    if (input.left || input.right) {
      // 키를 누르고 있을 때: 부드럽게 목표 각도로 회전
      this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1.0, steerTurnRate * 3.2 * dt);
    } else {
      // 키를 뗐을 때: 파워핸들이 스르륵 풀리듯이 자연스럽게 0으로 복원
      this.currentSteer += (0 - this.currentSteer) * Math.min(1.0, powerSteerReturnRate * dt);
      if (Math.abs(this.currentSteer) < 0.003) {
        this.currentSteer = 0; // 완전한 직진 유지
      }
    }

    this.vehicle.setWheelSteering(0, this.currentSteer); // FL
    this.vehicle.setWheelSteering(1, this.currentSteer); // FR

    // 2. 가속, 후진, 제동 계산
    const maxForwardForce = 1850;
    const maxReverseForce = -1000;
    const brakeForce = 3000;

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
      // 엑셀을 뗐을 때 자연스러운 엔진 브레이크
      if (!input.forward && !input.backward) {
        targetBrake = 190;
      }
    }

    this.currentEngineForce += (targetForce - this.currentEngineForce) * 12.0 * dt;
    this.currentBrake += (targetBrake - this.currentBrake) * 15.0 * dt;

    // 4륜 구동
    for (let i = 0; i < 4; i++) {
      this.vehicle.setWheelEngineForce(i, this.currentEngineForce);
      this.vehicle.setWheelBrake(i, this.currentBrake);
    }

    // 3. 저속 회전 보조 (제자리 및 저속에서 어린이가 막힘 없이 턴할 수 있도록 부드러운 요 토크)
    if (Math.abs(this.currentSteer) > 0.08 && speedKmh < 5.0) {
      const yawAssist = (this.currentSteer > 0 ? 1 : -1) * (input.forward ? 240 : input.backward ? -240 : 160);
      this.chassisBody.applyTorqueImpulse({ x: 0, y: yawAssist * dt, z: 0 }, true);
    }

    // 4. 차량 컨트롤러 및 월드 업데이트
    this.vehicle.updateVehicle(dt);
    this.world.step();
  }

  // 조향 정규화 값 (-1.0 ~ +1.0) 반환 (UI 핸들 연동용)
  public getSteeringRatio(): number {
    const maxSteer = 0.52;
    return THREE.MathUtils.clamp(this.currentSteer / maxSteer, -1.0, 1.0);
  }

  // 핸들 회전 각도 (도, -120도 ~ +120도)
  public getSteeringWheelDegrees(): number {
    return this.getSteeringRatio() * 110;
  }

  // 차체 전복 복구
  public recoverVehicle(): void {
    if (!this.chassisBody || !this.vehicle) return;

    const pos = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();

    const currentQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const euler = new THREE.Euler().setFromQuaternion(currentQuat, 'YXZ');
    const uprightQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);

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

  // 바퀴들의 물리 상태 반환 (서스펜션 유격을 엄격히 클램핑하여 바퀴 분리 원천 차단)
  public getWheelStates(): WheelVisualState[] {
    if (!this.vehicle) return [];
    const states: WheelVisualState[] = [];

    for (let i = 0; i < 4; i++) {
      const rawSusp = this.vehicle.wheelSuspensionLength(i) ?? 0.42;
      // 0.38m ~ 0.46m 사이로 안전하게 클램핑 (바퀴가 휀더 아치 안에서만 움직임)
      const clampedSusp = THREE.MathUtils.clamp(rawSusp, 0.38, 0.46);
      const isContact = this.vehicle.wheelIsInContact(i) ?? true;
      const rotation = this.vehicle.wheelRotation(i) ?? 0;
      const offset = this.wheelOffsets[i];

      states.push({
        position: new THREE.Vector3(offset.x, offset.y - clampedSusp, offset.z),
        rotation: rotation,
        steering: offset.isFront ? this.currentSteer : 0,
        isInContact: isContact,
        suspensionLength: clampedSusp
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
