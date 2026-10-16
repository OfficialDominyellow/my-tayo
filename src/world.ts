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
  TrafficLightData,
  WeatherType
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
  private garageBayLights: THREE.PointLight[] = [];
  private repairLiftPlatform: THREE.Group | null = null;
  private repairRobotArms: THREE.Object3D[] = [];
  private chargingEnergyRings: THREE.Mesh[] = [];
  private ferrisWheel: THREE.Group | null = null;
  private carouselGroup: THREE.Group | null = null;
  private windmillBlades: THREE.Group | null = null;
  private lighthouseBeam: THREE.Group | null = null;
  private hotAirBalloons: { group: THREE.Group; baseY: number; phase: number; speed: number; radius: number; cx: number; cz: number }[] = [];
  private yachts: { group: THREE.Group; baseX: number; baseZ: number; phase: number }[] = [];
  public expressTrain: { group: THREE.Group; angle: number; wheels: THREE.Object3D[] } | null = null;
  private rainbowGroup: THREE.Group | null = null;
  private weatherParticles: THREE.Points | null = null;
  public currentWeather: WeatherType = 'clear';
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
    // 1. 광활한 상업용 메트로폴리스 오픈월드 지면 (820m x 820m)
    const groundSize = 820;
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x689F38, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.physics.addGround(groundSize, groundSize);

    // 맵 외곽 안전 울타리
    const wallHalf = groundSize / 2 - 12;
    this.physics.addBoxCollider(0, 3, wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(0, 3, -wallHalf, wallHalf, 3, 1);
    this.physics.addBoxCollider(wallHalf, 3, 0, 1, 3, wallHalf);
    this.physics.addBoxCollider(-wallHalf, 3, 0, 1, 3, wallHalf);

    // 2. 모듈형 진짜 도로망 구축 (단순 타일 겹침 ZERO! 중앙 로터리 + 사거리 + 삼거리 + 외곽 곡선 커브 서킷 + 남쪽 해안대로 + 미니맵 100% 동기화)
    this.buildRoads();

    // 3. 무지개 스카이 브릿지 전망대 & 경사로 구축 (도로를 침범하지 않는 전용 공원 블록!)
    this.buildTestRamp();

    // 4. 인터랙티브 시설 8종 (모두 도로 위가 아닌 전용 부지 + 아스팔트 진입로 완비!)
    this.buildTayoGarage(-28, 28);         // 🏠 꼬마버스 차고지 (문 열리면 차고 내부로 실제 입차 가능!)
    this.buildCarWash(88, 30);             // 🫧 보글보글 자동 세차장 (도로 옆 전용 드라이브스루 부지!)
    this.buildChargingStation(-88, -30);   // ⛽ 싱싱 주유소 & 초고속 충전소 (도로 옆 전용 주유 타운 부지!)
    this.buildRepairShop(-30, 86);         // 🔧 하나 누나의 척척 정비소 (유압 리프트 & 로봇 렌치 튜닝!)
    this.buildF1PitStop(28, -158);         // 🏎️ F1 그랑프리 피트스탑 (북쪽 서킷 전용 피트레인!)
    this.buildPoliceStation(-88, 28);      // 🚓 112 용감한 경찰서
    this.buildFireStation(-88, 86);        // 🚒 119 용감한 소방서 & 화재 진압 타워
    this.buildHospital(88, -28);           // 🏥 튼튼 어린이 종합병원

    // 5. 다채로운 도시 테마 지구 (다운타운 마천루, 남쪽 에메랄드 해변 & 마리나 항구 & 등대, 놀이공원 회전목마, 하늘 열기구, 외곽 순환 기차)
    this.buildLandmarksAndBuildings();
    this.buildDowntownSkyscrapers();
    this.buildBeachAndHarborDistrict();
    this.buildThemeParkCarouselAndBalloons();
    this.buildExpressTrainSystem();
    this.buildWeatherAndRainbowSystem();

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

    // 8. 🏖️ 남쪽 에메랄드 해안대로 (Coastal Boulevard, z = 184m) 연결 도로망
    const RBeach = 184;
    [-R1, 0, R1].forEach(lx => {
      addIntersectionNode(lx, RBeach);
      addStraightSegment(lx, R2 + halfW, lx, RBeach - halfW);
    });
    addStraightSegment(-R1 + halfW, RBeach, -halfW, RBeach);
    addStraightSegment(halfW, RBeach, R1 - halfW, RBeach);
    addStraightSegment(-92, RBeach, -R1 - halfW, RBeach);
    addStraightSegment(R1 + halfW, RBeach, 92, RBeach);
  }

  /**
   * 도로에서 각 시설 부지로 자연스럽게 이어지는 아스팔트 진입로(Driveway Apron) 생성 헬퍼
   */
  private addDrivewayApron(cx: number, cz: number, w: number, d: number, colorHex: number = 0x334155): void {
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(cx, 0.021, cz);
    apron.receiveShadow = true;
    this.scene.add(apron);
  }

  /**
   * 🏠 1. 타요 4총사 아치형 차고지 (문 열리면 차고 안으로 직접 들어갈 수 있는 진짜 내부 공간 구현!)
   */
  private buildTayoGarage(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const width = 24;
    const depth = 12;
    const height = 6.6;

    // 남쪽 대로(z=54)와 이어지는 넓은 진입 마당 & 차고 내부 에폭시 바닥
    this.addDrivewayApron(x, z + 13, 24, 16, 0x475569);

    const interiorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.6, depth - 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.4, metalness: 0.1 })
    );
    interiorFloor.rotation.x = -Math.PI / 2;
    interiorFloor.position.set(0, 0.03, 0);
    interiorFloor.receiveShadow = true;
    group.add(interiorFloor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xFFFBEB, roughness: 0.5 });

    // 차고 뒷벽 (Back Wall)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.8), wallMat);
    backWall.position.set(0, height / 2, -depth / 2 + 0.4);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    // 차고 좌/우 외벽 (Side Walls)
    [-width / 2 + 0.4, width / 2 - 0.4].forEach(wx => {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, depth), wallMat);
      sideWall.position.set(wx, height / 2, 0);
      sideWall.castShadow = true;
      sideWall.receiveShadow = true;
      group.add(sideWall);
    });

    // 정면 상단 인방보(Lintel: 셔터 도어 위쪽 외벽)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(width, 2.1, 0.9), wallMat);
    lintel.position.set(0, height - 1.05, depth / 2 - 0.35);
    group.add(lintel);

    // 파란색 둥근 아치형 지붕
    const roofGeom = new THREE.CylinderGeometry(depth * 0.55, depth * 0.55, width + 0.8, 20, 1, false, 0, Math.PI);
    roofGeom.rotateZ(Math.PI / 2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.35 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = height;
    roof.scale.y = 0.45;
    roof.castShadow = true;
    group.add(roof);

    // 4개의 베이 (120 타요, 1000 로기, 02 라니, 1339 가니) + 내부 조명 + 공구함 + 개폐형 셔터 도어
    const bays = [
      { num: '120', color: '#0080EE', xOffset: -8.2 },
      { num: '1000', color: '#46B81D', xOffset: -2.75 },
      { num: '02', color: '#FFCC00', xOffset: 2.75 },
      { num: '1339', color: '#E22B24', xOffset: 8.2 }
    ];

    // 베이 사이 얇은 전면 기둥
    [-5.48, 0, 5.48].forEach(px => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, height, 0.9), wallMat);
      pillar.position.set(px, height / 2, depth / 2 - 0.35);
      group.add(pillar);
    });

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFACC15 });

    bays.forEach(bay => {
      // 베이 내부 바닥 노란색 주차 스토퍼 & 가이드 라인
      [-2.1, 2.1].forEach(lx => {
        const pLine = new THREE.Mesh(new THREE.PlaneGeometry(0.18, depth - 2.2), lineMat);
        pLine.rotation.x = -Math.PI / 2;
        pLine.position.set(bay.xOffset + lx, 0.04, 0.2);
        group.add(pLine);
      });

      // 베이 안쪽 뒷벽 빨간 공구 캐비닛 & 정비 보드
      const cabinet = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.2, 0.7),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bay.color), roughness: 0.3, metalness: 0.3 })
      );
      cabinet.position.set(bay.xOffset, 1.1, -depth / 2 + 1.1);
      group.add(cabinet);

      // 베이 천장 따뜻한 포인트 라이트
      const bayLight = new THREE.PointLight(0xFFFBEB, 1.2, 12);
      bayLight.position.set(bay.xOffset, height - 0.6, 0);
      group.add(bayLight);
      this.garageBayLights.push(bayLight);

      // 슬라이딩 차고 셔터 도어 (가까이 오면 위로 스르륵 열려서 안으로 진입 가능!)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(4.75, 4.4, 0.14),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(bay.color), roughness: 0.32, metalness: 0.15 })
      );
      door.position.set(bay.xOffset, 2.2, depth / 2 - 0.25);
      group.add(door);
      this.garageDoors.push(door);

      // 노선 번호 뱃지 간판
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 1.05),
        new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture(bay.num, bay.color) })
      );
      sign.position.set(bay.xOffset, 5.25, depth / 2 + 0.16);
      group.add(sign);
    });

    // 상단 대형 간판
    const mainBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(13.5, 2.4),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🏠 꼬마버스 차고지 (안으로 들어오세요!)', '#0284C7'),
        side: THREE.DoubleSide
      })
    );
    mainBanner.position.set(0, height + 2.5, depth / 2 - 0.2);
    group.add(mainBanner);

    this.scene.add(group);

    // ⚠️ 물리 콜라이더: 뒷벽과 좌우 외벽에만 콜라이더를 두어 문이 열리면 차고 내부로 실제 운전해 들어갈 수 있음!
    this.physics.addBoxCollider(x, height / 2, z - depth / 2 + 0.4, width / 2, height / 2, 0.5);
    this.physics.addBoxCollider(x - width / 2 + 0.4, height / 2, z, 0.5, height / 2, depth / 2);
    this.physics.addBoxCollider(x + width / 2 - 0.4, height / 2, z, 0.5, height / 2, depth / 2);

    this.interactiveZones.push({
      id: 'garage',
      name: '꼬마버스 차고지',
      icon: '🏠',
      color: '#0284C7',
      type: 'garage',
      x: x,
      z: z + 1.0, // 차고 내부 깊숙이 들어왔을 때 반응!
      radius: 7.5,
      cooldown: 0,
      group
    });
  }

  /**
   * 🫧 2. 보글보글 자동 세차장 (도로 위가 아닌 전용 부지 + 남북 진입로 + 회전 브러쉬 2쌍 + 물줄기 아치!)
   */
  private buildCarWash(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 남쪽 도로(z=54) 및 북쪽 도로(z=0) 방향과 연결되는 전용 드라이브스루 아스팔트 진입로
    this.addDrivewayApron(x, z, 14, 38, 0x334155);

    // 파란색 방수 바닥 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 18),
      new THREE.MeshStandardMaterial({ color: 0x0284C7, roughness: 0.25, metalness: 0.15 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.032;
    group.add(pad);

    // 양쪽 세차 터널 유리/메탈 벽 기둥 (통과 가능하도록 좌우로만 콜라이더 배치)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xE0F2FE, roughness: 0.2, metalness: 0.2 });
    [-4.5, 4.5].forEach(wx => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.5, 11.5), wallMat);
      wall.position.set(wx, 2.75, 0);
      wall.castShadow = true;
      group.add(wall);
      this.physics.addBoxCollider(x + wx, 2.75, z, 0.45, 2.75, 5.75);
    });

    // 상단 세차장 아치 지붕 & 간판
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(10.2, 0.95, 12.0),
      new THREE.MeshStandardMaterial({ color: 0x0369A1, roughness: 0.3 })
    );
    roof.position.set(0, 5.6, 0);
    group.add(roof);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9.2, 1.9),
      new THREE.MeshBasicMaterial({ map: this.createSignBannerTexture('🫧 보글보글 자동 세차장', '#0284C7') })
    );
    sign.position.set(0, 6.9, 6.1);
    group.add(sign);

    const signBack = sign.clone();
    signBack.position.z = -6.1;
    signBack.rotation.y = Math.PI;
    group.add(signBack);

    // 회전하는 대형 3D 스펀지 브러쉬 롤러 4개 (좌우 2쌍)
    const brushMat1 = new THREE.MeshStandardMaterial({ color: 0x00B0FF, roughness: 0.5 });
    const brushMat2 = new THREE.MeshStandardMaterial({ color: 0xFFD600, roughness: 0.5 });
    [
      [-3.0, -2.5],
      [3.0, -2.5],
      [-3.0, 2.5],
      [3.0, 2.5]
    ].forEach(([bx, bz], idx) => {
      const brushGroup = new THREE.Group();
      brushGroup.position.set(bx, 2.4, bz);
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 4.3, 14),
        idx % 2 === 0 ? brushMat1 : brushMat2
      );
      brushGroup.add(cyl);
      group.add(brushGroup);
      this.carWashBrushes.push(brushGroup);
    });

    // 보글보글 비눗방울 구체들
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.78,
      roughness: 0.08,
      metalness: 0.1
    });
    for (let i = 0; i < 22; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.24 + Math.random() * 0.28, 12, 12), bubbleMat);
      b.position.set((Math.random() - 0.5) * 6.4, 0.8 + Math.random() * 4.0, (Math.random() - 0.5) * 9.5);
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
      radius: 6.2,
      cooldown: 0,
      group
    });
  }

  /**
   * ⛽ 3. 싱싱 주유소 & 초고속 충전소 (도로 밖 전용 서비스 타운 부지 + 주유기 & 초고속 충전기 + 에너지 링!)
   */
  private buildChargingStation(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 도로(z=-54 및 z=0)와 부드럽게 연결되는 전용 주유소 진입로
    this.addDrivewayApron(x, z, 18, 38, 0x334155);

    // 에메랄드 그린 & 옐로우 주유/충전 아일랜드 패드 바닥
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 18),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.45 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.032;
    group.add(pad);

    // 주유소 아일랜드 연석 및 주유기/충전기 기둥 (우측 아일랜드에 배치해 좌측 주유 레인으로 통과)
    const island = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.25, 12.5),
      new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.6 })
    );
    island.position.set(4.2, 0.13, 0);
    group.add(island);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, metalness: 0.3, roughness: 0.3 });
    [-4.2, 4.2].forEach(pz => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 5.8, 12), pillarMat);
      pillar.position.set(4.2, 2.9, pz);
      group.add(pillar);
    });
    this.physics.addBoxCollider(x + 4.2, 2.6, z, 1.3, 2.6, 6.2);

    // ⛽ 노란/빨간 주유기 2대 + ⚡ 민트 초고속 전기 충전기 1대
    const gasPumpMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.25, metalness: 0.2 });
    const evPumpMat = new THREE.MeshStandardMaterial({ color: 0x10B981, roughness: 0.25, metalness: 0.3 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });

    [-2.6, 0, 2.6].forEach((pz, idx) => {
      const isEv = idx === 1;
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.4, 0.95), isEv ? evPumpMat : gasPumpMat);
      pump.position.set(4.2, 1.35, pz);
      group.add(pump);

      // 계기판 LCD 스크린
      const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.45), screenMat);
      lcd.rotation.y = -Math.PI / 2;
      lcd.position.set(3.66, 1.75, pz);
      group.add(lcd);

      // 주유건 노즐 홀더
      const nozzle = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.55, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xEF4444 })
      );
      nozzle.position.set(3.62, 1.15, pz + 0.3);
      group.add(nozzle);
    });

    // 주유 정차 구역 바닥 홀로그램 에너지 링 (회전 애니메이션)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x34D399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const energyRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.1, 32), ringMat);
    energyRing.rotation.x = -Math.PI / 2;
    energyRing.position.set(-0.6, 0.06, 0);
    group.add(energyRing);
    this.chargingEnergyRings.push(energyRing);

    // 상단 대형 주유소 캐노피 지붕 & 양면 네온 간판
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.9, 13.5),
      new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.28 })
    );
    canopy.position.set(1.0, 5.8, 0);
    group.add(canopy);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(10.2, 2.0),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('⛽ 싱싱 주유소 & ⚡ 초고속 충전소', '#059669'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(1.0, 7.1, 6.8);
    group.add(sign);

    const signBack = sign.clone();
    signBack.position.z = -6.8;
    signBack.rotation.y = Math.PI;
    group.add(signBack);

    this.scene.add(group);

    this.interactiveZones.push({
      id: 'station',
      name: '싱싱 주유소 & 충전소',
      icon: '⛽',
      color: '#10B981',
      type: 'station',
      x: x - 0.6,
      z,
      radius: 6.4,
      cooldown: 0,
      group
    });
  }

  /**
   * 🔧 3-B. 하나 누나의 척척 정비소 (Hana's Auto Repair & Tuning Shop - 유압 리프트 & 로봇 렌치 암!)
   */
  private buildRepairShop(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 도로와 연결되는 정비소 앞마당 진입로
    this.addDrivewayApron(x, z - 12, 20, 18, 0x334155);

    // 오렌지 & 다크그레이 정비소 패드
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    group.add(pad);

    // 정비소 후면 본관 워크숍 건물
    const workshop = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6.4, 6.5),
      new THREE.MeshStandardMaterial({ color: 0xF97316, roughness: 0.4 })
    );
    workshop.position.set(0, 3.2, 5.2);
    workshop.castShadow = true;
    workshop.receiveShadow = true;
    group.add(workshop);
    this.physics.addBoxCollider(x, 3.2, z + 5.2, 8.0, 3.2, 3.25);

    // 정비 베이 캐노피 지붕 (앞쪽으로 돌출되어 아래에서 차량 정비!)
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(15.5, 0.7, 9.5),
      new THREE.MeshStandardMaterial({ color: 0xEA580C, roughness: 0.35 })
    );
    canopy.position.set(0, 6.1, -1.2);
    group.add(canopy);

    // 좌우 노란색 H빔 유압 리프트 기둥 2개 (가운데로 차량 진입 가능!)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.4, roughness: 0.3 });
    [-4.8, 4.8].forEach(px => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.75, 5.8, 0.75), postMat);
      post.position.set(px, 2.9, -1.5);
      group.add(post);
      this.physics.addBoxCollider(x + px, 2.9, z - 1.5, 0.4, 2.9, 0.4);
    });

    // 상하로 움직이는 3D 유압 리프트 플랫폼 & 회전하는 로봇 렌치 암 2기
    const liftGroup = new THREE.Group();
    liftGroup.position.set(0, 0.08, -1.5);
    [-1.15, 1.15].forEach(rx => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.14, 6.2),
        new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.5, roughness: 0.3 })
      );
      rail.position.set(rx, 0, 0);
      liftGroup.add(rail);
    });
    group.add(liftGroup);
    this.repairLiftPlatform = liftGroup;

    // 좌우 자동 로봇 정비 암 (차량이 들어오면 윙윙 회전하며 타이어/엔진 튜닝!)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, metalness: 0.6, roughness: 0.25 });
    [-3.8, 3.8].forEach(ax => {
      const armPivot = new THREE.Group();
      armPivot.position.set(ax, 1.8, -1.5);
      const armBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 0.28), armMat);
      armBar.position.x = ax < 0 ? 0.6 : -0.6;
      const wrenchHead = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xFDE047, metalness: 0.7 })
      );
      wrenchHead.rotation.z = Math.PI / 2;
      wrenchHead.position.x = ax < 0 ? 1.25 : -1.25;
      armPivot.add(armBar, wrenchHead);
      group.add(armPivot);
      this.repairRobotArms.push(armPivot);
    });

    // 정비소 타이어 랙 데코레이션 (우측 벽면)
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 10, 18), tireMat);
      tire.position.set(-5.8 + i * 1.4, 0.8, 1.6);
      group.add(tire);
    }

    // 간판
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 2.1),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🔧 하나 누나의 척척 정비소', '#EA580C'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(0, 7.6, -1.2);
    group.add(sign);

    this.scene.add(group);

    this.interactiveZones.push({
      id: 'repair_shop',
      name: '하나 누나의 척척 정비소',
      icon: '🔧',
      color: '#F97316',
      type: 'repair_shop',
      x,
      z: z - 1.5,
      radius: 6.5,
      cooldown: 0,
      group
    });
  }

  /**
   * 🏎️ 3-C. F1 그랑프리 피트스탑 (북쪽 외곽 서킷 옆 드라이브스루 피트레인 & 2.1초 타이어 교체 존!)
   */
  private buildF1PitStop(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 외곽 서킷(z=-136)과 연결되는 피트레인 아스팔트
    this.addDrivewayApron(x, z + 10, 28, 18, 0x1E293B);

    // 피트스탑 본관 개러지 건물 (z - 5 위치에 배치해 앞쪽 피트레인으로 차량 통과!)
    const garage = new THREE.Mesh(
      new THREE.BoxGeometry(22, 6.2, 7.5),
      new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.35, metalness: 0.3 })
    );
    garage.position.set(0, 3.1, -4.5);
    garage.castShadow = true;
    group.add(garage);
    this.physics.addBoxCollider(x, 3.1, z - 4.5, 11.0, 3.1, 3.75);

    // 페라리 레드 & 체커기 스타일 상단 캐노피
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(22.4, 0.85, 11.5),
      new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.3 })
    );
    canopy.position.set(0, 5.9, -0.5);
    group.add(canopy);

    // 피트박스 정차 그리드 바닥 마킹 (빨강/흰색 연석)
    const pitBox = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5.2),
      new THREE.MeshBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0.65 })
    );
    pitBox.rotation.x = -Math.PI / 2;
    pitBox.position.set(0, 0.04, 2.5);
    group.add(pitBox);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 2.1),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🏎️ F1 그랑프리 피트스탑 (PIT IN)', '#DC2626'),
        side: THREE.DoubleSide
      })
    );
    sign.position.set(0, 7.4, 4.8);
    group.add(sign);

    this.scene.add(group);

    this.interactiveZones.push({
      id: 'f1_pitstop',
      name: 'F1 그랑프리 피트스탑',
      icon: '🏎️',
      color: '#DC2626',
      type: 'f1_pitstop',
      x,
      z: z + 2.5,
      radius: 6.8,
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
    const fireWorldPos = new THREE.Vector3(-88 + 9.5, 2.0, 86 + 4.5);
    if (origin.distanceTo(fireWorldPos) < 30 && this.fireIntensity > 0.1) {
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
   * 7. 무지개 스카이 브릿지 전망대 & 안전 난간 경사로 (도로를 침범하지 않는 전용 공원 블록 x=88, z=-114~-78)
   */
  private buildTestRamp(): void {
    const rx = 88;
    const rz = -112;
    const rWidth = 9.4;
    const rHeight = 2.6;
    const rLength = 16.0;

    const angleX = Math.atan2(rHeight, rLength);
    const rampLength = Math.sqrt(rLength * rLength + rHeight * rHeight);

    const rampGeom = new THREE.BoxGeometry(rWidth, 0.35, rampLength);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.5 });
    const rampMesh = new THREE.Mesh(rampGeom, rampMat);
    rampMesh.position.set(rx, rHeight / 2, rz);
    rampMesh.rotation.x = angleX;
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    this.scene.add(rampMesh);

    // 언덕 위 평평한 전망 데크
    const deckGeom = new THREE.BoxGeometry(rWidth, 0.35, 11.0);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.4 });
    const deckMesh = new THREE.Mesh(deckGeom, deckMat);
    deckMesh.position.set(rx, rHeight, rz + rLength / 2 + 5.5);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    this.scene.add(deckMesh);

    // 내려가는 반대쪽 경사로 연결 (양방향 통과 가능한 무지개 육교!)
    const downRampMesh = rampMesh.clone();
    downRampMesh.position.set(rx, rHeight / 2, rz + rLength + 11.0);
    downRampMesh.rotation.x = -angleX;
    this.scene.add(downRampMesh);

    // 물리 콜라이더 등록 (올라가는 경사로 + 상단 데크 + 내려가는 경사로)
    this.physics.addRamp(rx, 0, rz, rWidth, rHeight, rLength, 0);
    this.physics.addBoxCollider(rx, rHeight, rz + rLength / 2 + 5.5, rWidth / 2, 0.18, 5.5);
    this.physics.addRamp(rx, 0, rz + rLength + 11.0, rWidth, rHeight, rLength, Math.PI);
  }

  /**
   * 8. 디테일한 3D 랜드마크 건물들 (유치원, 초등학교, 마트, 그랑프리 메인 관람석, 대관람차, 풍차 등)
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
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08 });
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

    // 주요 랜드마크 건물 배치 (모두 도로에서 떨어진 블록 내부!)
    addDetailedBuilding(-28, -28, 16, 11, 7.0, 0xFDE047, 'school', '🏫 꿈나무 초등학교', '#CA8A04');
    addDetailedBuilding(28, -28, 14, 11, 6.2, 0xF9A8D4, 'pitched', '🌈 무지개 유치원', '#DB2777');
    addDetailedBuilding(28, 28, 13, 11, 6.2, 0x7DD3FC, 'mart', '🛒 달콤 마트', '#0284C7');
    addDetailedBuilding(-28, -158, 20, 9, 6.5, 0x1E293B, 'flat', '🏆 그랑프리 메인 스타디움', '#0284C7');

    // 외곽 마을 주택 & 타운 단지 (도로 및 인터랙티브 시설과 절대 겹치지 않는 전용 블록!)
    const houseColors = [0xFDBA74, 0xBEF264, 0x93C5FD, 0xF9A8D4, 0xC4B5FD, 0xFDE047];
    const houseCoords = [
      { x: 84, z: 84 },
      { x: -84, z: -84 },
      { x: 162, z: 26 },
      { x: -162, z: 26 },
      { x: 162, z: 84 },
      { x: -162, z: -84 },
      { x: 84, z: 158 },
      { x: -84, z: 158 }
    ];
    houseCoords.forEach((p, idx) => {
      addDetailedBuilding(p.x, p.z, 8.8, 8.8, 5.2, houseColors[idx % houseColors.length], 'pitched');
    });

    // 놀이공원 대관람차 (북동쪽 외곽 랜드마크!)
    this.buildFerrisWheel(98, 98);

    // 풍차 마을 대형 풍차 (남서쪽 외곽 랜드마크!)
    this.buildWindmill(-98, -98);
  }

  /**
   * 🏙️ 8-A. 센트럴 다운타운 마천루 지구 (유리 커튼월 고층 빌딩, 네온 루프탑 사인, 미래형 AI 연구소!)
   */
  private buildDowntownSkyscrapers(): void {
    const towers = [
      { x: -28, z: -86, w: 13, d: 13, h: 24, color: 0x0284C7, neon: '#38BDF8', title: '🏙️ TAYO SOTA TOWER' },
      { x: 28, z: -86, w: 12, d: 12, h: 19, color: 0x6366F1, neon: '#A855F7', title: '🤖 2026 AI 로봇 연구소' },
      { x: 28, z: 86, w: 13, d: 12, h: 21, color: 0x0EA5E9, neon: '#F43F5E', title: '🎬 키즈 미디어 방송국' },
      { x: -162, z: -26, w: 14, d: 14, h: 22, color: 0x1E293B, neon: '#10B981', title: '🌐 에코 스마트 시티홀' }
    ];

    towers.forEach(t => {
      const group = new THREE.Group();
      group.position.set(t.x, 0, t.z);

      // 유리 커튼월 본체 (고광택 PBR 메탈릭/글래스 질감)
      const bodyMat = new THREE.MeshStandardMaterial({
        color: t.color,
        roughness: 0.15,
        metalness: 0.72
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), bodyMat);
      body.position.y = t.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 수평 LED 발광 스카이라인 스트립 (블룸 효과와 결합되어 빛남!)
      const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(t.neon) });
      for (let y = 4; y < t.h - 1; y += 3.2) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.18, 0.22, t.d + 0.18), glowMat);
        band.position.y = y;
        group.add(band);
      }

      // 옥상 헬리패드 & 첨탑 안테나
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.35, 5.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.8 })
      );
      spire.position.y = t.h + 2.75;
      group.add(spire);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xFF1744 })
      );
      beacon.position.y = t.h + 5.6;
      group.add(beacon);

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(11.5, 2.2),
        new THREE.MeshBasicMaterial({
          map: this.createSignBannerTexture(t.title, t.neon),
          side: THREE.DoubleSide
        })
      );
      sign.position.set(0, t.h + 1.5, t.d / 2 + 0.2);
      group.add(sign);

      this.scene.add(group);
      this.physics.addBoxCollider(t.x, t.h / 2, t.z, t.w / 2, t.h / 2, t.d / 2);
    });
  }

  /**
   * 🏖️ 8-B. 남쪽 에메랄드 해변 & 마리나 항구 & 회전 등대 & 3D 세일링 요트 지구 (z = 192 ~ 295)
   */
  private buildBeachAndHarborDistrict(): void {
    // 1. 황금빛 모래사장 해변 (z = 192 ~ 218)
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 30),
      new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.018, 206);
    sand.receiveShadow = true;
    this.scene.add(sand);

    // 2. 에메랄드 오션 바다 (z = 220 ~ 320)
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 110),
      new THREE.MeshStandardMaterial({
        color: 0x0284C7,
        roughness: 0.12,
        metalness: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.025, 272);
    this.scene.add(ocean);
    // 바다에 빠지지 않도록 해안선 안전 방파제 콜라이더 배치
    this.physics.addBoxCollider(0, 2, 220, 230, 2, 1.0);

    // 3. 해변 파라솔 & 야자수 (Palm Trees)
    const parasolColors = [0xEF4444, 0x3B82F6, 0xFACC15, 0xEC4899, 0x10B981];
    [-75, -42, -16, 16, 42, 75].forEach((bx, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(bx, 0, 202);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
      );
      pole.position.y = 1.4;
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(2.1, 0.9, 12),
        new THREE.MeshStandardMaterial({ color: parasolColors[idx % parasolColors.length] })
      );
      umbrella.position.y = 2.8;
      pGroup.add(pole, umbrella);
      this.scene.add(pGroup);
    });

    // 4. 마리나 우드 데크 부두 (Marina Pier, x = 0, z = 200 ~ 236)
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.45, 34),
      new THREE.MeshStandardMaterial({ color: 0x92400E, roughness: 0.75 })
    );
    pier.position.set(0, 0.25, 216);
    this.scene.add(pier);

    const pierSign = new THREE.Mesh(
      new THREE.PlaneGeometry(10.5, 2.0),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture('🏖️ 타요 에메랄드 해변 & 마리나 항구', '#0284C7'),
        side: THREE.DoubleSide
      })
    );
    pierSign.position.set(0, 4.5, 196);
    this.scene.add(pierSign);

    // 5. 바다 위를 둥실둥실 떠다니는 3D 럭셔리 세일링 요트 3척
    const yachtSailColors = [0xFFFFFF, 0xFEF08A, 0xBAE6FD];
    [-48, 24, 68].forEach((yx, idx) => {
      const yGroup = new THREE.Group();
      const yz = 236 + (idx % 2) * 14;
      yGroup.position.set(yx, 0.3, yz);

      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.2, 7.6),
        new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.2 })
      );
      hull.position.y = 0.6;
      yGroup.add(hull);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 8.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xCBD5E1 })
      );
      mast.position.y = 4.8;
      yGroup.add(mast);

      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 6.8, 3),
        new THREE.MeshStandardMaterial({ color: yachtSailColors[idx % yachtSailColors.length], side: THREE.DoubleSide })
      );
      sail.position.set(0, 5.0, 0.4);
      yGroup.add(sail);

      this.scene.add(yGroup);
      this.yachts.push({ group: yGroup, baseX: yx, baseZ: yz, phase: idx * 1.7 });
    });

    // 6. 🚨 해안 절벽 3D 빨간 등대 & 360도 회전 서치라이트 빔 (x = 96, z = 208)
    const lhGroup = new THREE.Group();
    lhGroup.position.set(96, 0, 208);

    const lhBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.4, 18, 16),
      new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.4 })
    );
    lhBase.position.y = 9.0;
    lhBase.castShadow = true;
    lhGroup.add(lhBase);

    // 등대 흰색 줄무늬 밴드 2개
    [5.5, 12.5].forEach(by => {
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(2.85 - by * 0.05, 3.05 - by * 0.05, 3.0, 16),
        new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 })
      );
      stripe.position.y = by;
      lhGroup.add(stripe);
    });

    // 등대 랜턴 룸 & 회전 불빛 빔
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 2.6, 12),
      new THREE.MeshBasicMaterial({ color: 0xFEF08A })
    );
    lantern.position.y = 19.2;
    lhGroup.add(lantern);

    const beamPivot = new THREE.Group();
    beamPivot.position.y = 19.2;
    const beamCone = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 28, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xFEF08A,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    beamCone.rotation.x = Math.PI / 2;
    beamCone.position.z = 14;
    beamPivot.add(beamCone);
    lhGroup.add(beamPivot);
    this.lighthouseBeam = beamPivot;

    this.scene.add(lhGroup);
    this.physics.addCylinderCollider(96, 9, 208, 3.4, 9);
  }

  /**
   * 🎠 8-C. 원더랜드 회전목마(Carousel) & 🎈 하늘 위를 나는 3D 열기구 선단
   */
  private buildThemeParkCarouselAndBalloons(): void {
    // 1. 대관람차 옆 회전목마 (x = 114, z = 82)
    const cGroup = new THREE.Group();
    cGroup.position.set(114, 0, 82);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.8, 0.6, 24),
      new THREE.MeshStandardMaterial({ color: 0xFBBF24, metalness: 0.3, roughness: 0.3 })
    );
    base.position.y = 0.3;
    cGroup.add(base);

    const centerPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 5.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xFEF08A, metalness: 0.5 })
    );
    centerPole.position.y = 3.1;
    cGroup.add(centerPole);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(6.2, 2.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xEC4899, roughness: 0.35 })
    );
    roof.position.y = 7.0;
    cGroup.add(roof);

    const spinner = new THREE.Group();
    const horseColors = [0xFFFFFF, 0x38BDF8, 0xF472B6, 0xFACC15, 0x34D399, 0xA855F7];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.cos(ang) * 4.0;
      const pz = Math.sin(ang) * 4.0;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 5.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xFDE047, metalness: 0.6 })
      );
      pole.position.set(px, 3.0, pz);
      spinner.add(pole);

      const horse = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 1.5),
        new THREE.MeshStandardMaterial({ color: horseColors[i], roughness: 0.3 })
      );
      horse.position.set(px, 2.0 + (i % 2) * 0.5, pz);
      horse.rotation.y = -ang;
      spinner.add(horse);
    }
    cGroup.add(spinner);
    this.carouselGroup = spinner;

    this.scene.add(cGroup);
    this.physics.addCylinderCollider(114, 3.5, 82, 5.5, 3.5);

    // 2. 🎈 하늘 위를 유영하는 초대형 3D 열기구 4기
    const balloonConfigs = [
      { cx: -70, cz: -70, y: 34, r: 22, speed: 0.18, color: 0xEF4444, stripe: 0xFACC15 },
      { cx: 75, cz: 70, y: 38, r: 26, speed: -0.15, color: 0x3B82F6, stripe: 0xFFFFFF },
      { cx: 0, cz: 150, y: 32, r: 30, speed: 0.2, color: 0xEC4899, stripe: 0xFEF08A },
      { cx: -90, cz: 90, y: 40, r: 20, speed: 0.14, color: 0x10B981, stripe: 0xFFFFFF }
    ];

    balloonConfigs.forEach((b, idx) => {
      const bGroup = new THREE.Group();
      const envelope = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 18, 16),
        new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.4 })
      );
      envelope.scale.y = 1.22;
      envelope.position.y = 3.5;
      bGroup.add(envelope);

      const band = new THREE.Mesh(
        new THREE.TorusGeometry(4.15, 0.38, 10, 24),
        new THREE.MeshBasicMaterial({ color: b.stripe })
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = 3.5;
      bGroup.add(band);

      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.3, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x92400E })
      );
      basket.position.y = -2.2;
      bGroup.add(basket);

      bGroup.position.set(b.cx, b.y, b.cz);
      this.scene.add(bGroup);
      this.hotAirBalloons.push({
        group: bGroup,
        baseY: b.y,
        phase: idx * 1.5,
        speed: b.speed,
        radius: b.r,
        cx: b.cx,
        cz: b.cz
      });
    });
  }

  /**
   * 🚂 8-D. 외곽 순환 타요 특급열차 (3D 기관차 + 객차 2량 + 원형 철길 트랙!)
   */
  private buildExpressTrainSystem(): void {
    const trackRadius = 152;
    // 원형 자갈 철길 도상 및 침목 링 (북쪽~동쪽~서쪽 파노라마 순환 트랙)
    const railRing = new THREE.Mesh(
      new THREE.RingGeometry(trackRadius - 1.3, trackRadius + 1.3, 96),
      new THREE.MeshStandardMaterial({
        color: 0x64748B,
        roughness: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
    railRing.rotation.x = -Math.PI / 2;
    railRing.position.set(0, 0.016, 0);
    this.scene.add(railRing);

    // 3량 편성 특급열차 그룹
    const trainGroup = new THREE.Group();
    const wheels: THREE.Object3D[] = [];
    const carColors = [0xEF4444, 0x0284C7, 0xFACC15];
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.6 });

    carColors.forEach((col, cIdx) => {
      const car = new THREE.Group();
      car.position.z = -cIdx * 7.2;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 3.0, 6.2),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.2 })
      );
      body.position.y = 2.0;
      body.castShadow = true;
      car.add(body);

      if (cIdx === 0) {
        // 선두 증기/특급 기관차 굴뚝 & 황금 헤드램프
        const chimney = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.35, 1.4, 12),
          new THREE.MeshStandardMaterial({ color: 0x1E293B })
        );
        chimney.position.set(0, 4.0, 2.0);
        car.add(chimney);

        const headLamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xFEF08A })
        );
        headLamp.position.set(0, 2.4, 3.15);
        car.add(headLamp);
      }

      // 기차 바퀴 4개
      [
        [-1.45, -1.8],
        [1.45, -1.8],
        [-1.45, 1.8],
        [1.45, 1.8]
      ].forEach(([wx, wz]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12), wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.55, wz);
        car.add(w);
        wheels.push(w);
      });

      trainGroup.add(car);
    });

    this.scene.add(trainGroup);
    this.expressTrain = { group: trainGroup, angle: 0, wheels };
  }

  /**
   * 🌦️ 8-E. 실시간 3D 날씨 파티클 (꽃비 / 비와 무지개 / 눈송이) & 하늘을 가로지르는 초대형 7색 무지개!
   */
  private buildWeatherAndRainbowSystem(): void {
    // 1. 하늘 위 초대형 7색 무지개 아치 (비와 무지개 날씨이거나 낮 시간에 은은하게 빛남)
    const rbGroup = new THREE.Group();
    rbGroup.position.set(0, -8, -195);
    const rainbowColors = [0xFF1744, 0xFF9100, 0xFFEA00, 0x00E676, 0x00B0FF, 0x3D5AFE, 0xD500F9];
    rainbowColors.forEach((hex, idx) => {
      const r = 165 - idx * 2.4;
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(r, 1.15, 8, 64, Math.PI),
        new THREE.MeshBasicMaterial({
          color: hex,
          transparent: true,
          opacity: 0.52,
          depthWrite: false
        })
      );
      rbGroup.add(arc);
    });
    this.scene.add(rbGroup);
    this.rainbowGroup = rbGroup;

    // 2. 3D 날씨 파티클 필드 (버스 주변 90m 영역에 흩날리는 꽃잎/빗방울/눈송이)
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = Math.random() * 32;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xF9A8D4,
      size: 0.55,
      transparent: true,
      opacity: 0.85
    });
    const points = new THREE.Points(pGeom, pMat);
    points.visible = false;
    this.scene.add(points);
    this.weatherParticles = points;
  }

  public setWeather(weather: WeatherType): void {
    this.currentWeather = weather;
    if (!this.weatherParticles) return;

    const mat = this.weatherParticles.material as THREE.PointsMaterial;
    if (weather === 'clear') {
      this.weatherParticles.visible = false;
      if (this.rainbowGroup) this.rainbowGroup.visible = true;
    } else if (weather === 'blossom') {
      this.weatherParticles.visible = true;
      mat.color.setHex(0xF9A8D4); // 분홍 벚꽃잎
      mat.size = 0.62;
      if (this.rainbowGroup) this.rainbowGroup.visible = true;
    } else if (weather === 'rain_rainbow') {
      this.weatherParticles.visible = true;
      mat.color.setHex(0x7DD3FC); // 시원한 빗방울
      mat.size = 0.45;
      if (this.rainbowGroup) this.rainbowGroup.visible = true;
    } else if (weather === 'snow') {
      this.weatherParticles.visible = true;
      mat.color.setHex(0xFFFFFF); // 하얀 눈송이
      mat.size = 0.68;
      if (this.rainbowGroup) this.rainbowGroup.visible = false;
    }
  }

  public cycleWeather(): WeatherType {
    const order: WeatherType[] = ['clear', 'blossom', 'rain_rainbow', 'snow'];
    const nextIdx = (order.indexOf(this.currentWeather) + 1) % order.length;
    const next = order[nextIdx];
    this.setWeather(next);
    return next;
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
   * 실제 가족 사진 기반 귀여운 SD 캐릭터 생성 (선율, 태율이, 엄마, 아빠)
   * - 기존 문제 해결: 동그란 구체(headBase)가 사진 뱃지 앞으로 튀어나와 얼굴을 가리던 문제를 완벽 해결!
   * - 구체 헤드를 제거하고, 골드 메달 림(Rim) 양면에 정방향 원형 사진 디스크(CircleGeometry)를 부착하여
   *   어느 각도에서도 선율이, 태율이, 엄마, 아빠 얼굴이 100% 또렷하고 정방향으로 보이도록 개선!
   * - 또한 버스가 다가오면 캐릭터가 버스를 향해 반갑게 바라보며 손을 흔듭니다.
   */
  private createFamilyPassenger(
    badgeUrl: string,
    bodyColor: number,
    pantColor: number,
    labelText: string
  ): THREE.Group {
    const group = new THREE.Group();

    // 1. 귀여운 신발 & 하반신 다리
    const shoeGeom = new THREE.BoxGeometry(0.2, 0.12, 0.28);
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
    const legGeom = new THREE.CylinderGeometry(0.11, 0.1, 0.4, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.55 });
    [-0.15, 0.15].forEach(lx => {
      const shoe = new THREE.Mesh(shoeGeom, shoeMat);
      shoe.position.set(lx, 0.06, 0.04);
      group.add(shoe);

      const leg = new THREE.Mesh(legGeom, legMat);
      leg.position.set(lx, 0.26, 0);
      group.add(leg);
    });

    // 2. 귀여운 SD 상체 (둥근 후드티/스웨터)
    const torsoGeom = new THREE.CylinderGeometry(0.28, 0.35, 0.54, 16);
    const torsoMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45 });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 0.66;
    torso.castShadow = true;
    group.add(torso);

    // 3. 귀여운 목 받침대 (절대 얼굴 뱃지 위로 올라오지 않음)
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.4 })
    );
    neck.position.y = 0.96;
    group.add(neck);

    // 4. 반갑게 인사하는 양팔
    const armGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.36, 10);
    const handMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.4 });
    [-0.36, 0.36].forEach(ax => {
      const arm = new THREE.Mesh(armGeom, torsoMat);
      arm.position.set(ax, 0.72, 0);
      arm.rotation.z = ax > 0 ? -0.55 : 0.4;
      group.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), handMat);
      hand.position.set(ax * 1.25, ax > 0 ? 0.88 : 0.56, 0);
      group.add(hand);
    });

    // 5. 얼굴 사진 메달 헤드 (구체 없이 순수 골드 메달 테두리 + 앞/뒤 정방향 원형 사진 디스크!)
    const textureLoader = new THREE.TextureLoader();
    const faceTex = textureLoader.load(badgeUrl);
    faceTex.colorSpace = THREE.SRGBColorSpace;

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.48, 0);

    // 골드 메달 외곽 림 (측면 두께만 담당하고 앞뒤 사진은 가리지 않음)
    const rimGeom = new THREE.CylinderGeometry(0.56, 0.56, 0.08, 36);
    rimGeom.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xFACC15,
      metalness: 0.45,
      roughness: 0.25,
      emissive: 0xF59E0B,
      emissiveIntensity: 0.18
    });
    const rimMesh = new THREE.Mesh(rimGeom, rimMat);
    headGroup.add(rimMesh);

    // 정방향 원형 얼굴 디스크 (CircleGeometry는 UV가 정방향 0~1로 매핑되어 회전 왜곡이 전혀 없음!)
    const faceDiscGeom = new THREE.CircleGeometry(0.55, 36);
    const faceDiscMat = new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      toneMapped: false
    });

    // 앞면 얼굴 (+Z)
    const frontFace = new THREE.Mesh(faceDiscGeom, faceDiscMat);
    frontFace.position.z = 0.045;
    headGroup.add(frontFace);

    // 뒷면 얼굴 (-Z, 뒤에서 봐도 똑바로 보이도록)
    const backFace = new THREE.Mesh(faceDiscGeom, faceDiscMat);
    backFace.position.z = -0.045;
    backFace.rotation.y = Math.PI;
    headGroup.add(backFace);

    // 머리 위 귀여운 이름표 배너 ("👦 선율이" 등)
    const nameTag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 0.46),
      new THREE.MeshBasicMaterial({
        map: this.createSignBannerTexture(labelText, '#F59E0B'),
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    nameTag.position.set(0, 0.78, 0);
    headGroup.add(nameTag);

    group.add(headGroup);

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
      let passengerPhotoUrl: string | undefined;
      const isFamily = familyIndices.has(idx);

      if (isFamily) {
        const f = familyPool[familyIdx++];
        passengerName = f.name;
        passengerIcon = f.icon;
        passengerPhotoUrl = f.badge;
        passengerMesh = this.createFamilyPassenger(
          f.badge,
          f.bodyColor,
          f.pantColor,
          `${f.icon} ${f.name}`
        );
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
        passengerPhotoUrl,
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
      [0, 136], [0, -136], [136, 0], [-136, 0],
      [-54, 184], [0, 184], [54, 184]
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
   * 월드 내 동적 오브젝트(분수대, 소방 타워 불꽃, 물대포, 병원 하트, 보행자, 열차, 회전목마, 열기구, 요트, 등대, 정비소 리프트, 날씨 파티클 등) 업데이트
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

    // 1. 정류장 승객 콩콩 점프 애니메이션 & 플레이어 버스를 향해 얼굴 돌리기!
    this.busStops.forEach(stop => {
      const p = stop.passengerMesh;
      if (!p.userData.isBoarded) {
        p.userData.animTime += delta * 4.5;
        p.position.y = Math.abs(Math.sin(p.userData.animTime)) * 0.24;

        // 승객이 항상 다가오는 플레이어 버스를 바라보도록 회전하여 가족 얼굴 사진이 정면으로 보임!
        const worldX = stop.x + p.position.x;
        const worldZ = stop.z + p.position.z;
        const angleToBus = Math.atan2(busPos.x - worldX, busPos.z - worldZ);
        p.rotation.y = angleToBus;
      }
    });

    // 2. 세차장 브러쉬 회전 & 비눗방울 상승
    this.carWashBrushes.forEach((b, idx) => {
      b.rotation.y += (idx % 2 === 0 ? 1 : -1) * 3.8 * delta;
    });
    this.carWashBubbles.forEach(bubble => {
      bubble.position.y += 1.5 * delta;
      if (bubble.position.y > 4.8) bubble.position.y = 0.6;
    });

    // 2-1. 주유/충전소 에너지 홀로그램 링 회전
    this.chargingEnergyRings.forEach((ring, idx) => {
      ring.rotation.z += 2.2 * delta;
      ring.position.y = 1.2 + Math.sin(nowSec * 3.5 + idx) * 0.65;
    });

    // 2-2. 하나 누나의 정비소 유압 리프트 & 로봇 렌치 암 애니메이션
    const distToRepair = Math.hypot(busPos.x - -30, busPos.z - 84.5);
    if (this.repairLiftPlatform) {
      const targetLiftY = distToRepair < 7.5 ? 0.45 + Math.sin(nowSec * 3.0) * 0.25 : 0.14;
      this.repairLiftPlatform.position.y += (targetLiftY - this.repairLiftPlatform.position.y) * 4 * delta;
    }
    this.repairRobotArms.forEach((arm, idx) => {
      const swingSpeed = distToRepair < 8.5 ? 6.5 : 1.8;
      arm.rotation.z = (idx === 0 ? -0.55 : 0.55) + Math.sin(nowSec * swingSpeed + idx) * 0.35;
    });

    // 3. 대관람차, 회전목마, 풍차, 열기구, 요트, 등대, 외곽 순환 특급열차 애니메이션
    if (this.ferrisWheel) {
      this.ferrisWheel.rotation.z += 0.25 * delta;
    }
    if (this.carouselGroup) {
      this.carouselGroup.rotation.y += 0.85 * delta;
    }
    if (this.windmillBlades) {
      this.windmillBlades.rotation.z -= 0.9 * delta;
    }
    this.hotAirBalloons.forEach(b => {
      const x = b.cx + Math.cos(nowSec * b.speed + b.phase) * b.radius;
      const z = b.cz + Math.sin(nowSec * b.speed + b.phase) * b.radius;
      const y = b.baseY + Math.sin(nowSec * 1.4 + b.phase) * 3.2;
      b.group.position.set(x, y, z);
      b.group.rotation.y += 0.25 * delta;
    });
    this.yachts.forEach(y => {
      y.group.position.x = y.baseX + Math.sin(nowSec * 0.55 + y.phase) * 6.5;
      y.group.position.y = Math.sin(nowSec * 2.2 + y.phase) * 0.22;
      y.group.rotation.z = Math.sin(nowSec * 1.8 + y.phase) * 0.06;
    });
    if (this.lighthouseBeam) {
      this.lighthouseBeam.rotation.y += 1.2 * delta;
    }
    if (this.expressTrain) {
      this.expressTrain.angle += 0.14 * delta;
      const trackR = 152;
      const tx = Math.cos(this.expressTrain.angle) * trackR;
      const tz = Math.sin(this.expressTrain.angle) * trackR;
      this.expressTrain.group.position.set(tx, 0.16, tz);
      // 접선 방향을 바라보도록 회전
      this.expressTrain.group.rotation.y = -this.expressTrain.angle;
      this.expressTrain.wheels.forEach(w => {
        w.rotation.z -= 4.5 * delta;
      });
    }

    // 3-1. 실시간 3D 날씨 파티클 (꽃비 / 빗방울 / 눈송이) 업데이트
    if (this.weatherParticles && this.weatherParticles.visible) {
      const posAttr = this.weatherParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const fallSpeed = this.currentWeather === 'rain_rainbow' ? 28 : this.currentWeather === 'snow' ? 6.5 : 4.8;
      const driftSpeed = this.currentWeather === 'rain_rainbow' ? 0.5 : 2.4;

      for (let i = 0; i < posAttr.count; i++) {
        let px = posAttr.getX(i);
        let py = posAttr.getY(i) - fallSpeed * delta;
        let pz = posAttr.getZ(i);

        px += Math.sin(nowSec * 1.8 + i) * driftSpeed * delta;
        if (py < 0.2) {
          py = 38 + Math.random() * 8;
          px = busPos.x + (Math.random() - 0.5) * 140;
          pz = busPos.z + (Math.random() - 0.5) * 140;
        }
        posAttr.setXYZ(i, px, py, pz);
      }
      posAttr.needsUpdate = true;
    }

    // 4. 인터랙티브 시설 (차고지 문 개폐, 세차장, 충전소, 정비소, F1 피트스탑, 경찰서, 소방서, 병원) 판정
    this.interactiveZones.forEach(zone => {
      if (zone.cooldown > 0) zone.cooldown -= delta;
      const dist = Math.hypot(busPos.x - zone.x, busPos.z - zone.z);

      if (zone.type === 'garage') {
        // 차고지에 다가가면 4개의 문이 활짝 열려 내부 베이로 직접 들어가 주차 가능!
        const targetDoorY = dist < 22 ? 5.9 : 2.1;
        this.garageDoors.forEach(d => {
          d.position.y += (targetDoorY - d.position.y) * 5.5 * delta;
        });
      }

      if (dist < zone.radius && zone.cooldown <= 0) {
        zone.cooldown = 12.0;
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
