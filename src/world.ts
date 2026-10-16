import * as THREE from 'three';
import { PhysicsEngine } from './physics';
import { BusModelFactory } from './bus-model';
import {
  BusStopData,
  CollectibleStar,
  InteractiveZone,
  NpcVehicle,
  TrafficLightData
} from './types';

export class WorldManager {
  private scene: THREE.Scene;
  private physics: PhysicsEngine;

  public busStops: BusStopData[] = [];
  public trafficLights: TrafficLightData[] = [];
  public interactiveZones: InteractiveZone[] = [];
  public stars: CollectibleStar[] = [];
  public npcVehicles: NpcVehicle[] = [];

  // 애니메이션용 3D 오브젝트 참조
  private carWashBrushes: THREE.Object3D[] = [];
  private carWashBubbles: THREE.Mesh[] = [];
  private garageDoors: THREE.Mesh[] = [];
  private ferrisWheel: THREE.Group | null = null;
  private windmillBlades: THREE.Group | null = null;
  private streetLampBulbs: THREE.MeshBasicMaterial[] = [];

  public ballMesh: THREE.Mesh | null = null;
  public ballActive: boolean = false;
  private ballTimer: number = 35;
  private ballVel = new THREE.Vector3();

  constructor(scene: THREE.Scene, physics: PhysicsEngine) {
    this.scene = scene;
    this.physics = physics;
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);

