import * as THREE from 'three';
import { PhysicsEngine } from './physics';
import { BusModelFactory } from './bus-model';
import {
  BusStopData,
  CollectibleStar,
  InteractiveZone,
  MinimapRoadSegment,
  NpcVehicle,
  NpcVehicleKind,
  PedestrianWalker,
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
  public pedestrians: PedestrianWalker[] = [];
  public minimapRoads: MinimapRoadSegment[] = [];

  // 애니메이션용 3D 오브젝트 참조
  private carWashBrushes: THREE.Object3D[] = [];
  private carWashBubbles: THREE.Mesh[] = [];
  private garageDoors: THREE.Mesh[] = [];
  private ferrisWheel: THREE.Group | null = null;
  private windmillBlades: THREE.Group | null = null;
  private streetLampBulbs: THREE.MeshBasicMaterial[] = [];
  private streetLampGroundGlows: THREE.Mesh[] = [];
  private fountainDrops: THREE.Mesh[] = [];

  // 소방서 3D 화재 훈련 타워 불꽃 & 물대포 파티클 / 병원 힐링 파티클
  private fireFlameMeshes: THREE.Mesh[] = [];
  public fireTrainingTower: THREE.Group | null = null;
  private waterSprayParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private hospitalHeartParticles: THREE.Object3D[] = [];
  public fireIntensity: number = 1.0;

  public ballMesh: THREE.Mesh | null = null;
  public ballActive: boolean = false;
  private ballTimer: number = 35;
  private ballVel = new THREE.Vector3();

  constructor(scene: THREE.Scene, physics: PhysicsEngine) {
    this.scene = scene;
    this.physics = physics;
  }

  /**
   * 직선 왕복 4차선/2차선 아스팔트 도로 텍스처 (중앙 황색 복선 + 차선 점선 + 갓길 백색 실선 + 진행 화살표)
   */
  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2B3442';
    ctx.fillRect(0, 0, 512, 512);

    // 아스팔트 입자 질감
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 240; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 180; i++) {
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
    }

    // 양쪽 갓길 백색 실선
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 10;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(30, 512);
    ctx.moveTo(482, 0);
    ctx.lineTo(482, 512);
    ctx.stroke();

    // 중앙 노란색 복선 (한국 도로 표준 중앙선)
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(247, 0);
    ctx.lineTo(247, 512);
    ctx.moveTo(265, 0);
    ctx.lineTo(265, 512);
    ctx.stroke();

    // 좌우 차로 내 은은한 주행 가이드 점선 & 직진 화살표 마킹
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 5;
    ctx.setLineDash([28, 36]);
    ctx.beginPath();
    ctx.moveTo(138, 0);
    ctx.lineTo(138, 512);
    ctx.moveTo(374, 0);
    ctx.lineTo(374, 512);
    ctx.stroke();
    ctx.setLineDash([]);

    // 노면 방향 화살표 (우측 통행 기준)
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    // 우측 차로 (위쪽 진행)
    ctx.beginPath();
    ctx.moveTo(374, 180);
    ctx.lineTo(356, 215);
    ctx.lineTo(367, 215);
    ctx.lineTo(367, 265);
    ctx.lineTo(381, 265);
    ctx.lineTo(381, 215);
    ctx.lineTo(392, 215);
    ctx.closePath();
    ctx.fill();

    // 좌측 차로 (아래쪽 진행)
    ctx.beginPath();
    ctx.moveTo(138, 332);
    ctx.lineTo(120, 297);
    ctx.lineTo(131, 297);
    ctx.lineTo(131, 247);
    ctx.lineTo(145, 247);
    ctx.lineTo(145, 297);
    ctx.lineTo(156, 297);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 사거리 / 삼거리 전용 교차로 노면 텍스처 (내부에 중앙선이 침범하지 않는 깔끔한 교차로 + 정지선 + 횡단보도)
   */
  private createIntersectionTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2B3442';
    ctx.fillRect(0, 0, 512, 512);

    // 코너 연석 곡선 표현
    ctx.fillStyle = '#64748B';
    const r = 34;
    [
      [0, 0],
      [512, 0],
      [0, 512],
      [512, 512]
    ].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 교차로 중앙 다이아몬드 가이드 마킹
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(256, 196);
    ctx.lineTo(316, 256);
    ctx.lineTo(256, 316);
    ctx.lineTo(196, 256);
    ctx.closePath();
    ctx.stroke();

    // 4방향 정지선 & 횡단보도 줄무늬
    ctx.fillStyle = '#F8FAFC';
    for (let i = 58; i <= 426; i += 36) {
      // 상단/하단 횡단보도
      ctx.fillRect(i, 16, 20, 48);
      ctx.fillRect(i, 448, 20, 48);
      // 좌측/우측 횡단보도
      ctx.fillRect(16, i, 48, 20);
      ctx.fillRect(448, i, 48, 20);
    }

    // 굵은 흰색 정지선
    ctx.fillRect(42, 74, 428, 10);
    ctx.fillRect(42, 428, 428, 10);
    ctx.fillRect(74, 42, 10, 428);
    ctx.fillRect(428, 42, 10, 428);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 원형 로터리 전용 방사형 차선 텍스처 (내부 황색 실선 + 중앙 원형 백색 점선 + 외곽 백색 실선)
   */
  private createRoundaboutTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2B3442';
    ctx.fillRect(0, 0, 1024, 1024);

    const cx = 512;
    const cy = 512;

    // 안쪽 노란색 원형 경계선
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 240, 0, Math.PI * 2);
    ctx.stroke();

    // 로터리 회전 차로 중앙 흰색 점선
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 10;
    ctx.setLineDash([42, 34]);
    ctx.beginPath();
    ctx.arc(cx, cy, 365, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 바깥쪽 흰색 실선
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, 488, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 곡선 커브 도로 전용 방사형 텍스처 (RingGeometry 위에 매핑되어 커브를 따라 황색 중앙선과 백색 차선이 휘어짐!)
   */
  private createCurvedRoadTexture(innerR: number, outerR: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2B3442';
    ctx.fillRect(0, 0, 1024, 1024);

    const cx = 512;
    const cy = 512;
    // Three.js RingGeometry UV는 중심(512,512)에서 반경 512를 outerRadius로 매핑함
    const toPx = (r: number) => (r / outerR) * 512;
    const midR = (innerR + outerR) / 2;

    // 안쪽/바깥쪽 갓길 백색 실선
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, toPx(innerR + 0.65), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, toPx(outerR - 0.65), 0, Math.PI * 2);
    ctx.stroke();

    // 커브를 따라 부드럽게 휘어지는 중앙 황색 복선!
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, toPx(midR - 0.22), 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, toPx(midR + 0.22), 0, Math.PI * 2);
    ctx.stroke();

    // 차로 중앙 보조선 점선
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 5;
    ctx.setLineDash([28, 28]);
    ctx.beginPath();
    ctx.arc(cx, cy, toPx((innerR + midR) / 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, toPx((outerR + midR) / 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

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
    ctx.font = '900 48px "Nanum Gothic", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  public generate(): void {
    // 1. 광활한 상업용 오픈월드 잔디 지면 (520m x 520m)
    const groundSize = 520;
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x689F38, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.physics.addGround(groundSize, groundSize);

    // 맵 외곽 안전 울타리
    const wallHalf = groundSize / 2 - 6;
    this.physics.addBoxCollider(0, 3, wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(0, 3, -wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(wallHalf, 3, 0, 1, 3, wallHalf);
    this.physics.addBoxCollider(-wallHalf, 3, 0, 1, 3, wallHalf);

    // 2. 모듈형 진짜 도로망 구축 (단순 타일 겹침 ZERO! 중앙 로터리 + 사거리 + 삼거리 + 외곽 곡선 커브 서킷 + 미니맵 100% 동기화)
    this.buildRoads();

    // 3. 무지개 언덕 전망대 & 경사로 구축
    this.buildTestRamp();

    // 4. 인터랙티브 시설 6종 (타요 차고지, 보글보글 세차장, 에너지 충전소 + 경찰서, 소방서, 병원!)
    this.buildTayoGarage(-30, 30);
    this.buildCarWash(84, 54);
    this.buildChargingStation(-84, -54);
    this.buildPoliceStation(-84, 28);
    this.buildFireStation(-84, 86);
    this.buildHospital(84, -28);

    // 5. 디테일한 3D 랜드마크 건물들 & 대관람차/풍차
    this.buildLandmarksAndBuildings();

    // 6. 자연 환경 (입체 나무, 구름, 야간 자동 점등 가로등)
    this.buildNatureAndStreetlights();

    // 7. 교차로 신호등 & 횡단보도 보행자 시스템 설치
    this.buildTrafficLights();
    this.buildPedestrians();

    // 8. 8개의 버스 정류장 설치 (가족 4인방 1명씩 유일 등장 엄수!)
    this.buildBusStops();

    // 9. 도로 위 반짝이는 별 코인 배치
    this.buildCollectibleStars();

    // 10. 도로 위 순찰차/소방차/구급차 + 페라리 & 메르세데스 F1 레이싱카 + 중립 차량 배치
    this.buildNpcVehicles();

    // 11. 돌발상황 축구공
    this.buildBallHazard();
  }

  /**
   * 🛣️ 상업용 모듈형 도로망 구축:
   * - 직선 도로 세그먼트는 교차로 정지선 앞에서 정확히 끊어져 노란 중앙선이 교차로나 로터리를 침범하지 않음!
   * - 중앙 원형 로터리 (반경 21m, 분수대 포함)
   * - 내부 순환 사거리 (±54m) & 외곽 삼거리 (±136m)
   * - 외곽 순환 고속도로의 4대 코너는 반경 38m의 진짜 곡선 커브 도로(Curved Arc)로 부드럽게 연결!
   * - 모든 도로 세그먼트를 `this.minimapRoads`에 등록해 미니맵과 100% 일치시킴!
   */
  private buildRoads(): void {
    const roadTex = this.createRoadTexture();
    const interTex = this.createIntersectionTexture();
    const roadWidth = 11.2;
    const halfW = roadWidth / 2;

    this.minimapRoads = [];

    // A. 정밀 직선 도로 세그먼트 생성 헬퍼 (x1,z1) ~ (x2,z2)
    const addStraightSegment = (x1: number, z1: number, x2: number, z2: number) => {
      const isHorizontal = Math.abs(z1 - z2) < 0.01;
      const length = isHorizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
      if (length <= 0.2) return;
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;

      const geom = new THREE.PlaneGeometry(roadWidth, length);
      const rTex = roadTex.clone();
      rTex.repeat.set(1, Math.max(1, Math.round(length / 11)));
      rTex.needsUpdate = true;

      const mat = new THREE.MeshStandardMaterial({
        map: rTex,
        roughness: 0.82,
        polygonOffset: true,
        polygonOffsetFactor: -1
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      if (isHorizontal) {
        mesh.rotation.z = Math.PI / 2;
      }
      mesh.position.set(cx, 0.02, cz);
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // 양쪽 인도 연석(Sidewalk Curb) 자동 생성
      const curbMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.7 });
      const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.85 });
      [-1, 1].forEach(side => {
        const offset = side * (halfW + 0.9);
        const sw = new THREE.Mesh(
          new THREE.BoxGeometry(isHorizontal ? Math.max(1, length - 1.5) : 1.8, 0.14, isHorizontal ? 1.8 : Math.max(1, length - 1.5)),
          sidewalkMat
        );
        sw.position.set(isHorizontal ? cx : cx + offset, 0.07, isHorizontal ? cz + offset : cz);
        sw.receiveShadow = true;
        this.scene.add(sw);

        const curbOffset = side * (halfW + 0.12);
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(isHorizontal ? Math.max(1, length - 1.5) : 0.28, 0.18, isHorizontal ? 0.28 : Math.max(1, length - 1.5)),
          curbMat
        );
        curb.position.set(isHorizontal ? cx : cx + curbOffset, 0.09, isHorizontal ? cz + curbOffset : cz);
        this.scene.add(curb);
      });

      this.minimapRoads.push({
        kind: 'straight',
        x1,
        z1,
        x2,
        z2,
        width: roadWidth
      });
    };

    // B. 교차로 (사거리 / 삼거리) 전용 패드 생성 헬퍼
    const interMat = new THREE.MeshStandardMaterial({
      map: interTex,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const addIntersectionNode = (ix: number, iz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadWidth), interMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(ix, 0.026, iz);
      m.receiveShadow = true;
      this.scene.add(m);
    };

    // 1. 🌟 중앙 원형 로터리 (Central Grand Roundabout: 내경 8.8m, 외경 20.5m)
    const rbInner = 8.8;
    const rbOuter = 20.5;
    const rbGeom = new THREE.RingGeometry(rbInner, rbOuter, 64);
    const rbMat = new THREE.MeshStandardMaterial({
      map: this.createRoundaboutTexture(),
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const rbMesh = new THREE.Mesh(rbGeom, rbMat);
    rbMesh.rotation.x = -Math.PI / 2;
    rbMesh.position.set(0, 0.025, 0);
    rbMesh.receiveShadow = true;
    this.scene.add(rbMesh);

    this.minimapRoads.push({
      kind: 'roundabout',
      cx: 0,
      cz: 0,
      innerRadius: rbInner,
      outerRadius: rbOuter,
      width: rbOuter - rbInner
    });

    // 로터리 중앙 원형 화단 & 3D 분수대 조형물
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(rbInner, rbInner + 0.4, 0.45, 40),
      new THREE.MeshStandardMaterial({ color: 0x4ADE80, roughness: 0.8 })
    );
    island.position.set(0, 0.22, 0);
    this.scene.add(island);

    const fountainBasin = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.75, 28),
      new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.35 })
    );
    fountainBasin.position.set(0, 0.6, 0);
    this.scene.add(fountainBasin);

    const waterPool = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.15, metalness: 0.2 })
    );
    waterPool.position.set(0, 0.92, 0);
    this.scene.add(waterPool);

    const dropMat = new THREE.MeshBasicMaterial({ color: 0xE0F2FE });
    for (let i = 0; i < 12; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), dropMat);
      const ang = (i / 12) * Math.PI * 2;
      drop.position.set(Math.cos(ang) * 1.4, 1.4 + (i % 3) * 0.5, Math.sin(ang) * 1.4);
      this.scene.add(drop);
      this.fountainDrops.push(drop);
    }
    this.physics.addCylinderCollider(0, 0.8, 0, rbInner - 0.4, 0.8);

    // 2. 내부 순환로 기준 좌표 (R1 = 54m) 및 외곽 순환 고속도로 기준 좌표 (R2 = 136m, 코너 곡선 반경 CurveR = 38m)
    const R1 = 54;
    const R2 = 136;
    const curveR = 38;
    const outerStraightLimit = R2 - curveR; // 98m 지점에서 곡선 커브 시작!

    // 모든 사거리/삼거리 교차로 패드 배치 (교차로 내부는 중앙선 없이 깔끔하게!)
    const intersectionCoords: [number, number][] = [
      // 내부 순환 8개 교차로 (4대 십자 교차로 + 4대 코너 교차로)
      [0, R1], [0, -R1], [R1, 0], [-R1, 0],
      [R1, R1], [-R1, R1], [R1, -R1], [-R1, -R1],
      // 외곽 순환로와 만나는 12개 삼거리(T-Junction) 교차로
      [0, R2], [0, -R2], [R2, 0], [-R2, 0],
      [R1, R2], [-R1, R2], [R1, -R2], [-R1, -R2],
      [R2, R1], [-R2, R1], [R2, -R1], [-R2, -R1]
    ];
    intersectionCoords.forEach(([ix, iz]) => addIntersectionNode(ix, iz));

    // 3. 로터리(반경 20.0m)에서 내부 사거리(54m)까지 뻗는 4방 직선 대로
    const rbEdge = rbOuter - 0.4;
    addStraightSegment(0, rbEdge, 0, R1 - halfW);
    addStraightSegment(0, -rbEdge, 0, -R1 + halfW);
    addStraightSegment(rbEdge, 0, R1 - halfW, 0);
    addStraightSegment(-rbEdge, 0, -R1 + halfW, 0);

    // 4. 내부 순환도로 세그먼트 (±54m)
    [-R1, R1].forEach(coord => {
      // 동서 방향 내부 도로
      addStraightSegment(-R1 + halfW, coord, -halfW, coord);
      addStraightSegment(halfW, coord, R1 - halfW, coord);
      // 남북 방향 내부 도로
      addStraightSegment(coord, -R1 + halfW, coord, -halfW);
      addStraightSegment(coord, halfW, coord, R1 - halfW);
    });

    // 5. 내부 순환로(±54m)에서 외곽 순환 고속도로(±136m)까지 뻗는 방사형 연결 대로 (총 12개 구간)
    [-R1, 0, R1].forEach(lane => {
      // 북쪽 / 남쪽 뻗는 도로
      addStraightSegment(lane, R1 + halfW, lane, R2 - halfW);
      addStraightSegment(lane, -R1 - halfW, lane, -R2 + halfW);
      // 동쪽 / 서쪽 뻗는 도로
      addStraightSegment(R1 + halfW, lane, R2 - halfW, lane);
      addStraightSegment(-R1 - halfW, lane, -R2 + halfW, lane);
    });

    // 6. 외곽 순환 고속도로 직선 구간 (±136m: 삼거리 사이 및 커브 시작점 98m까지 연결)
    [-R2, R2].forEach(outer => {
      // 동서 외곽 대로 세그먼트
      addStraightSegment(-outerStraightLimit, outer, -R1 - halfW, outer);
      addStraightSegment(-R1 + halfW, outer, -halfW, outer);
      addStraightSegment(halfW, outer, R1 - halfW, outer);
      addStraightSegment(R1 + halfW, outer, outerStraightLimit, outer);

      // 남북 외곽 대로 세그먼트
      addStraightSegment(outer, -outerStraightLimit, outer, -R1 - halfW);
      addStraightSegment(outer, -R1 + halfW, outer, -halfW);
      addStraightSegment(outer, halfW, outer, R1 - halfW);
      addStraightSegment(outer, R1 + halfW, outer, outerStraightLimit);
    });

    // 7. 🌟 외곽 순환 고속도로 4대 코너 진짜 곡선 커브 도로 (True Curved Highway Corners, 반경 R=38m)
    const curveInner = curveR - halfW;
    const curveOuter = curveR + halfW;
    const curvedTex = this.createCurvedRoadTexture(curveInner, curveOuter);
    const curvedMat = new THREE.MeshStandardMaterial({
      map: curvedTex,
      roughness: 0.8,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });

    const addCurvedHighwayCorner = (cx: number, cz: number, startAngle: number, endAngle: number) => {
      const ringGeom = new THREE.RingGeometry(curveInner, curveOuter, 40, 1, startAngle, endAngle - startAngle);
      const mesh = new THREE.Mesh(ringGeom, curvedMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx, 0.022, cz);
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // 커브 바깥쪽 안전 가드레일 기둥 배치
      const railMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.4 });
      for (let i = 1; i <= 5; i++) {
        const t = startAngle + ((endAngle - startAngle) * i) / 6;
        // RingGeometry는 XY 평면에서 생성 후 X축으로 -90도 회전되므로 월드 좌표는 (cx + r*cos(t), cz - r*sin(t))
        const gx = cx + Math.cos(t) * (curveOuter + 1.1);
        const gz = cz - Math.sin(t) * (curveOuter + 1.1);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), railMat);
        post.position.set(gx, 0.45, gz);
        this.scene.add(post);
      }

      this.minimapRoads.push({
        kind: 'arc',
        cx,
        cz,
        radius: curveR,
        startAngle,
        endAngle,
        width: roadWidth
      });
    };

    // 4개 외곽 코너의 90도 원호 커브 연결 (RingGeometry X축 -90도 회전 좌표계 기준)
    // 남동쪽 코너 (+98, +98): X=+136, Z=+98..+136 & X=+98..+136, Z=+136 -> theta: 1.5*PI ~ 2.0*PI
    addCurvedHighwayCorner(outerStraightLimit, outerStraightLimit, Math.PI * 1.5, Math.PI * 2.0);
    // 남서쪽 코너 (-98, +98): theta: PI ~ 1.5*PI
    addCurvedHighwayCorner(-outerStraightLimit, outerStraightLimit, Math.PI, Math.PI * 1.5);
    // 북서쪽 코너 (-98, -98): theta: 0.5*PI ~ PI
    addCurvedHighwayCorner(-outerStraightLimit, -outerStraightLimit, Math.PI * 0.5, Math.PI);
    // 북동쪽 코너 (+98, -98): theta: 0 ~ 0.5*PI
    addCurvedHighwayCorner(outerStraightLimit, -outerStraightLimit, 0, Math.PI * 0.5);
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
      icon: '🚌',
      color: '#0284C7',
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
      icon: '🫧',
      color: '#00B0FF',
      type: 'carwash',
      x,
      z,
      radius: 5.5,
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
      icon: '⚡',
      color: '#10B981',
      type: 'station',
      x: x - 0.5,
      z,
      radius: 5.8,
      cooldown: 0,
      group
    });
  }

  /**
   * 🚓 4. 용감한 경찰서 (Police Station) - 경찰 마크, 회전 경광등 타워, 출동 패드
   */
  private buildPoliceStation(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 앞마당 출동 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 16),
      new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.65 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.025, 4);
    group.add(pad);

    // 본관 건물 (화이트 & 네이비 블루 경찰서 스타일)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(16, 7.6, 11),
      new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.4 })
    );
    body.position.y = 3.8;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const blueBand = new THREE.Mesh(
      new THREE.BoxGeometry(16.3, 1.6, 11.3),
      new THREE.MeshStandardMaterial({ color: 0x1D4ED8, roughness: 0.35 })
    );
    blueBand.position.y = 6.2;
    group.add(blueBand);

    // 경찰서 출동 차고문 2개
    [-3.6, 3.6].forEach(bx => {
      const bay = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 3.8, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.4, roughness: 0.3 })
      );
      bay.position.set(bx, 1.9, 5.55);
      group.add(bay);
    });

    // 옥상 대형 경찰 황금 방패 엠블럼 & 사이렌 비콘
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.3, 0.35, 6),
      new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.6, roughness: 0.25 })
    );
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0, 8.5, 5.6);
    group.add(shield);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 2.1),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🚓 112 용감한 경찰서', '#1D4ED8'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(0, 10.2, 3.5);
    group.add(sign);

    this.scene.add(group);
    this.physics.addBoxCollider(x, 3.8, z, 8.0, 3.8, 5.5);

    this.interactiveZones.push({
      id: 'police_station',
      name: '112 용감한 경찰서',
      icon: '🚓',
      color: '#1D4ED8',
      type: 'police_station',
      x,
      z: z + 8.5,
      radius: 8.5,
      cooldown: 0,
      group
    });
  }

  /**
   * 🚒 5. 출동! 119 소방서 & 화재 진압 훈련 타워 (실제 3D 불꽃 애니메이션 + 물대포 진압 콘텐츠!)
   */
  private buildFireStation(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 소방서 빨간/회색 앞마당 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.6 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.025, 4);
    group.add(pad);

    // 소방서 본관 (강렬한 소방 레드)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(16, 7.8, 11),
      new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.4 })
    );
    body.position.set(-2, 3.9, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 소방차 출동 셔터 베이 2개
    [-5.2, 1.2].forEach(bx => {
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 4.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xFEF08A, roughness: 0.35 })
      );
      shutter.position.set(bx, 2.1, 5.55);
      group.add(shutter);
    });

    // 우측 화재 진압 훈련 타워 (아이들이 물대포로 불을 끄는 미션 타겟!)
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 11.5, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 })
    );
    tower.position.set(9.5, 5.75, 1.5);
    tower.castShadow = true;
    group.add(tower);

    // 훈련 타워 3D 타오르는 불꽃 그룹
    const fireGroup = new THREE.Group();
    fireGroup.position.set(9.5, 6.2, 4.5);
    const flameColors = [0xFF1744, 0xFF9100, 0xFFEA00];
    for (let i = 0; i < 9; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.55 + (i % 3) * 0.25, 1.8 + (i % 2) * 0.8, 8),
        new THREE.MeshBasicMaterial({ color: flameColors[i % flameColors.length] })
      );
      cone.position.set(((i % 3) - 1) * 1.1, Math.floor(i / 3) * 1.1, (Math.random() - 0.5) * 0.5);
      this.fireFlameMeshes.push(cone);
      fireGroup.add(cone);
    }
    group.add(fireGroup);
    this.fireTrainingTower = fireGroup;

    // 간판
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 2.2),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🚒 119 용감한 소방서', '#DC2626'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(-1, 9.6, 4.5);
    group.add(sign);

    this.scene.add(group);
    this.physics.addBoxCollider(x - 2, 3.9, z, 8.0, 3.9, 5.5);
    this.physics.addBoxCollider(x + 9.5, 5.75, z + 1.5, 2.75, 5.75, 2.75);

    this.interactiveZones.push({
      id: 'fire_station',
      name: '119 용감한 소방서',
      icon: '🚒',
      color: '#DC2626',
      type: 'fire_station',
      x: x + 2,
      z: z + 9.0,
      radius: 9.5,
      cooldown: 0,
      group
    });
  }

  /**
   * 💦 소방차/차량 물대포 발사 및 화재 진압 연출
   */
  public sprayWaterAtFire(origin: THREE.Vector3, forwardDir: THREE.Vector3): { extinguishedFire: boolean } {
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.14, 8, 8), dropMat);
      mesh.position.copy(origin).add(new THREE.Vector3(0, 2.6, 0));
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 3.5,
        3.5 + Math.random() * 3.0,
        (Math.random() - 0.5) * 3.5
      );
      const vel = forwardDir.clone().multiplyScalar(18 + Math.random() * 6).add(spread);
      this.scene.add(mesh);
      this.waterSprayParticles.push({ mesh, vel, life: 1.1 });
    }

    // 소방서 훈련 타워 근처인지 체크하여 불 진압!
    const fireWorldPos = new THREE.Vector3(-84 + 9.5, 2.0, 86 + 4.5);
    if (origin.distanceTo(fireWorldPos) < 28 && this.fireIntensity > 0.1) {
      this.fireIntensity = 0; // 즉시 진화 성공!
      return { extinguishedFire: true };
    }
    return { extinguishedFire: false };
  }

  /**
   * 🏥 6. 튼튼 종합병원 (Hospital) - 적십자 십자가, 옥상 헬리패드(H), 치유 하트 이펙트
   */
  private buildHospital(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 에메랄드 민트 응급실 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 16),
      new THREE.MeshStandardMaterial({ color: 0x10B981, roughness: 0.55 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.025, 4);
    group.add(pad);

    // 병원 본관 (화이트 & 에메랄드 그린 라인)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(16, 8.8, 11.5),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.35 })
    );
    body.position.y = 4.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const mintBand = new THREE.Mesh(
      new THREE.BoxGeometry(16.2, 1.4, 11.7),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35 })
    );
    mintBand.position.y = 7.5;
    group.add(mintBand);

    // 정면 대형 입체 적십자(Red Cross) 심볼
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.8, 0.25), crossMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.25), crossMat);
    crossV.position.set(0, 5.4, 5.85);
    crossH.position.set(0, 5.4, 5.85);
    group.add(crossV, crossH);

    // 옥상 헬리패드 (H 마크)
    const helipad = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    helipad.position.set(0, 8.9, 0);
    group.add(helipad);

    // 병원 주변 둥실둥실 치유 십자가 파티클
    for (let i = 0; i < 6; i++) {
      const hGroup = new THREE.Group();
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.25), crossMat);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.25, 0.25), crossMat);
      hGroup.add(c1, c2);
      hGroup.position.set((i - 2.5) * 2.5, 1.5 + (i % 3) * 0.9, 7.5);
      group.add(hGroup);
      this.hospitalHeartParticles.push(hGroup);
    }

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11.0, 2.1),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🏥 튼튼 어린이 종합병원', '#059669'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(0, 10.6, 4.5);
    group.add(sign);

    this.scene.add(group);
    this.physics.addBoxCollider(x, 4.4, z, 8.0, 4.4, 5.75);

    this.interactiveZones.push({
      id: 'hospital',
      name: '튼튼 어린이 종합병원',
      icon: '🏥',
      color: '#059669',
      type: 'hospital',
      x,
      z: z + 8.5,
      radius: 8.8,
      cooldown: 0,
      group
    });
  }

  /**
   * 7. 무지개 언덕 전망대 & 안전 난간 경사로
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
   * 8. 디테일한 3D 랜드마크 건물들 (유치원, 초등학교, 마트, F1 그랑프리 피트스탑, 대관람차, 풍차 등)
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
          new THREE.PlaneGeometry(9.2, 1.9),
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
    addDetailedBuilding(-28, -28, 16, 11, 7.0, 0xFDE047, 'school', '🏫 꿈나무 초등학교', '#CA8A04');
    addDetailedBuilding(28, -28, 14, 11, 6.2, 0xF9A8D4, 'pitched', '🌈 무지개 유치원', '#DB2777');
    addDetailedBuilding(28, 28, 13, 11, 6.2, 0x7DD3FC, 'mart', '🛒 달콤 마트', '#0284C7');
    addDetailedBuilding(0, -162, 22, 10, 6.5, 0x1E293B, 'flat', '🏎️ F1 그랑프리 피트스탑', '#DC0000');

    // 외곽 마을 주택 & 타운 단지 (확장된 월드 곳곳에 배치)
    const houseColors = [0xFDBA74, 0xBEF264, 0x93C5FD, 0xF9A8D4, 0xC4B5FD, 0xFDE047];
    const houseCoords = [
      { x: -28, z: -84 }, { x: -84, z: -28 },
      { x: 28, z: 84 }, { x: 84, z: 84 },
      { x: -28, z: 84 }, { x: 84, z: -84 },
      { x: -84, z: -84 }, { x: 0, z: 92 },
      { x: 0, z: -92 }, { x: 162, z: 0 },
      { x: -162, z: 0 }, { x: 162, z: 54 },
      { x: -162, z: -54 }, { x: 54, z: 162 }
    ];
    houseCoords.forEach((p, idx) => {
      addDetailedBuilding(p.x, p.z, 8.8, 8.8, 5.2, houseColors[idx % houseColors.length], 'pitched');
    });

    // 놀이공원 대관람차 (북동쪽 외곽 랜드마크!)
    this.buildFerrisWheel(98, 98);

    // 풍차 마을 대형 풍차 (남서쪽 외곽 랜드마크!)
    this.buildWindmill(-98, -98);
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

    // 가로수 배치 (내부 순환로 및 외곽 순환로 주변)
    const treePositions = [
      [-10, 26], [-10, 40], [10, 26], [10, 40],
      [-10, -26], [-10, -40], [10, -26], [10, -40],
      [26, 10], [40, 10], [26, -10], [40, -10],
      [-26, 10], [-40, 10], [-26, -10], [-40, -10],
      [-64, 22], [-64, -22], [64, 22], [64, -22],
      [-22, 64], [22, 64], [-22, -64], [22, -64],
      [-112, 34], [112, 34], [-112, -34], [112, -34],
      [-34, 112], [34, 112], [-34, -112], [34, -112],
      [-148, 60], [148, 60], [-148, -60], [148, -60]
    ];
    treePositions.forEach(([tx, tz], idx) => addTree(tx, tz, 1.0 + (idx % 3) * 0.16, idx % 2 === 0));

    // 💡 밤/노을에 환하게 켜지는 아치형 가로등 & 바닥 불빛 풀(Light Pool) 배치
    const lampCoords: [number, number][] = [
      [-7.4, 24], [7.4, 24], [-7.4, -24], [7.4, -24],
      [24, 7.4], [24, -7.4], [-24, 7.4], [-24, -7.4],
      [-46, 46], [46, 46], [-46, -46], [46, -46],
      [-7.4, 78], [7.4, 78], [-7.4, -78], [7.4, -78],
      [78, 7.4], [78, -7.4], [-78, 7.4], [-78, -7.4],
      [-62, 128], [62, 128], [-62, -128], [62, -128],
      [-128, 62], [128, 62], [-128, -62], [128, -62]
    ];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.5 });

    lampCoords.forEach(([lx, lz]) => {
      const lGroup = new THREE.Group();
      lGroup.position.set(lx, 0, lz);

      // 기둥
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 5.6, 8), poleMat);
      pole.position.y = 2.8;
      lGroup.add(pole);

      // 가로등 상단 수평 암(Arm)
      const armDir = lx < 0 ? 1 : -1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.12), poleMat);
      arm.position.set(armDir * 0.55, 5.5, 0);
      lGroup.add(arm);

      // 가로등 전구 헤드
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xE2E8F0 });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12), bulbMat);
      bulb.position.set(armDir * 1.1, 5.38, 0);
      lGroup.add(bulb);
      this.streetLampBulbs.push(bulbMat);

      // 야간 바닥 원형 불빛 후광 (밤이 되면 은은하게 도로를 비춤!)
      const glowRing = new THREE.Mesh(
        new THREE.CircleGeometry(4.8, 20),
        new THREE.MeshBasicMaterial({
          color: 0xFDE047,
          transparent: true,
          opacity: 0.26,
          depthWrite: false
        })
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.set(armDir * 1.2, 0.032, 0);
      glowRing.visible = false;
      lGroup.add(glowRing);
      this.streetLampGroundGlows.push(glowRing);

      this.scene.add(lGroup);
    });

    // 하늘 위 둥실둥실 3D 구름들
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (let i = 0; i < 18; i++) {
      const cGroup = new THREE.Group();
      cGroup.position.set((Math.random() - 0.5) * 380, 30 + Math.random() * 14, (Math.random() - 0.5) * 380);
      [-2.2, 0, 2.2].forEach((cx, idx) => {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(idx === 1 ? 3.2 : 2.3, 10, 10), cloudMat);
        puff.position.set(cx, idx === 1 ? 0.6 : 0, 0);
        cGroup.add(puff);
      });
      this.scene.add(cGroup);
    }
  }

  public setTimeOfDayVisuals(mode: 'day' | 'sunset' | 'night'): void {
    const isLit = mode === 'night' || mode === 'sunset';
    this.streetLampBulbs.forEach(mat => {
      mat.color.setHex(isLit ? 0xFDE047 : 0xE2E8F0);
    });
    this.streetLampGroundGlows.forEach(glow => {
      glow.visible = isLit;
    });
  }

  private buildTrafficLights(): void {
    // 4대 주요 사거리 교차로(±54m)에 신호등 설치
    const lightPositions = [
      { x: -6.8, z: 47.0, rotY: 0, dir: 'north_south' as const },
      { x: 6.8, z: -47.0, rotY: Math.PI, dir: 'north_south' as const },
      { x: 47.0, z: 6.8, rotY: -Math.PI / 2, dir: 'east_west' as const },
      { x: -47.0, z: -6.8, rotY: Math.PI / 2, dir: 'east_west' as const },
      { x: -60.8, z: 47.0, rotY: 0, dir: 'north_south' as const },
      { x: 60.8, z: -47.0, rotY: Math.PI, dir: 'north_south' as const }
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
        stopZone: { x: pos.x, z: pos.z, radius: 7.8 }
      });
    });
  }

  /**
   * 🚸 횡단보도 보행자 시스템 (차량 신호가 빨간불일 때 손을 들고 횡단보도를 건너는 귀여운 보행자들!)
   */
  private buildPedestrians(): void {
    const pedConfigs = [
      { id: 'ped1', name: '초등학생 민수', color: 0x38BDF8, hatColor: 0xFACC15, cx: 0, cz: 48.2, axis: 'x' as const, activeWhenCarRed: 'north_south' as const },
      { id: 'ped2', name: '유치원생 다은이', color: 0xF472B6, hatColor: 0xFACC15, cx: 0, cz: -48.2, axis: 'x' as const, activeWhenCarRed: 'north_south' as const },
      { id: 'ped3', name: '멍멍이 산책 친구', color: 0x34D399, hatColor: 0xFB923C, cx: 48.2, cz: 0, axis: 'z' as const, activeWhenCarRed: 'east_west' as const },
      { id: 'ped4', name: '소방관 아저씨', color: 0xEF4444, hatColor: 0xFEF08A, cx: -48.2, cz: 0, axis: 'z' as const, activeWhenCarRed: 'east_west' as const }
    ];

    pedConfigs.forEach(cfg => {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.45 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.4 });
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1E293B });

      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 8), legMat);
      leftLeg.position.set(-0.12, 0.21, 0);
      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 8), legMat);
      rightLeg.position.set(0.12, 0.21, 0);
      group.add(leftLeg, rightLeg);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.52, 12), bodyMat);
      torso.position.y = 0.62;
      group.add(torso);

      // 안전하게 손들고 건너는 오른팔!
      const raisedArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), bodyMat);
      raisedArm.position.set(0.28, 0.95, 0);
      raisedArm.rotation.z = -0.15;
      group.add(raisedArm);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), skinMat);
      head.position.y = 1.12;
      group.add(head);

      // 노란 안전모자
      const hat = new THREE.Mesh(
        new THREE.SphereGeometry(0.29, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: cfg.hatColor })
      );
      hat.position.y = 1.15;
      group.add(hat);

      const startPos = cfg.axis === 'x'
        ? new THREE.Vector3(cfg.cx - 6.8, 0, cfg.cz)
        : new THREE.Vector3(cfg.cx, 0, cfg.cz - 6.8);
      const endPos = cfg.axis === 'x'
        ? new THREE.Vector3(cfg.cx + 6.8, 0, cfg.cz)
        : new THREE.Vector3(cfg.cx, 0, cfg.cz + 6.8);

      group.position.copy(startPos);
      this.scene.add(group);

      this.pedestrians.push({
        id: cfg.id,
        name: cfg.name,
        mesh: group,
        leftLeg,
        rightLeg,
        startPos,
        endPos,
        progress: 0,
        direction: 1,
        speed: 0.24,
        crosswalkDir: cfg.activeWhenCarRed,
        isCrossing: false
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
   * 실제 가족 사진 기반 귀여운 SD 캐릭터 생성 (선율, 태율, 엄마, 아빠)
   * 몸통은 귀여운 3D SD 복장, 얼굴은 골드 테두리가 둘러진 원형 뱃지 사진
   */
  private createFamilyPassenger(badgeUrl: string, bodyColor: number, pantColor: number): THREE.Group {
    const group = new THREE.Group();

    // 1. 다리 / 하반신
    const legGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.38, 10);
    const legMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.6 });
    [-0.14, 0.14].forEach(lx => {
      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(lx, 0.19, 0);
      group.add(leg);
    });

    // 2. 귀여운 SD 상체 (둥근 셔츠/스웨터)
    const torsoGeom = new THREE.CylinderGeometry(0.28, 0.34, 0.52, 14);
    const torsoMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 0.58;
    group.add(torso);

    // 3. 작은 팔
    const armGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.34, 8);
    [-0.34, 0.34].forEach(ax => {
      const arm = new THREE.Mesh(armGeom, torsoMat);
      arm.position.set(ax, 0.56, 0);
      arm.rotation.z = ax > 0 ? -0.35 : 0.35;
      group.add(arm);
    });

    // 4. 머리 및 사진 뱃지 (앞뒤 양면으로 얼굴 사진이 선명하게 보이도록)
    const textureLoader = new THREE.TextureLoader();
    const faceTex = textureLoader.load(badgeUrl);
    faceTex.colorSpace = THREE.SRGBColorSpace;

    // 머리 지지대 (입체 구체)
    const headBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.4 })
    );
    headBase.position.y = 1.15;
    group.add(headBase);

    // 골드 림 테두리 원형 메달/얼굴 사진
    const badgeGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.06, 32);
    badgeGeom.rotateX(Math.PI / 2);
    const badgeRimMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.5, roughness: 0.3 });
    const badgeFaceMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true });

    // 앞면 메달
    const badgeFront = new THREE.Mesh(badgeGeom, [badgeRimMat, badgeFaceMat, badgeFaceMat]);
    badgeFront.position.set(0, 1.18, 0.28);
    group.add(badgeFront);

    // 애니메이션 및 승차 데이터
    group.userData = { animTime: Math.random() * 5, isBoarded: false, isFamily: true };
    return group;
  }

  /**
   * 6. 8개의 버스 정류장 구축
   * ⚠️ 사용자 규칙 엄수: 우리 주인공 선율이, 태율이, 엄마, 아빠 가족은
   * 전체 맵에서 각각 딱 1명씩만 랜덤 정류장에 유일하게 배치 (중복 절대 금지)
   * 나머지 정류장은 귀여운 동물 친구들이 탑승 대기!
   */
  private buildBusStops(): void {
    const stopsBase = [
      { id: 1, name: '타요 차고지 정류장', icon: '🚌', x: -7.2, z: 26.0, targetStopName: '무지개 유치원 정류장' },
      { id: 2, name: '무지개 유치원 정류장', icon: '🌈', x: 26.0, z: -7.2, targetStopName: '달콤 마트 정류장' },
      { id: 3, name: '달콤 마트 정류장', icon: '🛒', x: 7.2, z: 28.0, targetStopName: '꿈나무 초등학교 정류장' },
      { id: 4, name: '꿈나무 초등학교 정류장', icon: '🏫', x: -26.0, z: -7.2, targetStopName: '튼튼 종합병원 정류장' },
      { id: 5, name: '튼튼 종합병원 정류장', icon: '🏥', x: 61.2, z: -26.0, targetStopName: '타요 놀이공원 정류장' },
      { id: 6, name: '타요 놀이공원 정류장', icon: '🎡', x: 54.0, z: 96.0, targetStopName: '119 용감한 소방서 정류장' },
      { id: 7, name: '119 용감한 소방서 정류장', icon: '🚒', x: -61.2, z: 82.0, targetStopName: '112 경찰서 정류장' },
      { id: 8, name: '112 경찰서 정류장', icon: '🚓', x: -61.2, z: 28.0, targetStopName: '타요 차고지 정류장' }
    ];

    // 가족 4명 (맵 전체에 오직 1개씩만 등장!)
    const familyPool = [
      {
        name: '선율이',
        icon: '👦',
        badge: '/family/sunyul_badge.png',
        bodyColor: 0x38BDF8, // 하늘색 티셔츠
        pantColor: 0x1E293B
      },
      {
        name: '태율이',
        icon: '👶',
        badge: '/family/taeyul_badge.png',
        bodyColor: 0xFACC15, // 노란색 귀여운 티셔츠
        pantColor: 0x0284C7
      },
      {
        name: '엄마',
        icon: '👩',
        badge: '/family/mom_badge.png',
        bodyColor: 0xF472B6, // 핑크 니트
        pantColor: 0x475569
      },
      {
        name: '아빠',
        icon: '👨',
        badge: '/family/dad_badge.png',
        bodyColor: 0x34D399, // 포근한 민트그린
        pantColor: 0x1E3A8A
      }
    ];

    // 동물 친구 풀
    const animalPool = [
      { name: '노란 삐약이', icon: '🐥', color: 0xFFEB3B, isBunny: false },
      { name: '아기 곰돌이', icon: '🐻', color: 0xA1887F, isBunny: false },
      { name: '깡총 토끼', icon: '🐰', color: 0xF8FAFC, isBunny: true },
      { name: '멍멍 강아지', icon: '🐶', color: 0xFDBA74, isBunny: false }
    ];

    // 8개 정류장 인덱스 [0..7] 중 4자리를 비복원 무작위 추출하여 가족 4인 배정
    const stopIndices = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
    const familyIndices = new Set(stopIndices.slice(0, 4));

    let familyIdx = 0;
    let animalIdx = 0;

    stopsBase.forEach((base, idx) => {
      const group = new THREE.Group();
      group.position.set(base.x, 0, base.z);

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
          map: this.createSignBannerTexture(`${base.icon} ${base.name}`, '#0284C7'),
          side: THREE.DoubleSide
        })
      );
      sign.position.set(2.4, 3.2, 0);
      group.add(sign);

      let passengerMesh: THREE.Group;
      let passengerName: string;
      let passengerIcon: string;
      const isFamily = familyIndices.has(idx);

      if (isFamily) {
        const f = familyPool[familyIdx++];
        passengerName = f.name;
        passengerIcon = f.icon;
        passengerMesh = this.createFamilyPassenger(f.badge, f.bodyColor, f.pantColor);
      } else {
        const a = animalPool[animalIdx++];
        passengerName = a.name;
        passengerIcon = a.icon;
        passengerMesh = this.createCutePassenger(a.color, a.isBunny);
      }

      passengerMesh.position.set(2.4, 0, 1.1);
      group.add(passengerMesh);
      this.scene.add(group);

      this.busStops.push({
        id: base.id,
        name: base.name,
        icon: base.icon,
        x: base.x,
        z: base.z,
        targetStopName: base.targetStopName,
        passengerName,
        passengerIcon,
        passengerMesh,
        hasPassenger: true,
        isFamily
      });
    });
  }

  /**
   * 7. 도로 곳곳에 배치된 회전하는 황금 별 코인 (아이들이 운전만 해도 별을 먹는 성취감!)
   */
  private buildCollectibleStars(): void {
    const starPositions = [
      [0, 34], [0, -34], [34, 0], [-34, 0],
      [54, 24], [54, -24], [-54, 24], [-54, -24],
      [24, 54], [-24, 54], [24, -54], [-24, -54],
      [0, 92], [0, -92], [92, 0], [-92, 0],
      [54, 92], [-54, 92], [54, -92], [-54, -92],
      [0, 136], [0, -136], [136, 0], [-136, 0]
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
   * 8. 도로를 달리는 AI 친구 차량들
   * - 긴급 출동 친구들: 패트(경찰차), 프랭크(소방차), 앨리스(구급차)
   * - 중립 시티카: 노란 시티세단, 민트 패밀리카
   * - 🏎️ 그랑프리 F1 머신: 스쿠데리아 페라리 F1 (#16), 메르세데스-AMG 페트로나스 F1 (#44)
   */
  private buildNpcVehicles(): void {
    // 외곽 곡선 순환 고속도로 루프 웨이포인트 (커브 구간을 부드럽게 따라 주행!)
    const outerHighwayWaypoints: [number, number][] = [
      [-95, -136], [0, -136], [95, -136],
      [122, -122], [136, -95],
      [136, 0], [136, 95],
      [122, 122], [95, 136],
      [0, 136], [-95, 136],
      [-122, 122], [-136, 95],
      [-136, 0], [-136, -95],
      [-122, -122]
    ];

    const configs: {
      id: string;
      name: string;
      kind: NpcVehicleKind;
      path: [number, number][];
      speed: number;
      startWaypoint?: number;
      isF1?: boolean;
    }[] = [
      {
        id: 'pat',
        name: '패트 (경찰차)',
        kind: 'pat',
        path: [
          [-54, -54],
          [54, -54],
          [54, 54],
          [-54, 54]
        ],
        speed: 8.2
      },
      {
        id: 'frank',
        name: '프랭크 (소방차)',
        kind: 'frank',
        path: [
          [-54, 136],
          [54, 136],
          [54, 54],
          [-54, 54]
        ],
        speed: 8.6
      },
      {
        id: 'alice',
        name: '앨리스 (구급차)',
        kind: 'alice',
        path: [
          [54, -54],
          [136, -54],
          [136, 54],
          [54, 54]
        ],
        speed: 8.4
      },
      {
        id: 'sedan_yellow',
        name: '노란 시티카',
        kind: 'sedan_yellow',
        path: [
          [54, -54],
          [-54, -54],
          [-54, 54],
          [54, 54]
        ],
        speed: 7.2,
        startWaypoint: 2
      },
      {
        id: 'suv_mint',
        name: '민트 패밀리카',
        kind: 'suv_mint',
        path: [
          [-54, 0],
          [-136, 0],
          [-136, -54],
          [-54, -54]
        ],
        speed: 7.5
      },
      {
        id: 'ferrari_f1',
        name: '페라리 F1 (#16)',
        kind: 'ferrari_f1',
        path: outerHighwayWaypoints,
        speed: 22.5,
        startWaypoint: 0,
        isF1: true
      },
      {
        id: 'mercedes_f1',
        name: '메르세데스 F1 (#44)',
        kind: 'mercedes_f1',
        path: outerHighwayWaypoints,
        speed: 22.0,
        startWaypoint: 8,
        isF1: true
      }
    ];

    configs.forEach(cfg => {
      const built = BusModelFactory.createNpcCarMesh(cfg.kind);
      const waypoints = cfg.path.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
      const startIdx = cfg.startWaypoint ?? 0;
      built.mesh.position.copy(waypoints[startIdx]);
      this.scene.add(built.mesh);

      this.npcVehicles.push({
        id: cfg.id,
        name: cfg.name,
        kind: cfg.kind,
        mesh: built.mesh,
        wheelMeshes: built.wheelMeshes,
        path: waypoints,
        currentWaypoint: (startIdx + 1) % waypoints.length,
        speed: cfg.speed,
        headlights: built.headlights,
        sirenMeshes: built.sirenMeshes,
        isF1: cfg.isF1
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
   * 월드 내 동적 오브젝트(분수대, 소방 타워 불꽃, 물대포, 병원 하트, 보행자, F1/긴급 NPC 차량) 업데이트
   */
  public updateWorldElements(
    delta: number,
    busPos: THREE.Vector3,
    nsState: 'green' | 'yellow' | 'red' = 'green',
    ewState: 'green' | 'yellow' | 'red' = 'red',
    busSpeedAbs: number = 0
  ): {
    collectedStar: boolean;
    triggeredZone: InteractiveZone | null;
    f1PassedBy: string | null;
    pedestrianYielded: boolean;
  } {
    let collectedStar = false;
    let triggeredZone: InteractiveZone | null = null;
    let f1PassedBy: string | null = null;
    let pedestrianYielded = false;
    const nowSec = performance.now() * 0.001;

    // 0. 중앙 로터리 분수대 물방울 점프 애니메이션
    this.fountainDrops.forEach((drop, idx) => {
      const t = (nowSec * 2.2 + idx * 0.35) % 1;
      const ang = (idx / 12) * Math.PI * 2;
      const r = 0.6 + t * 2.4;
      drop.position.set(Math.cos(ang) * r, 1.0 + Math.sin(t * Math.PI) * 2.3, Math.sin(ang) * r);
    });

    // 0-1. 소방서 훈련 타워 3D 불꽃 애니메이션 & 자동 재점화(진화 후 22초 뒤 다시 훈련용 불꽃 생성)
    if (this.fireIntensity < 1.0) {
      this.fireIntensity = Math.min(1.0, this.fireIntensity + delta * 0.045);
    }
    this.fireFlameMeshes.forEach((flame, idx) => {
      const show = this.fireIntensity > 0.25;
      flame.visible = show;
      if (show) {
        const s = (0.75 + Math.sin(nowSec * 12 + idx * 1.7) * 0.28) * this.fireIntensity;
        flame.scale.set(s, s * (1.0 + Math.cos(nowSec * 15 + idx) * 0.25), s);
      }
    });

    // 0-2. 물대포 물방울 파티클 물리 업데이트
    for (let i = this.waterSprayParticles.length - 1; i >= 0; i--) {
      const p = this.waterSprayParticles[i];
      p.life -= delta;
      p.vel.y -= 18 * delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      if (p.life <= 0 || p.mesh.position.y < 0) {
        this.scene.remove(p.mesh);
        this.waterSprayParticles.splice(i, 1);
      }
    }

    // 0-3. 병원 치유 십자가 파티클 둥실둥실 애니메이션
    this.hospitalHeartParticles.forEach((h, idx) => {
      h.position.y = 1.6 + ((nowSec * 1.1 + idx * 0.5) % 3.2);
      h.rotation.y += 1.8 * delta;
    });

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

    // 4. 인터랙티브 시설 (차고지 문 개폐, 세차장, 충전소, 경찰서, 소방서, 병원) 판정
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

    // 6. 🚸 횡단보도 보행자 신호 연동 이동 (차량 신호가 적색일 때 횡단보도 건너기!)
    this.pedestrians.forEach(ped => {
      const carSignal = ped.crosswalkDir === 'north_south' ? nsState : ewState;
      ped.isCrossing = carSignal === 'red';

      if (ped.isCrossing) {
        ped.progress += ped.speed * delta * ped.direction;
        if (ped.progress >= 1) {
          ped.progress = 1;
          ped.direction = -1;
        } else if (ped.progress <= 0) {
          ped.progress = 0;
          ped.direction = 1;
        }
        ped.mesh.position.lerpVectors(ped.startPos, ped.endPos, ped.progress);
        const lookTarget = ped.direction === 1 ? ped.endPos : ped.startPos;
        ped.mesh.lookAt(lookTarget.x, ped.mesh.position.y, lookTarget.z);

        // 걷는 다리 스윙 애니메이션
        const swing = Math.sin(nowSec * 10) * 0.45;
        ped.leftLeg.rotation.x = swing;
        ped.rightLeg.rotation.x = -swing;

        // 플레이어가 보행자 건너는 중 정지선 앞에 멈춰서 양보하면 보행자 보호 칭찬!
        const distToPed = ped.mesh.position.distanceTo(busPos);
        if (distToPed < 11.5 && distToPed > 3.5 && busSpeedAbs < 0.8) {
          pedestrianYielded = true;
        }
      } else {
        // 초록불일 때는 인도 끝에서 안전하게 대기
        ped.progress = ped.direction === 1 ? 0 : 1;
        ped.mesh.position.lerpVectors(ped.startPos, ped.endPos, ped.progress);
        ped.leftLeg.rotation.x = 0;
        ped.rightLeg.rotation.x = 0;
      }
    });

    // 7. AI NPC 차량 (패트, 프랭크, 앨리스, 시티카, 페라리 F1, 메르세데스 F1) 주행 업데이트
    this.npcVehicles.forEach(npc => {
      // NPC 긴급차량 경광등 점멸
      if (npc.sirenMeshes && npc.sirenMeshes.length >= 2) {
        const strobe = Math.floor(nowSec * 9) % 2 === 0;
        npc.sirenMeshes[0].scale.setScalar(strobe ? 1.25 : 0.85);
        npc.sirenMeshes[1].scale.setScalar(!strobe ? 1.25 : 0.85);
      }

      const distToPlayer = npc.mesh.position.distanceTo(busPos);
      if (npc.isF1 && distToPlayer < 16 && distToPlayer > 6) {
        f1PassedBy = npc.name;
      }
      if (distToPlayer < 7.5) return; // 플레이어 차량과 부딪히지 않게 양보 정지

      const target = npc.path[npc.currentWaypoint];
      const dir = new THREE.Vector3().subVectors(target, npc.mesh.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist < 2.2) {
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

    return { collectedStar, triggeredZone, f1PassedBy, pedestrianYielded };
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
