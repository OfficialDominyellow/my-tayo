import * as THREE from 'three';
import { PhysicsEngine } from './physics';
import { WorldManager } from './world';
import { BusModelFactory, BusVisualInstance } from './bus-model';
import { soundManager } from './sound';
import { educationManager } from './education';
import {
  BusStopData,
  BusType,
  CameraMode,
  DebugMetrics,
  EmergencyDispatchMission,
  InputState,
  TimeOfDay
} from './types';

export class TayoGame {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private hemiLight: THREE.HemisphereLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;

  public physics: PhysicsEngine;
  public world: WorldManager;

  // 비주얼 버스 상태
  public currentBusType: BusType = 'tayo';
  private visualBus: BusVisualInstance | null = null;
  private targetStop: BusStopData | null = null;
  private currentPassenger: {
    name: string;
    icon: string;
    targetStopName: string;
    mesh: THREE.Group;
  } | null = null;
  public activeDispatch: EmergencyDispatchMission | null = null;
  private dispatchIndex: number = 0;
  public isSirenOn: boolean = false;
  private sirenLoopTimer: number = 0;
  private f1SoundCooldown: number = 0;
  private pedestrianBonusCooldown: number = 0;

  private guideArrow: THREE.Group | null = null;
  private guideDots: THREE.Mesh[] = [];

  // 카메라 및 환경 모드
  public cameraMode: CameraMode = 'chase';
  public timeOfDay: TimeOfDay = 'day';

  // 디버그 및 성능 지표 (라즈베리파이 5 최적화)
  public isLowSpecMode: boolean = false;
  public metrics: DebugMetrics = {
    fps: 60,
    frameTimeMs: 16.6,
    physicsTimeMs: 0,
    speedKmh: 0,
    wheelGrounded: [true, true, true, true]
  };
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private lastFrameTime = performance.now();