    // 아스팔트 질감 노이즈
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 120; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
    }

    // 중앙 노란색 점선
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 14;
    ctx.setLineDash([48, 36]);
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();

    // 양쪽 흰색 차선 및 보도블럭 경계
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(32, 512);
    ctx.moveTo(480, 0);
    ctx.lineTo(480, 512);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createCrosswalkTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#FFFFFF';
    const barHeight = 28;
    const gap = 20;
    for (let y = 10; y < 256; y += barHeight + gap) {
      ctx.fillRect(20, y, 216, barHeight);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createSignBannerTexture(text: string, bgColor: string, textColor: string = '#FFFFFF'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 116, 28);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '900 50px "Nanum Gothic", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public generate(): void {
    // 1. 대폭 확장된 잔디 지면 (360m x 360m - 기존 대비 4배 이상 넓은 오픈월드!)
    const groundSize = 360;
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x7CB342, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.physics.addGround(groundSize, groundSize);

    // 맵 외곽 안전 울타리 (차가 맵 밖으로 떨어지지 않도록 보호)
    const wallHalf = groundSize / 2 - 4;
    this.physics.addBoxCollider(0, 3, wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(0, 3, -wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(wallHalf, 3, 0, 1, 3, wallHalf);
    this.physics.addBoxCollider(-wallHalf, 3, 0, 1, 3, wallHalf);

    // 2. 확장된 도로망 구축 (중심 대로 + 내부 순환로 ±48 + 외곽 순환 대로 ±108)
    this.buildRoads();

    // 3. 무지개 언덕 전망대 & 경사로 구축
    this.buildTestRamp();

    // 4. 인터랙티브 시설 (타요 차고지, 보글보글 세차장, 에너지 충전소)
    this.buildTayoGarage(-26, 28);
    this.buildCarWash(76, 48);
    this.buildChargingStation(-76, -48);

    // 5. 디테일한 3D 랜드마크 건물들 & 대관람차/풍차
    this.buildLandmarksAndBuildings();

    // 6. 자연 환경 (입체 나무, 구름, 가로등, 꽃밭)
    this.buildNatureAndStreetlights();

    // 7. 중앙 사거리 신호등 설치
    this.buildTrafficLights();

    // 8. 8개의 버스 정류장 설치
    this.buildBusStops();

    // 9. 도로 위 반짝이는 별 코인 배치
    this.buildCollectibleStars();

    // 10. 마을을 순찰하는 친구 차량 (패트, 프랭크, 앨리스)
    this.buildNpcVehicles();

    // 11. 돌발상황 축구공
    this.buildBallHazard();
  }

  private buildRoads(): void {
    const roadTex = this.createRoadTexture();
    const roadWidth = 10.4;

    const createRoadMesh = (x: number, z: number, length: number, isHorizontal: boolean) => {
      const geom = new THREE.PlaneGeometry(isHorizontal ? length : roadWidth, isHorizontal ? roadWidth : length);
      const rTex = roadTex.clone();
      rTex.repeat.set(isHorizontal ? length / roadWidth : 1, isHorizontal ? 1 : length / roadWidth);
      rTex.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.85 });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.02, z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    // 십자 중심 대로 (길이 226m)
    createRoadMesh(0, 0, 226, true);
    createRoadMesh(0, 0, 226, false);

    // 내부 순환도로 (±48m)
    createRoadMesh(0, 48, 226, true);
    createRoadMesh(0, -48, 226, true);
    createRoadMesh(48, 0, 226, false);
    createRoadMesh(-48, 0, 226, false);

    // 외곽 대순환도로 (±108m)
    createRoadMesh(0, 108, 226, true);
    createRoadMesh(0, -108, 226, true);
    createRoadMesh(108, 0, 226, false);
    createRoadMesh(-108, 0, 226, false);

    // 교차로 횡단보도들
    const cwTex = this.createCrosswalkTexture();
    const cwMat = new THREE.MeshStandardMaterial({ map: cwTex, roughness: 0.8 });

    const addCrosswalk = (x: number, z: number, isHorizontal: boolean) => {
      const geom = new THREE.PlaneGeometry(isHorizontal ? 9.8 : 3.8, isHorizontal ? 3.8 : 9.8);
      const mesh = new THREE.Mesh(geom, cwMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.035, z);
      this.scene.add(mesh);
    };

    // 중앙 교차로 및 주요 사거리 횡단보도
    [
      [0, 8.5, true],
      [0, -8.5, true],
      [8.5, 0, false],
      [-8.5, 0, false],
      [48, 56.5, true],
      [-48, -56.5, true]
    ].forEach(([x, z, isH]) => addCrosswalk(x as number, z as number, isH as boolean));
  }

  /**
   * 1. 타요 4총사 아치형 차고지 (가까이 가면 문이 스르륵 열리는 인터랙티브 존!)
   */
  private buildTayoGarage(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const width = 20;
    const depth = 11;
    const height = 6.2;

    // 차고지 앞마당 콘크리트 바닥
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.85 })
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set(0, 0.015, 3);
    yard.receiveShadow = true;
    group.add(yard);

    // 본체 건물
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0xFFFBEB, roughness: 0.5 })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 파란색 둥근 아치형 지붕
    const roofGeom = new THREE.CylinderGeometry(depth * 0.55, depth * 0.55, width + 0.8, 20, 1, false, 0, Math.PI);
    roofGeom.rotateZ(Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.35 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = height;
    roof.scale.y = 0.45;
    roof.castShadow = true;
    group.add(roof);

    // 4개의 베이 (120 타요, 1000 로기, 02 라니, 1339 가니) + 개폐형 셔터 도어
    const bays = [
      { num: '120', color: '#0080EE', xOffset: -6.9 },
      { num: '1000', color: '#46B81D', xOffset: -2.3 },
      { num: '02', color: '#FFCC00', xOffset: 2.3 },
      { num: '1339', color: '#E22B24', xOffset: 6.9 }
    ];

    bays.forEach(bay => {
      // 안쪽 어두운 차고 내부 공간 표현
      const interior = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 4.2),
        new THREE.MeshBasicMaterial({ color: 0x1E293B })
      );
      interior.position.set(bay.xOffset, 2.1, depth / 2 + 0.02);
      group.add(interior);

      // 슬라이딩 차고 문
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(3.7, 4.1, 0.12),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bay.color), roughness: 0.35 })
      );
      door.position.set(bay.xOffset, 2.1, depth / 2 + 0.08);
      group.add(door);
      this.garageDoors.push(door);

      // 노선 번호 뱃지 간판
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.9),
        new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture(bay.num, bay.color) })
      );
      sign.position.set(bay.xOffset, 4.9, depth / 2 + 0.12);
      group.add(sign);
    });

    // 상단 대형 간판
    const mainBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 2.2),
      new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture('🚌 꼬마버스 차고지', '#0284C7') })
    );
    mainBanner.position.set(0, height + 2.2, depth / 2);
    group.add(mainBanner);

    this.scene.add(group);
    this.physics.addBoxCollider(x, height / 2, z, width / 2, height / 2, depth / 2);

    this.interactiveZones.push({
      id: 'garage',
      name: '꼬마버스 차고지',
      type: 'garage',
      x: x,
      z: z + 8,
      radius: 9.0,
      cooldown: 0,
      group
    });
  }

  /**
   * 2. 보글보글 자동 세차장 (회전하는 대형 브러쉬 2개 + 비눗방울 파티클!)
   */
  private buildCarWash(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 파란색 방수 바닥 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 16),
      new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.3 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    group.add(pad);

    // 양쪽 세차 터널 벽 기둥 (통과 가능하도록 좌우로만 콜라이더 배치)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xE0F2FE, roughness: 0.3 });
    [-4.2, 4.2].forEach(wx => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.2, 10), wallMat);
      wall.position.set(wx, 2.6, 0);
      wall.castShadow = true;
      group.add(wall);
      this.physics.addBoxCollider(x + wx, 2.6, z, 0.4, 2.6, 5.0);
    });

    // 상단 세차장 아치 지붕 & 간판
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.9, 10.4),
      new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.3 })
    );
    roof.position.set(0, 5.4, 0);
    group.add(roof);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 1.8),
      new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture('🫧 보글보글 세차장', '#0284C7') })
    );
    sign.position.set(0, 6.7, 5.3);
    group.add(sign);

    const signBack = sign.clone();
    signBack.position.z = -5.3;
    signBack.rotation.y = Math.PI;
    group.add(signBack);

    // 회전하는 대형 3D 스펀지 브러쉬 롤러 2쌍
    const brushMat1 = new THREE.MeshStandardMaterial({ color: 0x00B0FF, roughness: 0.6 });
    const brushMat2 = new THREE.MeshStandardMaterial({ color: 0xFFD600, roughness: 0.6 });
    [-2.8, 2.8].forEach((bx, idx) => {
      const brushGroup = new THREE.Group();
      brushGroup.position.set(bx, 2.3, 0);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.0, 12), idx === 0 ? brushMat1 : brushMat2);
      brushGroup.add(cyl);
      group.add(brushGroup);
      this.carWashBrushes.push(brushGroup);
    });

    // 보글보글 비눗방울 구체들
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1
    });
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.25, 12, 12), bubbleMat);
      b.position.set((Math.random() - 0.5) * 6, 0.8 + Math.random() * 3.8, (Math.random() - 0.5) * 8);
      group.add(b);
      this.carWashBubbles.push(b);
    }

    this.scene.add(group);

    this.interactiveZones.push({
      id: 'carwash',
      name: '보글보글 세차장',
      type: 'carwash',
      x,
      z,
      radius: 5.2,
      cooldown: 0,
      group
    });
  }

  /**
   * 3. 에너지 쑥쑥 충전소 / 주유소 (드라이브 스루 충전 패드!)
   */
  private buildChargingStation(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 초록/노란 충전 패드 바닥
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0x4ADE80, roughness: 0.5 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    group.add(pad);

    // 캐노피 기둥 2개 (우측에 배치해 좌측으로 차가 통과)
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC });
    [-3.5, 3.5].forEach(pz => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.4, 12), pillarMat);
      pillar.position.set(3.8, 2.7, pz);
      group.add(pillar);
    });
    this.physics.addBoxCollider(x + 3.8, 2.5, z, 1.0, 2.5, 4.2);

    // 주유기 / 전기 충전기 2대
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x10B981, roughness: 0.3 });
    [-1.6, 1.6].forEach(pz => {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), pumpMat);
      pump.position.set(3.8, 1.1, pz);
      group.add(pump);
    });

    // 상단 캐노피 지붕 & 간판
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.8, 11),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.3 })
    );
    canopy.position.set(1.2, 5.4, 0);
    group.add(canopy);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 1.8),
      new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture('⚡ 싱싱 에너지 충전소', '#059669') })
    );
    sign.position.set(1.2, 6.6, 5.6);
    group.add(sign);

    this.scene.add(group);

    this.interactiveZones.push({
      id: 'station',
      name: '싱싱 에너지 충전소',
      type: 'station',
      x: x - 0.5,
      z,
      radius: 5.5,
      cooldown: 0,
      group
    });
  }

  /**
   * 4. 무지개 언덕 전망대 & 안전 난간 경사로
   */
  private buildTestRamp(): void {
    const rx = 28;
    const rz = -48;
    const rWidth = 9.4;
    const rHeight = 2.6;
    const rLength = 18.0;

    const angleX = Math.atan2(rHeight, rLength);
    const rampLength = Math.sqrt(rLength * rLength + rHeight * rHeight);

    const rampGeom = new THREE.BoxGeometry(rWidth, 0.35, rampLength);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
    const rampMesh = new THREE.Mesh(rampGeom, rampMat);
    rampMesh.position.set(rx, rHeight / 2, rz);
    rampMesh.rotation.x = angleX;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    this.scene.add(rampMesh);

    // 언덕 위 평평한 전망 데크
    const deckGeom = new THREE.BoxGeometry(rWidth, 0.35, 12.0);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.5 });
    const deckMesh = new THREE.Mesh(deckGeom, deckMat);
    deckMesh.position.set(rx, rHeight, rz + rLength / 2 + 6.0);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    this.scene.add(deckMesh);

    // 내려가는 반대쪽 경사로 연결 (양방향 통과 가능한 무지개 육교!)
    const downRampMesh = rampMesh.clone();
    downRampMesh.position.set(rx, rHeight / 2, rz + rLength + 12.0);
    downRampMesh.rotation.x = -angleX;
    this.scene.add(downRampMesh);

    // 물리 콜라이더 등록 (올라가는 경사로 + 상단 데크 + 내려가는 경사로)
    this.physics.addRamp(rx, 0, rz, rWidth, rHeight, rLength, 0);
    this.physics.addBoxCollider(rx, rHeight, rz + rLength / 2 + 6.0, rWidth / 2, 0.18, 6.0);
    this.physics.addRamp(rx, 0, rz + rLength + 12.0, rWidth, rHeight, rLength, Math.PI);
  }

  /**
   * 5. 디테일한 3D 랜드마크 건물들 (유치원, 초등학교, 마트, 소방서, 대관람차, 풍차 등)
   */
  private buildLandmarksAndBuildings(): void {
    const addDetailedBuilding = (
      x: number,
      z: number,
      width: number,
      depth: number,
      height: number,
      color: number,
      roofType: 'school' | 'pitched' | 'flat' | 'mart',
      label?: string,
      labelColor: string = '#1E293B'
    ) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      // 건물 기단(Foundation)
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.6, 0.4, depth + 0.6),
        new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.8 })
      );
      base.position.y = 0.2;
      group.add(base);

      // 건물 본체
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
      const geom = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = height / 2 + 0.4;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // 정면 현관 포치 & 문
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350F });
      const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.2), doorMat);
      door.position.set(0, 1.4, depth / 2 + 0.05);
      group.add(door);

      // 유리 창문들 (앞면과 뒷면 모두 배치)
      const winMat = new THREE.MeshBasicMaterial({ color: 0xBAE6FD });
      const frameMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      const winCols = Math.max(1, Math.floor(width / 2.6));
      const winRows = Math.max(1, Math.floor((height - 1.5) / 2.4));

      for (let r = 0; r < winRows; r++) {
        for (let c = 0; c < winCols; c++) {
          const wx = (c - (winCols - 1) / 2) * 2.2;
          const wy = 3.0 + r * 2.2;
          if (wy > height - 0.5) continue;

          [-1, 1].forEach(side => {
            const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), frameMat);
            frame.position.set(wx, wy, side * (depth / 2 + 0.02));
            if (side === -1) frame.rotation.y = Math.PI;
            group.add(frame);

            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), winMat);
            win.position.set(wx, wy, side * (depth / 2 + 0.03));
            if (side === -1) win.rotation.y = Math.PI;
            group.add(win);
          });
        }
      }

      // 지붕 스타일별 디테일
      if (roofType === 'pitched') {
        const roofGeom = new THREE.ConeGeometry(Math.max(width, depth) * 0.74, 2.8, 4);
        roofGeom.rotateY(Math.PI / 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.5 });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = height + 1.8;
        roof.castShadow = true;
        group.add(roof);
      } else if (roofType === 'school') {
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 3.2, 3.2),
          new THREE.MeshStandardMaterial({ color: 0xFEF08A })
        );
        tower.position.y = height + 2.0;
        group.add(tower);

        const clock = new THREE.Mesh(
          new THREE.CircleGeometry(0.95, 20),
          new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
        );
        clock.position.set(0, height + 2.0, 1.65);
        group.add(clock);
      } else if (roofType === 'mart') {
        // 마트 차양막 (어닝)
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.9, 0.5, 1.8),
          new THREE.MeshStandardMaterial({ color: 0xEC4899 })
        );
        awning.position.set(0, 2.8, depth / 2 + 0.8);
        group.add(awning);

        // 옥상 대형 도넛 조형물
        const donut = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.55, 12, 24),
          new THREE.MeshStandardMaterial({ color: 0xF472B6, roughness: 0.3 })
        );
        donut.position.set(0, height + 2.4, 0);
        group.add(donut);
      }

      // 건물 옥상 간판 배너
      if (label) {
        const banner = new THREE.Mesh(
          new THREE.PlaneGeometry(8.5, 1.8),
          new THREE.MeshBasicMaterial({
            map: this.createSignBannerTexture(label, labelColor),
            side: THREE.DoubleSide
          })
        );
        banner.position.set(0, height + 3.6, 0);
        group.add(banner);
      }

      this.scene.add(group);
      this.physics.addBoxCollider(x, height / 2, z, width / 2, height / 2, depth / 2);
    };

    // 주요 랜드마크 건물 배치
    addDetailedBuilding(-26, -26, 16, 11, 7.0, 0xFDE047, 'school', '🏫 꿈나무 초등학교', '#CA8A04');
    addDetailedBuilding(26, -26, 14, 11, 6.2, 0xF9A8D4, 'pitched', '🌈 무지개 유치원', '#DB2777');
    addDetailedBuilding(26, 26, 13, 11, 6.2, 0x7DD3FC, 'mart', '🛒 달콤 마트', '#0284C7');
    addDetailedBuilding(-76, 26, 15, 11, 7.2, 0xFCA5A5, 'flat', '🚒 용감한 소방서', '#DC2626');
    addDetailedBuilding(76, -26, 14, 11, 7.5, 0xE2E8F0, 'flat', '🏥 튼튼 어린이 병원', '#0D9488');

    // 외곽 마을 주택 단지
    const houseColors = [0xFDBA74, 0xBEF264, 0x93C5FD, 0xF9A8D4, 0xC4B5FD, 0xFDE047];
    const houseCoords = [
      { x: -26, z: -72 }, { x: -72, z: -26 },
      { x: 26, z: 72 }, { x: 72, z: 72 },
      { x: -26, z: 72 }, { x: -72, z: 72 },
      { x: 76, z: -76 }, { x: -76, z: -76 },
      { x: 0, z: 82 }, { x: 0, z: -82 }
    ];
    houseCoords.forEach((p, idx) => {
      addDetailedBuilding(p.x, p.z, 8.2, 8.2, 5.0, houseColors[idx % houseColors.length], 'pitched');
    });

    // 놀이공원 대관람차 (북동쪽 외곽 랜드마크!)
    this.buildFerrisWheel(84, 84);

    // 풍차 마을 대형 풍차 (남서쪽 외곽 랜드마크!)
    this.buildWindmill(-84, -84);
  }

  private buildFerrisWheel(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 지지대 다리 2개
    const legMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.3 });
    [-1.6, 1.6].forEach(lz => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 15, 8), legMat);
      leg.position.set(0, 7.2, lz);
      group.add(leg);
    });

    // 회전하는 관람차 휠
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 14, 0);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.28, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0xEC4899 })
    );
    wheelGroup.add(ring);

    const cabinColors = [0x0080EE, 0x46B81D, 0xFFCC00, 0xE22B24, 0xA855F7, 0xF97316];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      // 스포크
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 19, 6), legMat);
      spoke.rotation.z = angle;
      wheelGroup.add(spoke);

      // 관람차 곤돌라
      const cabin = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 12, 12),
        new THREE.MeshStandardMaterial({ color: cabinColors[i % cabinColors.length] })
      );
      cabin.position.set(Math.cos(angle) * 9.5, Math.sin(angle) * 9.5, 0);
      wheelGroup.add(cabin);
    }

    group.add(wheelGroup);
    this.ferrisWheel = wheelGroup;

    // 놀이공원 간판
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.9),
      new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture('🎡 타요 놀이공원', '#EC4899'), side: THREE.DoubleSide })
    );
    sign.position.set(0, 3.2, 6);
    group.add(sign);

    this.scene.add(group);
    this.physics.addBoxCollider(x, 4, z, 3, 4, 3);
  }

  private buildWindmill(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.6, 13, 12),
      new THREE.MeshStandardMaterial({ color: 0xFEF3C7 })
    );
    tower.position.y = 6.5;
    tower.castShadow = true;
    group.add(tower);

    const dome = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 3.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xB91C1C })
    );
    dome.position.y = 14.5;
    group.add(dome);

    const bladesGroup = new THREE.Group();
    bladesGroup.position.set(0, 11.2, 2.5);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.5, 0.15), bladeMat);
      b.rotation.z = (i * Math.PI) / 2;
      bladesGroup.add(b);
    }
    group.add(bladesGroup);
    this.windmillBlades = bladesGroup;

    this.scene.add(group);
    this.physics.addCylinderCollider(x, 6.5, z, 3.6, 6.5);
  }

  private buildNatureAndStreetlights(): void {
    const addTree = (x: number, z: number, scale = 1.0, isPine = false) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28 * scale, 0.4 * scale, 2.2 * scale, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350F })
      );
      trunk.position.y = 1.1 * scale;
      trunk.castShadow = true;
      group.add(trunk);

      if (isPine) {
        const pineMat = new THREE.MeshStandardMaterial({ color: 0x2E7D32 });
        [0, 1.1, 2.1].forEach((hOffset, idx) => {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry((1.8 - idx * 0.4) * scale, 2.2 * scale, 8),
            pineMat
          );
          cone.position.y = (2.4 + hOffset) * scale;
          cone.castShadow = true;
          group.add(cone);
        });
      } else {
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.7 });
        const mainCrown = new THREE.Mesh(new THREE.SphereGeometry(1.4 * scale, 10, 10), foliageMat);
        mainCrown.position.y = 3.0 * scale;
        mainCrown.castShadow = true;
        group.add(mainCrown);

        const subCrown = new THREE.Mesh(new THREE.SphereGeometry(1.0 * scale, 8, 8), foliageMat);
        subCrown.position.set(0.6 * scale, 2.6 * scale, 0.4 * scale);
        group.add(subCrown);
      }

      this.scene.add(group);
      this.physics.addCylinderCollider(x, 1.1 * scale, z, 0.45 * scale, 1.1 * scale);
    };

    // 가로수 배치
    const treePositions = [
      [-10, 18], [-10, 34], [10, 18], [10, 34],
      [-10, -18], [-10, -34], [10, -18], [10, -34],
      [18, 10], [34, 10], [18, -10], [34, -10],
      [-18, 10], [-34, 10], [-18, -10], [-34, -10],
      [-58, 18], [-58, -18], [58, 18], [58, -18],
      [-18, 58], [18, 58], [-18, -58], [18, -58],
      [-92, 30], [92, 30], [-92, -30], [92, -30],
      [-30, 92], [30, 92], [-30, -92], [30, -92]
    ];
    treePositions.forEach(([tx, tz], idx) => addTree(tx, tz, 1.0 + (idx % 3) * 0.15, idx % 2 === 0));

    // 밤에 켜지는 가로등 배치
    const lampCoords = [
      [-7.2, 22], [7.2, 22], [-7.2, -22], [7.2, -22],
      [22, 7.2], [22, -7.2], [-22, 7.2], [-22, -7.2],
      [-40, 40], [40, 40], [-40, -40], [40, -40],
      [-70, 7.2], [70, 7.2], [7.2, 70], [7.2, -70]
    ];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    lampCoords.forEach(([lx, lz]) => {
      const lGroup = new THREE.Group();
      lGroup.position.set(lx, 0, lz);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 8), poleMat);
      pole.position.y = 2.6;
      lGroup.add(pole);

      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xFEF9C3 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bulbMat);
      bulb.position.y = 5.3;
      lGroup.add(bulb);
      this.streetLampBulbs.push(bulbMat);

      this.scene.add(lGroup);
    });

    // 하늘 위 둥실둥실 3D 구름들
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (let i = 0; i < 14; i++) {
      const cGroup = new THREE.Group();
      cGroup.position.set((Math.random() - 0.5) * 280, 28 + Math.random() * 14, (Math.random() - 0.5) * 280);
      [-2.2, 0, 2.2].forEach((cx, idx) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(idx === 1 ? 3.2 : 2.3, 10, 10), cloudMat);
        puff.position.set(cx, idx === 1 ? 0.6 : 0, 0);
        cGroup.add(puff);
      });
      this.scene.add(cGroup);
    }
  }

  public setTimeOfDayVisuals(mode: 'day' | 'sunset' | 'night'): void {
    const isNight = mode === 'night';
    const isSunset = mode === 'sunset';
    this.streetLampBulbs.forEach(mat => {
      mat.color.setHex(isNight || isSunset ? 0xFACC15 : 0xE2E8F0);
    });
  }

  private buildTrafficLights(): void {
    const lightPositions = [
      { x: -6.8, z: 6.8, rotY: 0, dir: 'north_south' as const },
      { x: 6.8, z: -6.8, rotY: Math.PI, dir: 'north_south' as const },
      { x: 6.8, z: 6.8, rotY: -Math.PI / 2, dir: 'east_west' as const },
      { x: -6.8, z: -6.8, rotY: Math.PI / 2, dir: 'east_west' as const }
    ];

    lightPositions.forEach(pos => {
      const group = new THREE.Group();
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = pos.rotY;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 4.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x475569 })
      );
      pole.position.y = 2.4;
      group.add(pole);

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 1.85, 0.46),
        new THREE.MeshStandardMaterial({ color: 0x1E293B })
      );
      box.position.set(0, 4.0, 0);
      group.add(box);

      const lampGeom = new THREE.SphereGeometry(0.2, 16, 16);

      const redLamp = new THREE.Mesh(lampGeom, new THREE.MeshBasicMaterial({ color: 0x440000 }));
      redLamp.position.set(0, 4.5, 0.23);
      group.add(redLamp);

      const yellowLamp = new THREE.Mesh(lampGeom, new THREE.MeshBasicMaterial({ color: 0x443300 }));
      yellowLamp.position.set(0, 4.0, 0.23);
      group.add(yellowLamp);

      const greenLamp = new THREE.Mesh(lampGeom, new THREE.MeshBasicMaterial({ color: 0x004400 }));
      greenLamp.position.set(0, 3.5, 0.23);
      group.add(greenLamp);

      this.scene.add(group);

      this.trafficLights.push({
        group,
        dir: pos.dir,
        lamps: { red: redLamp, yellow: yellowLamp, green: greenLamp },
        currentState: 'green',
        stopZone: { x: pos.x, z: pos.z, radius: 7.5 }
      });
    });
  }

  private createCutePassenger(colorHex: number, isBunny = false): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 14), bodyMat);
    body.position.y = 0.52;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 14), bodyMat);
    head.position.y = 1.12;
    group.add(head);

    const earGeom = isBunny
      ? new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8)
      : new THREE.SphereGeometry(0.14, 8, 8);
    [-0.22, 0.22].forEach(x => {
      const ear = new THREE.Mesh(earGeom, bodyMat);
      ear.position.set(x, isBunny ? 1.58 : 1.42, 0);
      group.add(ear);
    });

    const eyeGeom = new THREE.SphereGeometry(0.055, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.13, 0.13].forEach(x => {
      const eye = new THREE.Mesh(eyeGeom, eyeMat);
      eye.position.set(x, 1.15, 0.35);
      group.add(eye);
    });

    const blushGeom = new THREE.SphereGeometry(0.065, 8, 8);
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xFF80AB });
    [-0.2, 0.2].forEach(x => {
      const blush = new THREE.Mesh(blushGeom, blushMat);
      blush.position.set(x, 1.05, 0.33);
      group.add(blush);
    });

    group.userData = { animTime: Math.random() * 5, isBoarded: false };
    return group;
  }

  /**
   * 6. 8개의 확장된 버스 정류장 및 귀여운 동물 승객들
   */
  private buildBusStops(): void {
    const stopsConfig = [
      {
        id: 1,
        name: '타요 차고지 정류장',
        icon: '🚌',
        x: -7.2,
        z: 18.0,
        passengerName: '노란 삐약이',
        passengerIcon: '🐥',
        color: 0xFFEB3B,
        isBunny: false,
        targetStopName: '무지개 유치원 정류장'
      },
      {
        id: 2,
        name: '무지개 유치원 정류장',
        icon: '🌈',
        x: 20.0,
        z: -7.2,
        passengerName: '아기 곰돌이',
        passengerIcon: '🐻',
        color: 0xA1887F,
        isBunny: false,
        targetStopName: '달콤 마트 정류장'
      },
      {
        id: 3,
        name: '달콤 마트 정류장',
        icon: '🛒',
        x: 7.2,
        z: 24.0,
        passengerName: '깡총 토끼',
        passengerIcon: '🐰',
        color: 0xF8FAFC,
        isBunny: true,
        targetStopName: '꿈나무 초등학교 정류장'
      },
      {
        id: 4,
        name: '꿈나무 초등학교 정류장',
        icon: '🏫',
        x: -20.0,
        z: -7.2,
        passengerName: '멍멍 강아지',
        passengerIcon: '🐶',
        color: 0xFDBA74,
        isBunny: false,
        targetStopName: '보글보글 세차장 정류장'
      },
      {
        id: 5,
        name: '보글보글 세차장 정류장',
        icon: '🫧',
        x: 55.2,
        z: 36.0,
        passengerName: '야옹 고양이',
        passengerIcon: '🐱',
        color: 0xF9A8D4,
        isBunny: false,
        targetStopName: '타요 놀이공원 정류장'
      },
      {
        id: 6,
        name: '타요 놀이공원 정류장',
        icon: '🎡',
        x: 48.0,
        z: 92.0,
        passengerName: '귀여운 판다',
        passengerIcon: '🐼',
        color: 0xE2E8F0,
        isBunny: false,
        targetStopName: '용감한 소방서 정류장'
      },
      {
        id: 7,
        name: '용감한 소방서 정류장',
        icon: '🚒',
        x: -55.2,
        z: 26.0,
        passengerName: '뿌우 코끼리',
        passengerIcon: '🐘',
        color: 0x93C5FD,
        isBunny: false,
        targetStopName: '풍차 마을 정류장'
      },
      {
        id: 8,
        name: '풍차 마을 정류장',
        icon: '🌾',
        x: -55.2,
        z: -72.0,
        passengerName: '개굴 개구리',
        passengerIcon: '🐸',
        color: 0x86EFAC,
        isBunny: false,
        targetStopName: '타요 차고지 정류장'
      }
    ];

    stopsConfig.forEach(cfg => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0, cfg.z);

      // 노란색 정차 바닥 구역
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 7.2),
        new THREE.MeshBasicMaterial({ color: 0xFACC15, transparent: true, opacity: 0.72 })
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.y = 0.04;
      group.add(zone);

      // 정류장 쉘터 지붕 & 기둥
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 3.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      pole.position.set(2.4, 1.5, 0);
      group.add(pole);

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 1.0),
        new THREE.MeshBasicMaterial({
          map: this.createSignBannerTexture(`${cfg.icon} ${cfg.name}`, '#0284C7'),
          side: THREE.DoubleSide
        })
      );
      sign.position.set(2.4, 3.2, 0);
      group.add(sign);

      const passenger = this.createCutePassenger(cfg.color, cfg.isBunny);
      passenger.position.set(2.4, 0, 1.1);
      group.add(passenger);

      this.scene.add(group);

      this.busStops.push({
        id: cfg.id,
        name: cfg.name,
        icon: cfg.icon,
        x: cfg.x,
        z: cfg.z,
        targetStopName: cfg.targetStopName,
        passengerName: cfg.passengerName,
        passengerIcon: cfg.passengerIcon,
        passengerMesh: passenger,
        hasPassenger: true
      });
    });
  }

  /**
   * 7. 도로 곳곳에 배치된 회전하는 황금 별 코인 (아이들이 운전만 해도 별을 먹는 성취감!)
   */
  private buildCollectibleStars(): void {
    const starPositions = [
      [0, 32], [0, -32], [32, 0], [-32, 0],
      [48, 20], [48, -20], [-48, 20], [-48, -20],
      [20, 48], [-20, 48], [20, -48], [-20, -48],
      [0, 78], [0, -78], [78, 0], [-78, 0],
      [48, 78], [-48, 78], [48, -78], [-48, -78]
    ];

    const starGeom = new THREE.OctahedronGeometry(0.68, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xFFD600,
      emissive: 0xF59E0B,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.6
    });

    starPositions.forEach(([sx, sz]) => {
      const g = new THREE.Group();
      g.position.set(sx, 1.1, sz);
      const mesh = new THREE.Mesh(starGeom, starMat);
      g.add(mesh);
      this.scene.add(g);

      this.stars.push({
        mesh: g,
        x: sx,
        z: sz,
        collected: false,
        respawnTimer: 0
      });
    });
  }

  /**
   * 8. 도로를 달리는 AI 친구 차량들 (패트 경찰차, 프랭크 소방차, 앨리스 구급차)
   */
  private buildNpcVehicles(): void {
    const configs: {
      id: string;
      name: string;
      type: 'pat' | 'frank' | 'alice';
      path: [number, number][];
      speed: number;
    }[] = [
      {
        id: 'pat',
        name: '패트 (경찰차)',
        type: 'pat',
        path: [
          [-48, -48],
          [48, -48],
          [48, 48],
          [-48, 48]
        ],
        speed: 7.5
      },
      {
        id: 'frank',
        name: '프랭크 (소방차)',
        type: 'frank',
        path: [
          [-108, 108],
          [108, 108],
          [108, -108],
          [-108, -108]
        ],
        speed: 8.5
      },
      {
        id: 'alice',
        name: '앨리스 (구급차)',
        type: 'alice',
        path: [
          [48, 108],
          [-48, 108],
          [-48, -108],
          [48, -108]
        ],
        speed: 7.8
      }
    ];

    configs.forEach(cfg => {
      const built = BusModelFactory.createNpcCarMesh(cfg.type);
      const waypoints = cfg.path.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
      built.mesh.position.copy(waypoints[0]);
      this.scene.add(built.mesh);

      this.npcVehicles.push({
        id: cfg.id,
        name: cfg.name,
        mesh: built.mesh,
        wheelMeshes: built.wheelMeshes,
        path: waypoints,
        currentWaypoint: 1,
        speed: cfg.speed,
        headlights: built.headlights
      });
    });
  }

  private buildBallHazard(): void {
    const ballGeom = new THREE.SphereGeometry(0.85, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xFF5722, roughness: 0.4 });
    this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.set(0, -999, 0);
    this.scene.add(this.ballMesh);
  }

  public updateTrafficLights(totalTime: number): {
    nsState: 'green' | 'yellow' | 'red';
    ewState: 'green' | 'yellow' | 'red';
  } {
    const cycle = totalTime % 16;
    let nsState: 'green' | 'yellow' | 'red' = 'green';
    let ewState: 'green' | 'yellow' | 'red' = 'red';

    if (cycle < 7) {
      nsState = 'green';
      ewState = 'red';
    } else if (cycle < 9) {
      nsState = 'yellow';
      ewState = 'red';
    } else if (cycle < 14) {
      nsState = 'red';
      ewState = 'green';
    } else {
      nsState = 'red';
      ewState = 'yellow';
    }

    this.trafficLights.forEach(tl => {
      const state = tl.dir === 'north_south' ? nsState : ewState;
      tl.currentState = state;

      tl.lamps.red.material.color.setHex(state === 'red' ? 0xFF1744 : 0x440000);
      tl.lamps.yellow.material.color.setHex(state === 'yellow' ? 0xFFEA00 : 0x443300);
      tl.lamps.green.material.color.setHex(state === 'green' ? 0x00E676 : 0x004400);
    });

    return { nsState, ewState };
  }

  /**
   * 월드 내 동적 오브젝트(세차장 브러쉬, 대관람차, 풍차, 차고지 문, 도로 별, NPC 차량) 업데이트
   */
  public updateWorldElements(
    delta: number,
    busPos: THREE.Vector3
  ): {
    collectedStar: boolean;
    triggeredZone: InteractiveZone | null;
  } {
    let collectedStar = false;
    let triggeredZone: InteractiveZone | null = null;

    // 1. 정류장 승객 콩콩 점프 애니메이션
    this.busStops.forEach(stop => {
      const p = stop.passengerMesh;
      if (!p.userData.isBoarded) {
        p.userData.animTime += delta * 4.5;
        p.position.y = Math.abs(Math.sin(p.userData.animTime)) * 0.24;
      }
    });

    // 2. 세차장 브러쉬 회전 & 비눗방울 상승
    this.carWashBrushes.forEach((b, idx) => {
      b.rotation.y += (idx === 0 ? 1 : -1) * 3.2 * delta;
    });
    this.carWashBubbles.forEach(bubble => {
      bubble.position.y += 1.4 * delta;
      if (bubble.position.y > 4.8) bubble.position.y = 0.6;
    });

    // 3. 대관람차 및 풍차 회전
    if (this.ferrisWheel) {
      this.ferrisWheel.rotation.z += 0.25 * delta;
    }
    if (this.windmillBlades) {
      this.windmillBlades.rotation.z -= 0.9 * delta;
    }

    // 4. 인터랙티브 시설 (차고지 문 개폐, 세차장, 충전소) 판정
    this.interactiveZones.forEach(zone => {
      if (zone.cooldown > 0) zone.cooldown -= delta;
      const dist = Math.hypot(busPos.x - zone.x, busPos.z - zone.z);

      if (zone.type === 'garage') {
        const targetDoorY = dist < 16 ? 5.6 : 2.1;
        this.garageDoors.forEach(d => {
          d.position.y += (targetDoorY - d.position.y) * 5 * delta;
        });
      }

      if (dist < zone.radius && zone.cooldown <= 0) {
        zone.cooldown = 14.0;
        triggeredZone = zone;
      }
    });

    // 5. 도로 위 황금 별 코인 수집 판정
    this.stars.forEach(st => {
      if (st.collected) {
        st.respawnTimer -= delta;
        if (st.respawnTimer <= 0) {
          st.collected = false;
          st.mesh.visible = true;
        }
      } else {
        st.mesh.rotation.y += 2.6 * delta;
        st.mesh.position.y = 1.1 + Math.sin(Date.now() * 0.004 + st.x) * 0.2;
        if (Math.hypot(busPos.x - st.x, busPos.z - st.z) < 2.8) {
          st.collected = true;
          st.respawnTimer = 25.0;
          st.mesh.visible = false;
          collectedStar = true;
        }
      }
    });

    // 6. AI NPC 친구 차량 순찰 이동 (타요가 가까이 오면 안전하게 잠깐 정지!)
    this.npcVehicles.forEach(npc => {
      const distToPlayer = npc.mesh.position.distanceTo(busPos);
      if (distToPlayer < 7.5) return; // 플레이어 버스와 부딪히지 않게 양보 정지

      const target = npc.path[npc.currentWaypoint];
      const dir = new THREE.Vector3().subVectors(target, npc.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 1.5) {
        npc.currentWaypoint = (npc.currentWaypoint + 1) % npc.path.length;
      } else {
        dir.normalize();
        npc.mesh.position.addScaledVector(dir, npc.speed * delta);
        const targetAngle = Math.atan2(dir.x, dir.z);
        npc.mesh.rotation.y = targetAngle;
        npc.wheelMeshes.forEach(w => {
          w.rotation.x += npc.speed * 0.08;
        });
      }
    });

    return { collectedStar, triggeredZone };
  }

  public updateBallHazard(
    delta: number,
    busPos: THREE.Vector3,
    busHeading: number
  ): { triggerAlert: boolean; safeStop: boolean; hit: boolean } {
    const result = { triggerAlert: false, safeStop: false, hit: false };
    if (!this.ballMesh) return result;

    if (!this.ballActive) {
      this.ballTimer -= delta;
      if (this.ballTimer <= 0) {
        this.ballActive = true;
        this.ballTimer = 42;

        const spawnDist = 22;
        const sideOffset = Math.random() > 0.5 ? 9.5 : -9.5;
        const spawnX = busPos.x + Math.sin(busHeading) * spawnDist + sideOffset;
        const spawnZ = busPos.z + Math.cos(busHeading) * spawnDist;

        this.ballMesh.position.set(spawnX, 0.85, spawnZ);
        this.ballVel.set((busPos.x - spawnX) * 0.36, 0, (busPos.z - spawnZ) * 0.36);

        result.triggerAlert = true;
      }
    } else {
      this.ballMesh.position.addScaledVector(this.ballVel, delta);
      this.ballMesh.rotation.x += 6.0 * delta;

      const dist = busPos.distanceTo(this.ballMesh.position);

      if (dist < 6.8 && dist > 2.0) {
        result.safeStop = true;
      } else if (dist <= 2.0) {
        result.hit = true;
        this.ballActive = false;
        this.ballMesh.position.set(0, -999, 0);
      }
    }

    return result;
  }
}
