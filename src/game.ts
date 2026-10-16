import * as THREE from 'three';
import { PhysicsEngine } from './physics';
import { WorldManager } from './world';
import { BusModelFactory, BusVisualInstance } from './bus-model';
import { soundManager } from './sound';
import { educationManager } from './education';
import { BusStopData, BusType, CameraMode, DebugMetrics, InputState, TimeOfDay } from './types';

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
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0045);

    // 2. Camera (확장된 월드를 시원하게 볼 수 있도록 far 클리핑 확장)
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 480);
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
    this.dirLight.position.set(65, 95, 55);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 260;
    const d = 95;
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

    // 5. 차량 물리 및 비주얼 버스 생성 (타요 차고지 정류장 앞 스폰)
    this.physics.createVehicle(-3.5, 1.2, 10, 0);
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

  // 비주얼 버스 교체 (타요, 로기, 라니, 가니)
  public spawnVisualBus(busType: BusType): void {
    if (this.visualBus) {
      this.scene.remove(this.visualBus.root);
    }

    this.currentBusType = busType;
    this.visualBus = BusModelFactory.createBusVisual(busType);
    this.visualBus.setNightLights(this.timeOfDay !== 'day');
    this.visualBus.setExpression('happy', 3.0);
    this.scene.add(this.visualBus.root);

    soundManager.speak(this.visualBus.config.voiceIntro);
    this.showPopup(`🚌 ${this.visualBus.config.name} (${this.visualBus.config.number}번) 탑승!`);
  }

  // 낮 / 노을 / 밤 시간대 전환 (헤드라이트 및 가로등 점등!)
  public toggleTimeOfDay(): TimeOfDay {
    if (this.timeOfDay === 'day') {
      this.timeOfDay = 'sunset';
      this.scene.background = new THREE.Color(0xFD7E53);
      this.scene.fog = new THREE.FogExp2(0xFD7E53, 0.0045);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0xFFCCBC);
        this.hemiLight.groundColor.setHex(0x4E342E);
        this.hemiLight.intensity = 0.65;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0xFFAB40);
        this.dirLight.intensity = 0.9;
      }
      this.showPopup('🌅 노을 지는 저녁이에요! 헤드라이트 켜짐!');
      soundManager.speak('예쁜 노을이 지고 있어요! 헤드라이트를 켰어요!');
    } else if (this.timeOfDay === 'sunset') {
      this.timeOfDay = 'night';
      this.scene.background = new THREE.Color(0x0F172A);
      this.scene.fog = new THREE.FogExp2(0x0F172A, 0.005);
      if (this.hemiLight) {
        this.hemiLight.color.setHex(0x38BDF8);
        this.hemiLight.groundColor.setHex(0x0F172A);
        this.hemiLight.intensity = 0.42;
      }
      if (this.dirLight) {
        this.dirLight.color.setHex(0x93C5FD);
        this.dirLight.intensity = 0.45;
      }
      this.showPopup('🌙 반짝반짝 밤이에요! 전조등이 길을 비춰요!');
      soundManager.speak('밤이 되었어요! 환한 불빛으로 안전하게 달려요!');
    } else {
      this.timeOfDay = 'day';
      this.scene.background = new THREE.Color(0x87CEEB);
      this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0045);
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

  // 언제든 상단 버튼으로 한글/숫자/영어 놀이 열기
  public openLearningNow(): void {
    if (educationManager.isOpen) return;
    this.resetInput();
    educationManager.openMissionActivity(null, starsEarned => {
      this.addStar('🎓 신나는 한글·숫자·영어 놀이 완료!', starsEarned);
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
    soundManager.speak('타요를 바로 세웠어요! 안전하게 다시 출발!');
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
    this.showPopup('🎺 빵빵! 비켜주세요~ 타요가 나가요!');
  }

  // 카메라 시점 전환 (5가지 모드: 3인칭 기본, 버스 얼굴 전면뷰, 1인칭 운전석, 대각선 쿼터뷰, 탑다운)
  public toggleCamera(): CameraMode {
    const modes: CameraMode[] = ['chase', 'front_face', 'first_person', 'isometric', 'top_down'];
    const nextIdx = (modes.indexOf(this.cameraMode) + 1) % modes.length;
    this.cameraMode = modes[nextIdx];

    const labels: Record<CameraMode, string> = {
      chase: '🚗 3인칭 후방 추적 뷰',
      front_face: '👀 타요 얼굴 뷰 (눈 깜빡임 & 표정 감상)',
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
      soundManager.speak(`우와! 별을 ${this.stars}개나 모았어요! 꼬마버스 최고 안전 대장!`);
    }
  }

  private updateMissionBanner(): void {
    const banner = document.getElementById('mission-status-bar');
    if (!banner) return;

    if (this.currentPassenger && this.targetStop) {
      banner.innerHTML = `${this.currentPassenger.icon} <strong>${this.currentPassenger.name}</strong> 탑승 중 ➔ 목적지: <strong>${this.targetStop.icon} ${this.targetStop.name}</strong> (무지개 별을 따라가세요!)`;
      banner.classList.add('active-mission');
    } else {
      banner.innerHTML = `🚏 노란색 <strong>버스 정류장</strong>에 멈춰서 동물 친구들을 태워주세요! (한글·숫자·영어 놀이 시작!)`;
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
    const distCenter = Math.sqrt(busPos.x * busPos.x + busPos.z * busPos.z);
    if (distCenter > 15) {
      this.hasStoppedForRedLight = false;
      return;
    }

    const absHeading = Math.abs(busHeading % Math.PI);
    const isNorthSouth = absHeading < Math.PI / 4 || absHeading > (3 * Math.PI) / 4;
    const light = isNorthSouth ? trafficState.nsState : trafficState.ewState;

    const speedKmh = this.physics.getSpeedKmh();

    if (light === 'red') {
      if (distCenter >= 5.5 && distCenter <= 12.0 && Math.abs(speedKmh) < 1.5) {
        if (!this.hasStoppedForRedLight) {
          this.hasStoppedForRedLight = true;
          this.addStar('🚦 빨간불에 멈춰섰어요! 참 잘했어요!');
          soundManager.speak('빨간불에 아주 잘 멈췄어요! 신호등 박사님이네요!');
        }
      } else if (distCenter < 5.0 && Math.abs(speedKmh) > 6.0 && !this.hasStoppedForRedLight) {
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
   * 정류장 승객 탑승 & 4세 한글·숫자·영어 미션 연동 & 목적지 도착 판정
   */
  private checkBusStops(busPos: THREE.Vector3): void {
    if (educationManager.isOpen) return;
    const speedKmh = this.physics.getSpeedKmh();

    // 4세 아이가 쉽게 정차할 수 있도록 정차 반경(5.6m) 및 허용 속도(3.2km/h)를 넉넉하게 설정
    for (const stop of this.world.busStops) {
      const dist = Math.hypot(busPos.x - stop.x, busPos.z - stop.z);

      if (dist < 5.6 && Math.abs(speedKmh) < 3.2) {
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

          // 승객 탑승 시 4세 맞춤형 한글/숫자/영어 놀이 미션 팝업 오픈!
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

    // 4세 운전보조 타겟 갱신 (승객 탑승 중이면 목적지 정류장, 아니면 가장 가까운 정류장)
    if (this.targetStop) {
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
    const target = this.targetStop
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
   * 우측 상단 실시간 미니맵 렌더링 (도로망, 정류장, 목적지, 세차장, 충전소, 내 버스 위치 표시)
   */
  private drawMinimap(busPos: THREE.Vector3, busHeading: number): void {
    const ctx = this.minimapCtx;
    if (!ctx) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const scale = w / 250; // 월드 -125 ~ +125 영역 매핑
    const toMapX = (wx: number) => w / 2 + wx * scale;
    const toMapY = (wz: number) => h / 2 - wz * scale; // +Z가 위쪽(북쪽)으로 보이도록

    ctx.clearRect(0, 0, w, h);

    // 1. 잔디 배경
    ctx.fillStyle = this.timeOfDay === 'night' ? '#0F172A' : '#86EFAC';
    ctx.fillRect(0, 0, w, h);

    // 2. 도로망 그리기
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    const roads = [-108, -48, 0, 48, 108];
    roads.forEach(r => {
      // 가로 도로
      ctx.beginPath();
      ctx.moveTo(toMapX(-112), toMapY(r));
      ctx.lineTo(toMapX(112), toMapY(r));
      ctx.stroke();

      // 세로 도로
      ctx.beginPath();
      ctx.moveTo(toMapX(r), toMapY(-112));
      ctx.lineTo(toMapX(r), toMapY(112));
      ctx.stroke();
    });

    // 3. 인터랙티브 시설 아이콘 (차고지, 세차장, 충전소)
    this.world.interactiveZones.forEach(z => {
      ctx.fillStyle = z.type === 'carwash' ? '#0284C7' : z.type === 'station' ? '#059669' : '#2563EB';
      ctx.beginPath();
      ctx.arc(toMapX(z.x), toMapY(z.z), 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. 버스 정류장 & 현재 미션 목적지 표시
    this.world.busStops.forEach(s => {
      const mx = toMapX(s.x);
      const my = toMapY(s.z);
      const isTarget = this.targetStop && this.targetStop.id === s.id;

      if (isTarget) {
        const pulse = 6 + Math.sin(this.totalTime * 8) * 3;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        ctx.arc(mx, my, pulse + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#EAB308';
        ctx.beginPath();
        ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.hasPassenger ? '#16A34A' : '#94A3B8';
        ctx.beginPath();
        ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 5. NPC 차량 점 표시
    this.world.npcVehicles.forEach(npc => {
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(toMapX(npc.mesh.position.x), toMapY(npc.mesh.position.z), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. 플레이어 타요 버스 위치 및 방향 화살표
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
    const up = new THREE.Vector3(0, 1, 0);

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
      // 2. 🌟 아들을 위한 전면 타요 얼굴 뷰! (버스 바로 앞에서 타요 얼굴, 눈 깜빡임, 입 미소를 마주보는 뷰)
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

      // 6. 월드 동적 요소 (승객, 세차장, 충전소, 차고지, 도로 별, NPC 차량) 업데이트
      const worldEvents = this.world.updateWorldElements(frameDelta, busPos);
      if (worldEvents.collectedStar) {
        this.addStar('🌟 도로 위 반짝이는 별을 찾았어요!', 1);
        this.visualBus.setExpression('wink', 1.5);
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
      if (this.targetStop && this.guideArrow) {
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