  // 게임 진행 상태
  public stars: number = 0;
  private hasStoppedForRedLight: boolean = false;
  private totalTime: number = 0;
  private popupTimeout: number | undefined;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  // 키보드 & 터치 입력
  public input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false
  };

  constructor(containerId: string = 'game-container') {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0032);

    // 2. Camera (확장된 520m 월드를 시원하게 볼 수 있도록 far 클리핑 확장)
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 560);
    this.camera.position.set(0, 10, -15);

    // 3. WebGLRenderer (색감 및 톤매핑 개선)
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. 물리 엔진 & 월드 매니저
    this.physics = new PhysicsEngine();
    this.world = new WorldManager(this.scene, this.physics);

    // 미니맵 캔버스 초기화
    const mmCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
    if (mmCanvas) {
      this.minimapCtx = mmCanvas.getContext('2d');
    }
  }

  public async init(): Promise<void> {
    // 1. 입체감을 살려주는 반구형 환경광 + 태양 직사광 세팅
    this.hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0x689F38, 0.85);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xFFFDF0, 1.15);
    this.dirLight.position.set(75, 110, 65);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 320;
    const d = 125;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // 2. 물리 엔진 초기화 (WASM Rapier3D 로드)
    await this.physics.init();

    // 3. 확장된 월드 및 콜라이더 생성
    this.world.generate();

    // 4. 내비게이션 목적지 안내 화살표 & 바닥 무지개 유도선
    this.createGuideVisuals();

    // 5. 차량 물리 및 비주얼 버스 생성 (중앙 로터리 북쪽 도로 스폰)
    this.physics.createVehicle(-3.5, 1.2, 22, 0);
    this.spawnVisualBus(this.currentBusType);

    // 6. 4세 놀이학습 매니저 초기화
    educationManager.init();
    this.updateMissionBanner();

    // 7. 창 크기 조절 이벤트
    window.addEventListener('resize', () => this.onResize());

    // 8. 메인 렌더 루프 가동
    this.animate();
  }

  private createGuideVisuals(): void {
    const arrowGroup = new THREE.Group();
    const coneGeom = new THREE.ConeGeometry(1.1, 2.2, 16);
    coneGeom.rotateX(Math.PI);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xFFD600 });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.position.y = 1.2;
    arrowGroup.add(cone);

    const ringGeom = new THREE.TorusGeometry(3.2, 0.22, 10, 28);
    ringGeom.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00E676 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = -3.8;
    arrowGroup.add(ring);

    arrowGroup.position.set(0, -999, 0);
    this.scene.add(arrowGroup);
    this.guideArrow = arrowGroup;

    // 버스에서 목적지 방향을 가리키는 바닥 무지개 유도 도트 8개
    for (let i = 0; i < 8; i++) {
      const dotGeom = new THREE.SphereGeometry(0.32, 10, 10);
      const hue = (i * 42) % 360;
      const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${hue}, 95%, 55%)`) });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(0, -999, 0);
      this.scene.add(dot);
      this.guideDots.push(dot);
    }
  }

  // 비주얼 차량 교체 (타요, 로기, 라니, 가니 + 패트 경찰차, 프랭크 소방차, 앨리스 구급차!)
  public spawnVisualBus(busType: BusType): void {
    if (this.visualBus) {
      this.scene.remove(this.visualBus.root);
    }

    this.currentBusType = busType;
    this.visualBus = BusModelFactory.createBusVisual(busType);
    this.visualBus.setNightLights(this.timeOfDay !== 'day');
    this.visualBus.setExpression('happy', 3.0);
    this.scene.add(this.visualBus.root);

    // 긴급차량(패트/프랭크/앨리스) 선택 시 자동으로 경광등 ON!
    const isEmergency = busType === 'pat' || busType === 'frank' || busType === 'alice';
    this.isSirenOn = isEmergency;
    this.visualBus.setSirenActive(this.isSirenOn);
    if (isEmergency) {
      const sirenKind = busType === 'pat' ? 'police' : busType === 'frank' ? 'fire' : 'ambulance';
      soundManager.playSiren(sirenKind);
    }

    const sirenBtn = document.getElementById('btn-siren');
    if (sirenBtn) {
      sirenBtn.classList.toggle('active-toggle', this.isSirenOn);
      sirenBtn.textContent = busType === 'frank' ? '💦 물대포·사이렌' : '🚨 사이렌·물대포';
    }

    soundManager.speak(this.visualBus.config.voiceIntro);
    const roleIcon =
      busType === 'pat' ? '🚓' : busType === 'frank' ? '🚒' : busType === 'alice' ? '🚑' : '🚌';
    this.showPopup(`${roleIcon} ${this.visualBus.config.name} (${this.visualBus.config.number}) 출동 준비 완료!`);
  }

  /**
   * 🚨 사이렌 경광등 토글 및 💦 소방 물대포 발사!
   */
  public triggerSirenAndWaterCannon(): void {
    if (!this.visualBus) return;

    const { position: busPos, quaternion: busQuat } = this.physics.getChassisTransform();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(busQuat);

    // 1. 물대포 발사 (프랭크 소방차이거나 소방서 근처일 때 언제든 시원한 물줄기 발사!)
    soundManager.playWaterSplash();
    const sprayRes = this.world.sprayWaterAtFire(busPos, forward);
    if (sprayRes.extinguishedFire) {
      soundManager.playCelebration();
      soundManager.speak('우와! 물대포로 일일구 소방서 훈련 타워의 불을 완전히 껐어요! 최고 소방대원이에요!');
      this.addStar('🚒💦 물대포로 화재 진압 성공! 용감한 119 소방대원!', 3);
      this.visualBus.setExpression('happy', 4.0);
      if (this.activeDispatch && this.activeDispatch.stationType === 'fire_station') {
        this.completeEmergencyDispatch();
      }
      return;
    }

    // 2. 사이렌 경광등 ON/OFF 토글
    this.isSirenOn = !this.isSirenOn;
    this.visualBus.setSirenActive(this.isSirenOn);
    const sirenBtn = document.getElementById('btn-siren');
    if (sirenBtn) {
      sirenBtn.classList.toggle('active-toggle', this.isSirenOn);
    }

    if (this.isSirenOn) {
      const kind =
        this.currentBusType === 'frank'
          ? 'fire'
          : this.currentBusType === 'alice'
          ? 'ambulance'
          : 'police';
      soundManager.playSiren(kind);
      this.visualBus.setExpression('wink', 2.0);
      this.showPopup('🚨 삐뽀삐뽀! 긴급 출동 사이렌 & 물대포 발사!');
    } else {
      this.showPopup('🔕 사이렌 경광등을 껐어요.');
    }
  }

  /**
   * 🚨 경찰서 · 소방서 · 병원 긴급출동 미션 시작!
   */
  public startNextEmergencyDispatch(): void {
    const missions: EmergencyDispatchMission[] = [
      {
        id: 'dispatch_fire',
        title: '🚒 [119 긴급출동] 소방서 훈련 타워에 불이 났어요! 출동해서 물대포를 쏘세요!',
        icon: '🚒',
        stationType: 'fire_station',
        targetX: -82,
        targetZ: 95,
        voiceIntro: '일일구 긴급출동! 용감한 소방서 훈련 타워에 불이 났어요! 소방서로 달려가 물대포로 불을 꺼주세요!'
      },
      {
        id: 'dispatch_police',
        title: '🚓 [112 긴급출동] 112 용감한 경찰서로 출동해 안전 순찰을 완료하세요!',
        icon: '🚓',
        stationType: 'police_station',
        targetX: -84,
        targetZ: 36.5,
        voiceIntro: '일일이 긴급출동! 용감한 경찰서로 출동해서 우리 동네 안전 순찰 미션을 완료해 주세요!'
      },
      {
        id: 'dispatch_hospital',
        title: '🏥 [구급 긴급출동] 튼튼 어린이 종합병원 응급실로 구급 상자를 전달하세요!',
        icon: '🏥',
        stationType: 'hospital',
        targetX: 84,
        targetZ: -19.5,
        voiceIntro: '삐뽀삐뽀 구급 출동! 튼튼 어린이 종합병원으로 빠르게 달려가 응급 치료를 도와주세요!'
      }
    ];

    this.activeDispatch = missions[this.dispatchIndex % missions.length];
    this.dispatchIndex++;

    // 사이렌 자동 점등
    this.isSirenOn = true;
    this.visualBus?.setSirenActive(true);
    const sirenKind =
      this.activeDispatch.stationType === 'fire_station'
        ? 'fire'
        : this.activeDispatch.stationType === 'hospital'
        ? 'ambulance'
        : 'police';
    soundManager.playSiren(sirenKind);

    if (this.guideArrow) {
      this.guideArrow.position.set(this.activeDispatch.targetX, 5.2, this.activeDispatch.targetZ);
    }

    soundManager.speak(this.activeDispatch.voiceIntro);
    this.showPopup(this.activeDispatch.title);
    this.updateMissionBanner();
  }

  private completeEmergencyDispatch(): void {
    if (!this.activeDispatch) return;
    const finished = this.activeDispatch;
    this.activeDispatch = null;
    if (!this.targetStop && this.guideArrow) {
      this.guideArrow.position.set(0, -999, 0);
    }

    soundManager.playCelebration();
    this.addStar(`${finished.icon} 긴급출동 미션 대성공! 우리 동네 영웅이에요!`, 3);
    this.updateMissionBanner();
  }

  // 낮 / 노을 / 밤 시간대 전환 (헤드라이트 및 가로등 점등!)
  public toggleTimeOfDay(): TimeOfDay {
    if (this.timeOfDay === 'day') {
      this.timeOfDay = 'sunset';
      this.scene.background = new THREE.Color(0xFD7E53);
      this.scene.fog = new THREE.FogExp2(0xFD7E53, 0.0032);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xFFCCBC);
        this.hemiLight.groundColor.setHex(0x4E342E);
        this.hemiLight.intensity = 0.65;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xFFAB40);
        this.dirLight.intensity = 0.9;
      }
      this.showPopup('🌅 노을 지는 저녁이에요! 가로등과 헤드라이트가 켜졌어요!');
      soundManager.speak('예쁜 노을이 지고 있어요! 가로등과 헤드라이트를 켰어요!');
    } else if (this.timeOfDay === 'sunset') {
      this.timeOfDay = 'night';
      this.scene.background = new THREE.Color(0x0F172A);
      this.scene.fog = new THREE.FogExp2(0x0F172A, 0.0038);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x38BDF8);
        this.hemiLight.groundColor.setHex(0x0F172A);
        this.hemiLight.intensity = 0.42;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0x93C5FD);
        this.dirLight.intensity = 0.45;
      }
      this.showPopup('🌙 반짝반짝 밤이에요! 가로등 불빛이 도로를 비춰요!');
      soundManager.speak('밤이 되었어요! 환한 가로등 불빛 아래 안전하게 달려요!');
    } else {
      this.timeOfDay = 'day';
      this.scene.background = new THREE.Color(0x87CEEB);
      this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0032);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xFFFFFF);
        this.hemiLight.groundColor.setHex(0x689F38);
        this.hemiLight.intensity = 0.85;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xFFFDF0);
        this.dirLight.intensity = 1.15;
      }
      this.showPopup('🌞 맑고 화창한 아침이에요!');
      soundManager.speak('해가 쨍쨍! 즐거운 아침이에요!');
    }

    this.world.setTimeOfDayVisuals(this.timeOfDay);
    if (this.visualBus) {
      this.visualBus.setNightLights(this.timeOfDay !== 'day');
    }
    return this.timeOfDay;
  }

  // 4세 운전 보조 토글
  public toggleKidAssist(): boolean {
    this.physics.kidAssistEnabled = !this.physics.kidAssistEnabled;
    const stateText = this.physics.kidAssistEnabled ? '켜짐 (목적지로 핸들을 도와줘요!)' : '꺼짐 (직접 자유 운전)';
    this.showPopup(`👶 4세 운전보조: ${stateText}`);
    return this.physics.kidAssistEnabled;
  }

  // 언제든 상단 버튼으로 한글/숫자/영어/안전 놀이 열기
  public openLearningNow(): void {
    if (educationManager.isOpen) return;
    this.resetInput();
    educationManager.openMissionActivity(null, starsEarned => {
      this.addStar('🎓 신나는 한글·숫자·영어·안전 놀이 완료!', starsEarned);
      this.visualBus?.setExpression('happy', 3.0);
    });
  }

  private resetInput(): void {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.brake = true;
    setTimeout(() => {
      this.input.brake = false;
    }, 300);
  }

  // 차체 전복 복구 (R키 또는 바로세우기 버튼)
  public recoverVehicle(): void {
    this.physics.recoverVehicle();
    this.visualBus?.setExpression('surprised', 1.8);
    soundManager.playBoing();
    soundManager.speak('차량을 바로 세웠어요! 안전하게 다시 출발!');
    this.showPopup('🔄 차체를 바로 세웠어요!');
  }

  // 저사양 모드 토글 (라즈베리파이 5 최적화)
  public toggleLowSpecMode(): void {
    this.isLowSpecMode = !this.isLowSpecMode;
    if (this.isLowSpecMode) {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
      if (this.dirLight) this.dirLight.castShadow = false;
      this.showPopup('⚡ 저사양 모드: 켜짐 (라즈베리파이 최적화)');
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      if (this.dirLight) this.dirLight.castShadow = true;
      this.showPopup('✨ 고품질 그래픽 모드');
    }
  }

  // 빵빵! 경적 (경적 울릴 때 귀여운 윙크 표정!)
  public honk(): void {
    soundManager.playHorn();
    this.visualBus?.setExpression('wink', 1.5);
    this.showPopup('🎺 빵빵! 비켜주세요~ 나가요!');
  }

  // 카메라 시점 전환 (5가지 모드: 3인칭 기본, 버스 얼굴 전면뷰, 1인칭 운전석, 대각선 쿼터뷰, 탑다운)
  public toggleCamera(): CameraMode {
    const modes: CameraMode[] = ['chase', 'front_face', 'first_person', 'isometric', 'top_down'];
    const nextIdx = (modes.indexOf(this.cameraMode) + 1) % modes.length;
    this.cameraMode = modes[nextIdx];

    const labels: Record<CameraMode, string> = {
      chase: '🚗 3인칭 후방 추적 뷰',
      front_face: '👀 정면 얼굴 뷰 (눈 깜빡임 & 표정 감상)',
      first_person: '💺 1인칭 운전석 뷰',
      isometric: '🧸 장난감 대각선 뷰',
      top_down: '🚁 헬리콥터 탑다운 뷰'
    };

    this.showPopup(`📷 카메라: ${labels[this.cameraMode]}`);
    return this.cameraMode;
  }

  public showPopup(text: string): void {
    const popup = document.getElementById('mission-popup');
    if (!popup) return;
    popup.textContent = text;
    popup.classList.remove('hidden');
    popup.classList.add('pop-animation');

    clearTimeout(this.popupTimeout);
    this.popupTimeout = window.setTimeout(() => {
      popup.classList.remove('pop-animation');
      popup.classList.add('hidden');
    }, 2800);
  }

  public addStar(reason: string, count: number = 1): void {
    this.stars += count;
    const starElem = document.getElementById('star-counter');
    if (starElem) {
      starElem.textContent = `⭐ ${this.stars}`;
      starElem.classList.add('star-bounce');
      setTimeout(() => starElem.classList.remove('star-bounce'), 800);
    }

    soundManager.playStar();
    this.showPopup(`⭐ 참 잘했어요! (+${count} 별)\n${reason}`);

    if (this.stars % 5 === 0) {
      soundManager.playCelebration();
      soundManager.speak(`우와! 별을 ${this.stars}개나 모았어요! 최고 안전 대장!`);
    }
  }

  private updateMissionBanner(): void {
    const banner = document.getElementById('mission-status-bar');
    if (!banner) return;

    if (this.activeDispatch) {
      banner.innerHTML = `<span style="color:#FEF08A">${this.activeDispatch.title}</span> (무지개 유도선을 따라가세요!)`;
      banner.classList.add('active-mission');
    } else if (this.currentPassenger && this.targetStop) {
      banner.innerHTML = `${this.currentPassenger.icon} <strong>${this.currentPassenger.name}</strong> 탑승 중 ➔ 목적지: <strong>${this.targetStop.icon} ${this.targetStop.name}</strong> (무지개 별을 따라가세요!)`;
      banner.classList.add('active-mission');
    } else {
      banner.innerHTML = `🚏 노란 <strong>정류장</strong>에서 가족·동물 친구를 태우거나 <strong>🚨 긴급출동</strong> 버튼으로 소방서·경찰서·병원 미션을 시작하세요!`;
      banner.classList.remove('active-mission');
    }
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private checkTrafficRules(
    trafficState: { nsState: 'green' | 'yellow' | 'red'; ewState: 'green' | 'yellow' | 'red' },
    busPos: THREE.Vector3,
    busHeading: number
  ): void {
    // 4대 주요 사거리 교차로(±54m) 중 가장 가까운 신호등 교차로 찾기
    const intersections: [number, number][] = [
      [0, 54],
      [0, -54],
      [54, 0],
      [-54, 0]
    ];
    let minDist = Infinity;
    for (const [ix, iz] of intersections) {
      const d = Math.hypot(busPos.x - ix, busPos.z - iz);
      if (d < minDist) minDist = d;
    }

    if (minDist > 16) {
      this.hasStoppedForRedLight = false;
      return;
    }

    const absHeading = Math.abs(busHeading % Math.PI);
    const isNorthSouth = absHeading < Math.PI / 4 || absHeading > (3 * Math.PI) / 4;
    const light = isNorthSouth ? trafficState.nsState : trafficState.ewState;

    const speedKmh = this.physics.getSpeedKmh();

    if (light === 'red') {
      if (minDist >= 5.5 && minDist <= 13.5 && Math.abs(speedKmh) < 1.5) {
        if (!this.hasStoppedForRedLight) {
          this.hasStoppedForRedLight = true;
          this.addStar('🚦 빨간불 정지선에 안전하게 멈춰섰어요! 참 잘했어요!');
          soundManager.speak('빨간불에 아주 잘 멈췄어요! 신호등 박사님이네요!');
        }
      } else if (minDist < 5.0 && Math.abs(speedKmh) > 7.5 && !this.hasStoppedForRedLight && !this.isSirenOn) {
        soundManager.speak('어? 빨간불에는 멈춰야 해요! 다음엔 꼭 멈춰봐요!');
        this.hasStoppedForRedLight = true;
      }
    } else if (light === 'green') {
      if (this.hasStoppedForRedLight && Math.abs(speedKmh) > 3.0) {
        this.hasStoppedForRedLight = false;
      }
    }
  }

  /**
   * 정류장 승객 탑승 & 4세 한글·숫자·영어·안전 미션 연동 & 목적지 도착 판정
   */
  private checkBusStops(busPos: THREE.Vector3): void {
    if (educationManager.isOpen) return;
    const speedKmh = this.physics.getSpeedKmh();

    // 긴급출동 목표 지점 도착 체크
    if (this.activeDispatch) {
      const distDispatch = Math.hypot(
        busPos.x - this.activeDispatch.targetX,
        busPos.z - this.activeDispatch.targetZ
      );
      if (distDispatch < 11.0 && Math.abs(speedKmh) < 6.0) {
        if (this.activeDispatch.stationType === 'fire_station') {
          const forward = new THREE.Vector3(0, 0, 1);
          this.world.sprayWaterAtFire(busPos, forward);
          soundManager.playWaterSplash();
        }
        this.completeEmergencyDispatch();
      }
    }

    // 4세 아이가 쉽게 정차할 수 있도록 정차 반경(5.8m) 및 허용 속도(3.4km/h)를 넉넉하게 설정
    for (const stop of this.world.busStops) {
      const dist = Math.hypot(busPos.x - stop.x, busPos.z - stop.z);

      if (dist < 5.8 && Math.abs(speedKmh) < 3.4) {
        if (stop.hasPassenger && !this.currentPassenger) {
          stop.hasPassenger = false;
          this.currentPassenger = {
            name: stop.passengerName,
            icon: stop.passengerIcon,
            targetStopName: stop.targetStopName,
            mesh: stop.passengerMesh
          };

          stop.passengerMesh.visible = false;
          stop.passengerMesh.userData.isBoarded = true;

          // 버스 문 열림 & 윙크 연출
          this.visualBus?.setDoorOpen(true);
          this.visualBus?.setExpression('wink', 3.5);
          soundManager.playDoor();

          const target = this.world.busStops.find(
            s => s.name.includes(stop.targetStopName) || stop.targetStopName.includes(s.name)
          );
          if (target && this.guideArrow) {
            this.targetStop = target;
            this.guideArrow.position.set(target.x, 4.8, target.z);
          }

          this.updateMissionBanner();
          this.resetInput();

          // 승객 탑승 시 4세 맞춤형 한글/숫자/영어/안전 놀이 미션 팝업 오픈!
          setTimeout(() => {
            educationManager.openMissionActivity(
              {
                icon: stop.passengerIcon,
                name: stop.passengerName,
                targetStopName: stop.targetStopName
              },
              starsEarned => {
                this.visualBus?.setDoorOpen(false);
                this.visualBus?.setExpression('happy', 3.0);
                this.addStar(
                  `${stop.passengerIcon} ${stop.passengerName}와 재미있는 공부 완료! 이제 ${stop.targetStopName}(으)로 출발!`,
                  starsEarned
                );
              }
            );
          }, 450);
          break;
        } else if (this.currentPassenger && this.targetStop && this.targetStop.id === stop.id) {
          // 목적지 정류장 도착!
          const p = this.currentPassenger.mesh;
          p.visible = true;
          p.userData.isBoarded = false;
          stop.hasPassenger = true;

          const finishedPassenger = this.currentPassenger;
          this.currentPassenger = null;
          this.targetStop = null;
          if (this.guideArrow) this.guideArrow.position.set(0, -999, 0);

          this.visualBus?.setDoorOpen(true);
          this.visualBus?.setExpression('happy', 3.5);
          setTimeout(() => this.visualBus?.setDoorOpen(false), 1800);

          soundManager.playDoor();
          soundManager.playCelebration();
          this.addStar(
            `🚏 ${finishedPassenger.icon} ${finishedPassenger.name} 손님을 ${stop.name}에 안전하게 모셔다드렸어요!`,
            3
          );
          soundManager.speak(`도착했어요! ${finishedPassenger.name} 손님이 고맙대요! 별 세 개 선물!`);
          this.updateMissionBanner();
          break;
        }
      }
    }

    // 4세 운전보조 타겟 갱신 (긴급출동 중이면 출동지, 승객 탑승 중이면 목적지 정류장, 아니면 가장 가까운 정류장)
    if (this.activeDispatch) {
      this.physics.kidAssistTarget = new THREE.Vector3(this.activeDispatch.targetX, 0, this.activeDispatch.targetZ);
    } else if (this.targetStop) {
      this.physics.kidAssistTarget = new THREE.Vector3(this.targetStop.x, 0, this.targetStop.z);
    } else {
      let nearest: BusStopData | null = null;
      let minDist = Infinity;
      for (const s of this.world.busStops) {
        if (!s.hasPassenger) continue;
        const d = Math.hypot(busPos.x - s.x, busPos.z - s.z);
        if (d < minDist) {
          minDist = d;
          nearest = s;
        }
      }
      this.physics.kidAssistTarget = nearest ? new THREE.Vector3(nearest.x, 0, nearest.z) : null;
    }
  }

  /**
   * 버스 앞에서 목적지 방향으로 이어지는 무지개 유도 도트 업데이트
   */
  private updateGuideDots(busPos: THREE.Vector3): void {
    const target = this.activeDispatch
      ? new THREE.Vector3(this.activeDispatch.targetX, 0, this.activeDispatch.targetZ)
      : this.targetStop
      ? new THREE.Vector3(this.targetStop.x, 0, this.targetStop.z)
      : this.physics.kidAssistTarget;

    if (!target) {
      this.guideDots.forEach(d => d.position.set(0, -999, 0));
      return;
    }

    const dir = new THREE.Vector3(target.x - busPos.x, 0, target.z - busPos.z);
    const totalDist = dir.length();
    if (totalDist < 4) {
      this.guideDots.forEach(d => d.position.set(0, -999, 0));
      return;
    }
    dir.normalize();

    this.guideDots.forEach((dot, idx) => {
      const stepDist = 3.5 + idx * 2.4;
      if (stepDist < totalDist) {
        const wave = Math.sin(this.totalTime * 6 - idx * 0.7) * 0.25;
        dot.position.set(busPos.x + dir.x * stepDist, 0.45 + Math.max(0, wave), busPos.z + dir.z * stepDist);
      } else {
        dot.position.set(0, -999, 0);
      }
    });
  }

  /**
   * 🗺️ 우측 상단 실시간 미니맵 렌더링 (실제 3D 월드 도로망 100% 동기화: 중앙 로터리 + 직선 도로 + 외곽 곡선 커브 + 랜드마크 + F1/긴급 차량!)
   */
  private drawMinimap(busPos: THREE.Vector3, busHeading: number): void {
    const ctx = this.minimapCtx;
    if (!ctx) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const scale = w / 330; // 확장된 월드 -165m ~ +165m 영역을 한눈에 매핑
    const toMapX = (wx: number) => w / 2 + wx * scale;
    const toMapY = (wz: number) => h / 2 - wz * scale; // +Z가 북쪽(위), -Z가 남쪽(아래)

    ctx.clearRect(0, 0, w, h);

    // 1. 잔디 배경
    ctx.fillStyle = this.timeOfDay === 'night' ? '#0F172A' : '#86EFAC';
    ctx.fillRect(0, 0, w, h);

    // 2. 실제 3D 도로망 (`this.world.minimapRoads`) 100% 동기화 렌더링!
    ctx.lineCap = 'butt';
    this.world.minimapRoads.forEach(seg => {
      if (seg.kind === 'roundabout' && seg.cx !== undefined && seg.cz !== undefined && seg.innerRadius && seg.outerRadius) {
        const cx = toMapX(seg.cx);
        const cy = toMapY(seg.cz);
        const rMid = ((seg.innerRadius + seg.outerRadius) / 2) * scale;
        const rWidth = (seg.outerRadius - seg.innerRadius) * scale;

        // 로터리 아스팔트 링
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = rWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, rMid, 0, Math.PI * 2);
        ctx.stroke();

        // 로터리 중앙 분수대 공원
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath();
        ctx.arc(cx, cy, seg.innerRadius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.8 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (seg.kind === 'straight' && seg.x1 !== undefined && seg.z1 !== undefined && seg.x2 !== undefined && seg.z2 !== undefined) {
        const x1 = toMapX(seg.x1);
        const y1 = toMapY(seg.z1);
        const x2 = toMapX(seg.x2);
        const y2 = toMapY(seg.z2);

        // 아스팔트 본체
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(4, seg.width * scale);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 노란색 중앙 차선
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (seg.kind === 'arc' && seg.cx !== undefined && seg.cz !== undefined && seg.radius !== undefined && seg.startAngle !== undefined && seg.endAngle !== undefined) {
        const cx = toMapX(seg.cx);
        const cy = toMapY(seg.cz);
        const r = seg.radius * scale;

        // 3D RingGeometry의 (cx + r*cos(t), cz - r*sin(t))는 미니맵 (toMapX, toMapY)에서 정확히 표준 각도 [startAngle, endAngle]에 대응!
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(4, seg.width * scale);
        ctx.beginPath();
        ctx.arc(cx, cy, r, seg.startAngle, seg.endAngle);
        ctx.stroke();

        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, seg.startAngle, seg.endAngle);
        ctx.stroke();
      }
    });

    // 3. 주요 인터랙티브 시설 (경찰서🚓, 소방서🚒, 병원🏥, 차고지🚌, 세차장🫧, 충전소⚡) 표시
    this.world.interactiveZones.forEach(z => {
      const zx = toMapX(z.x);
      const zy = toMapY(z.z);
      ctx.fillStyle = z.color || '#2563EB';
      ctx.beginPath();
      ctx.arc(zx, zy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // 4. 긴급출동 타겟 펄스 링 표시
    if (this.activeDispatch) {
      const dx = toMapX(this.activeDispatch.targetX);
      const dy = toMapY(this.activeDispatch.targetZ);
      const pulse = 7 + Math.sin(this.totalTime * 10) * 3.5;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(dx, dy, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. 버스 정류장 & 현재 승객 목적지 표시
    this.world.busStops.forEach(s => {
      const mx = toMapX(s.x);
      const my = toMapY(s.z);
      const isTarget = this.targetStop && this.targetStop.id === s.id;

      if (isTarget) {
        const pulse = 5 + Math.sin(this.totalTime * 8) * 3;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        ctx.arc(mx, my, pulse + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        ctx.arc(mx, my, 4.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.hasPassenger ? '#16A34A' : '#94A3B8';
        ctx.beginPath();
        ctx.arc(mx, my, 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 6. NPC 차량 (페라리 F1, 메르세데스 F1, 경찰차, 소방차, 구급차, 시티카) 실시간 마커
    this.world.npcVehicles.forEach(npc => {
      const nx = toMapX(npc.mesh.position.x);
      const ny = toMapY(npc.mesh.position.z);
      if (npc.kind === 'ferrari_f1') {
        ctx.fillStyle = '#DC0000';
      } else if (npc.kind === 'mercedes_f1') {
        ctx.fillStyle = '#00D2BE';
      } else if (npc.kind === 'pat') {
        ctx.fillStyle = '#3B82F6';
      } else if (npc.kind === 'frank') {
        ctx.fillStyle = '#EF4444';
      } else if (npc.kind === 'alice') {
        ctx.fillStyle = '#10B981';
      } else {
        ctx.fillStyle = '#F59E0B';
      }
      ctx.beginPath();
      ctx.arc(nx, ny, npc.isF1 ? 4.0 : 3.0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. 플레이어 차량 위치 및 방향 화살표
    const px = toMapX(busPos.x);
    const py = toMapY(busPos.z);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-busHeading);
    ctx.fillStyle = '#0080EE';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private updateSpeedometer(speedKmh: number): void {
    const absSpeed = Math.round(Math.abs(speedKmh));
    const speedValEl = document.getElementById('speed-value');
    const speedFillEl = document.getElementById('speed-bar-fill');
    if (speedValEl) speedValEl.textContent = String(absSpeed);
    if (speedFillEl) {
      const pct = Math.min(100, (absSpeed / 40) * 100);
      speedFillEl.style.width = `${pct}%`;
    }
  }

  // 부드러운 다각도 카메라 추적 (5가지 시점)
  private updateCamera(delta: number, busPos: THREE.Vector3, busQuat: THREE.Quaternion): void {
    const euler = new THREE.Euler().setFromQuaternion(busQuat, 'YXZ');
    const busHeading = euler.y;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(busQuat);

    if (this.cameraMode === 'chase') {
      // 1. 후방 3인칭 추적 뷰
      const idealOffset = new THREE.Vector3(
        -Math.sin(busHeading) * 10.6,
        5.5,
        -Math.cos(busHeading) * 10.6
      );
      const targetPos = busPos.clone().add(idealOffset);
      this.camera.position.lerp(targetPos, 8.0 * delta);
      const lookTarget = busPos.clone().add(new THREE.Vector3(0, 1.5, 0));
      this.camera.lookAt(lookTarget);

    } else if (this.cameraMode === 'front_face') {
      // 2. 🌟 아들을 위한 전면 얼굴 뷰! (차량 바로 앞에서 눈 깜빡임, 입 미소, 경광등을 마주보는 뷰)
      const frontOffset = forward.clone().multiplyScalar(7.2).add(new THREE.Vector3(0, 2.3, 0));
      const targetPos = busPos.clone().add(frontOffset);
      this.camera.position.lerp(targetPos, 9.0 * delta);
      const lookTarget = busPos.clone().add(new THREE.Vector3(0, 1.6, 0));
      this.camera.lookAt(lookTarget);

    } else if (this.cameraMode === 'first_person') {
      // 3. 1인칭 운전석 뷰 (차량 내부 앞유리 위치)
      const fpOffset = forward.clone().multiplyScalar(1.2).add(new THREE.Vector3(-0.4, 2.05, 0));
      const targetPos = busPos.clone().add(fpOffset);
      this.camera.position.lerp(targetPos, 14.0 * delta);
      const lookTarget = busPos.clone().add(forward.clone().multiplyScalar(18.0)).add(new THREE.Vector3(0, 1.8, 0));
      this.camera.lookAt(lookTarget);

    } else if (this.cameraMode === 'isometric') {
      // 4. 대각선 장난감 쿼터뷰 (Isometric 뷰)
      const isoOffset = new THREE.Vector3(14.0, 16.0, 14.0);
      const targetPos = busPos.clone().add(isoOffset);
      this.camera.position.lerp(targetPos, 7.0 * delta);
      this.camera.lookAt(busPos.clone().add(new THREE.Vector3(0, 1.0, 0)));

    } else if (this.cameraMode === 'top_down') {
      // 5. 수직 헬리콥터 탑다운 뷰
      const topOffset = new THREE.Vector3(0, 38, -12);
      const targetPos = busPos.clone().add(topOffset);
      this.camera.position.lerp(targetPos, 6.0 * delta);
      this.camera.lookAt(busPos);
    }
  }

  // 메인 게임 루프
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const frameDelta = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    this.totalTime += frameDelta;

    if (this.f1SoundCooldown > 0) this.f1SoundCooldown -= frameDelta;
    if (this.pedestrianBonusCooldown > 0) this.pedestrianBonusCooldown -= frameDelta;

    // 사이렌 켜져 있을 때 주기적 사이렌 사운드 재생
    if (this.isSirenOn) {
      this.sirenLoopTimer -= frameDelta;
      if (this.sirenLoopTimer <= 0) {
        this.sirenLoopTimer = 3.2;
        const kind =
          this.currentBusType === 'frank'
            ? 'fire'
            : this.currentBusType === 'alice'
            ? 'ambulance'
            : 'police';
        soundManager.playSiren(kind);
      }
    }

    // 학습 모달이 열려 있을 때는 차량 정지 유지
    const activeInput: InputState = educationManager.isOpen
      ? { forward: false, backward: false, left: false, right: false, brake: true }
      : this.input;

    // 1. 고정 시간 간격 Rapier3D 물리 업데이트
    this.physics.step(frameDelta, activeInput);

    // 2. 물리 차체 트랜스폼 가져오기
    const { position: busPos, quaternion: busQuat } = this.physics.getChassisTransform();
    const speedKmh = this.physics.getSpeedKmh();

    // 3. 비주얼 모델을 물리 트랜스폼에 동기화
    if (this.visualBus) {
      this.visualBus.root.position.copy(busPos);
      this.visualBus.root.quaternion.copy(busQuat);

      const euler = new THREE.Euler().setFromQuaternion(busQuat, 'YXZ');
      const wheelStates = this.physics.getWheelStates();

      const steerAngle = wheelStates.length > 0 ? wheelStates[0].steering : 0;
      this.visualBus.updateVisuals(speedKmh, steerAngle, frameDelta);

      wheelStates.forEach((ws, idx) => {
        if (this.visualBus && idx < this.visualBus.wheelMeshes.length) {
          const wMesh = this.visualBus.wheelMeshes[idx];
          wMesh.position.y = 0.42 - (ws.suspensionLength - 0.45);
        }
      });

      // 4. 카메라 및 미니맵, 속도계, 핸들 UI 각도 업데이트
      this.updateCamera(frameDelta, busPos, busQuat);
      this.drawMinimap(busPos, euler.y);
      this.updateSpeedometer(speedKmh);
      this.updateGuideDots(busPos);

      // 온스크린 실시간 파워핸들 UI 각도 동기화
      const steerDegrees = this.physics.getSteeringWheelDegrees();
      const wheelEl = document.getElementById('steering-wheel-visual');
      if (wheelEl) {
        wheelEl.style.transform = `rotate(${steerDegrees}deg)`;
      }
      const steerTextEl = document.getElementById('steering-angle-text');
      if (steerTextEl) {
        const rounded = Math.round(steerDegrees);
        steerTextEl.textContent = `${rounded > 0 ? '▶ +' : rounded < 0 ? '◀ ' : ''}${Math.abs(rounded)}°`;
      }

      // 5. 신호등 판정
      const traffic = this.world.updateTrafficLights(this.totalTime);
      this.checkTrafficRules(traffic, busPos, euler.y);

      // 6. 월드 동적 요소 (분수대, 불꽃, 보행자, F1 레이싱카, 경찰서/소방서/병원) 업데이트
      const worldEvents = this.world.updateWorldElements(
        frameDelta,
        busPos,
        traffic.nsState,
        traffic.ewState,
        Math.abs(speedKmh)
      );

      if (worldEvents.collectedStar) {
        this.addStar('🌟 도로 위 반짝이는 별을 찾았어요!', 1);
        this.visualBus.setExpression('wink', 1.5);
      }

      if (worldEvents.f1PassedBy && this.f1SoundCooldown <= 0) {
        this.f1SoundCooldown = 9.0;
        soundManager.playF1Passby();
        this.showPopup(`🏎️ 부아앙~! ${worldEvents.f1PassedBy} 레이싱카가 초고속으로 지나가요!`);
      }

      if (worldEvents.pedestrianYielded && this.pedestrianBonusCooldown <= 0) {
        this.pedestrianBonusCooldown = 18.0;
        this.addStar('🚸 횡단보도를 건너는 보행자를 안전하게 기다려줬어요!', 2);
        soundManager.speak('보행자가 건널 때까지 기다려주었네요! 정말 착해요!');
      }

      if (worldEvents.triggeredZone) {
        const z = worldEvents.triggeredZone;
        if (z.type === 'carwash') {
          soundManager.playCarWash();
          soundManager.speak('보글보글 쏴아! 세차장에서 깨끗하게 목욕했어요!');
          this.addStar('🫧 보글보글 세차장에서 반짝반짝 깨끗해졌어요!', 1);
          this.visualBus.setExpression('happy', 3.0);
        } else if (z.type === 'station') {
          soundManager.playCelebration();
          soundManager.speak('에너지 충전 완료! 힘이 불끈불끈 솟아요!');
          this.addStar('⚡ 충전소에서 에너지를 가득 채웠어요!', 1);
          this.visualBus.setExpression('happy', 3.0);
        } else if (z.type === 'garage') {
          soundManager.playDoor();
          this.showPopup('🏠 꼬마버스 차고지 문이 열렸어요! 반가워요!');
        } else if (z.type === 'police_station') {
          soundManager.playSiren('police');
          soundManager.speak('충성! 일일이 용감한 경찰서에 도착했어요! 우리 동네 안전 이상 무!');
          this.addStar('🚓 112 경찰서 안전 순찰 본부 방문 완료!', 2);
          this.visualBus.setExpression('wink', 3.0);
          if (this.activeDispatch && this.activeDispatch.stationType === 'police_station') {
            this.completeEmergencyDispatch();
          }
        } else if (z.type === 'fire_station') {
          const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(busQuat);
          const res = this.world.sprayWaterAtFire(busPos, forward);
          soundManager.playWaterSplash();
          if (res.extinguishedFire) {
            soundManager.playCelebration();
            soundManager.speak('쏴아아! 일일구 소방서 훈련 타워의 불을 시원하게 껐어요!');
            this.addStar('🚒💦 119 소방서 화재 진압 훈련 대성공!', 3);
          } else {
            soundManager.speak('일일구 용감한 소방서에 도착했어요! 언제든 출동 준비 완료!');
            this.addStar('🚒 119 소방서 안전 점검 완료!', 2);
          }
          this.visualBus.setExpression('happy', 3.5);
          if (this.activeDispatch && this.activeDispatch.stationType === 'fire_station') {
            this.completeEmergencyDispatch();
          }
        } else if (z.type === 'hospital') {
          soundManager.playHealChime();
          soundManager.speak('띠링띠링! 튼튼 어린이 종합병원에서 건강 에너지를 백 퍼센트 회복했어요!');
          this.addStar('🏥 튼튼 종합병원 응급실 방문 & 건강 충전 완료!', 2);
          this.visualBus.setExpression('happy', 3.5);
          if (this.activeDispatch && this.activeDispatch.stationType === 'hospital') {
            this.completeEmergencyDispatch();
          }
        }
      }

      // 7. 정류장 승하차 및 학습 미션 판정
      this.checkBusStops(busPos);

      // 8. 돌발상황 (축구공) 이벤트
      const ballEvent = this.world.updateBallHazard(frameDelta, busPos, euler.y);
      if (ballEvent.triggerAlert) {
        this.visualBus.setExpression('surprised', 2.5);
        soundManager.speak('어? 조심해요! 길 위로 공이 굴러와요! 멈춰요!');
        this.showPopup('⚽ 조심해요! 공이 굴러와요! 브레이크!');
      }
      if (ballEvent.safeStop && Math.abs(speedKmh) < 1.2) {
        this.addStar('⚽ 공을 보고 안전하게 잘 멈췄어요! 안전 대장!');
        soundManager.speak('휴~ 잘 멈췄어요! 안전 운전 최고예요!');
      }
      if (ballEvent.hit) {
        soundManager.playBoing();
        this.showPopup('⚽ 공이 통~ 튕겨나갔어요!');
      }

      // 9. 목적지 화살표 애니메이션
      if ((this.targetStop || this.activeDispatch) && this.guideArrow) {
        this.guideArrow.position.y = 4.8 + Math.sin(this.totalTime * 4) * 0.45;
        this.guideArrow.rotation.y += 2.5 * frameDelta;
      }

      // 10. 엔진 사운드 피치 조절
      soundManager.updateEngine(speedKmh / 35.0);
    }

    // 11. 3D 렌더링
    this.renderer.render(this.scene, this.camera);

    // 12. 성능 지표 갱신
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 500) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.metrics.frameTimeMs = +(frameDelta * 1000).toFixed(1);
      this.metrics.physicsTimeMs = +this.physics.physicsStepTimeMs.toFixed(2);
      this.metrics.speedKmh = +Math.abs(speedKmh).toFixed(1);

      this.frameCount = 0;
      this.lastFpsUpdate = now;
      this.updateDebugHud();
    }
  };

  private updateDebugHud(): void {
    const hud = document.getElementById('debug-hud');
    if (!hud) return;
    hud.innerHTML = `
      <div><strong>🎮 RP5 HUD</strong> | FPS: <span style="color:${this.metrics.fps >= 50 ? '#00E676' : '#FFD600'}">${this.metrics.fps}</span></div>
      <div>Frame: ${this.metrics.frameTimeMs}ms | Physics: ${this.metrics.physicsTimeMs}ms</div>
    `;
  }
}
