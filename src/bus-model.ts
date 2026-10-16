import * as THREE from 'three';
import { BusConfig, BusType, ExpressionType } from './types';

export const BUS_CONFIGS: Record<BusType, BusConfig> = {
  tayo: {
    id: 'tayo',
    name: '타요',
    number: '120',
    color: 0x0080EE,
    bodyHex: '#0080EE',
    accentColor: '#FFC400',
    foreheadBg: '#161A20',
    foreheadText: '#FFFFFF',
    hasWhiteVisor: false,
    noseColor: 0x0069C8,
    speedMultiplier: 1.0,
    turnMultiplier: 1.0,
    description: '호기심 강하고 명랑한 낙천적인 성격의 새내기 꼬마 버스',
    voiceIntro: '안녕! 나는 120번 꼬마버스 타요야! 신나게 출발해 볼까?'
  },
  rogi: {
    id: 'rogi',
    name: '로기',
    number: '1000',
    color: 0x46B81D,
    bodyHex: '#46B81D',
    accentColor: '#FFB300',
    foreheadBg: '#161A20',
    foreheadText: '#C6FF00',
    hasWhiteVisor: false,
    noseColor: 0x369414,
    speedMultiplier: 1.06,
    turnMultiplier: 1.0,
    description: '앞에 나서서 뽐내기를 좋아하는 활달한 성격의 초록 버스',
    voiceIntro: '하하! 나는 1000번 초록버스 로기! 내가 제일 멋지지?'
  },
  lani: {
    id: 'lani',
    name: '라니',
    number: '02',
    color: 0xFFCC00,
    bodyHex: '#FFCC00',
    accentColor: '#FF80AB',
    foreheadBg: '#161A20',
    foreheadText: '#FFE54C',
    hasWhiteVisor: false,
    noseColor: 0xE6AC00,
    speedMultiplier: 0.96,
    turnMultiplier: 1.08,
    description: '상냥하고 귀엽지만 겁이 많은 애교 만점 꼬마 숙녀 버스',
    voiceIntro: '반가워요! 나는 02번 노란버스 라니예요! 같이 놀아요!'
  },
  gani: {
    id: 'gani',
    name: '가니',
    number: '1339',
    color: 0xE22B24,
    bodyHex: '#E22B24',
    accentColor: '#FFFFFF',
    foreheadBg: '#161A20',
    foreheadText: '#FF5252',
    hasWhiteVisor: true,
    noseColor: 0xB81E18,
    speedMultiplier: 1.0,
    turnMultiplier: 0.96,
    description: '조용하고 생각이 깊어 남을 잘 배려하는 성실한 빨간 버스',
    voiceIntro: '안녕, 나는 1339번 가니야. 오늘도 안전하게 태워줄게.'
  }
};

export interface BusVisualInstance {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  wheelMeshes: THREE.Group[];
  steerPivots: THREE.Group[];
  headlights: THREE.Light[];
  headlightMeshes: THREE.Mesh[];
  config: BusConfig;
  setExpression: (expr: ExpressionType, duration?: number) => void;
  setDoorOpen: (open: boolean) => void;
  setNightLights: (enabled: boolean) => void;
  updateVisuals: (speed: number, steerAngle: number, delta: number) => void;
}

export class BusModelFactory {
  /**
   * 둥근 모서리 박스 지오메트리 생성 (타요 특유의 통통하고 부드러운 3D 곡면 재현)
   */
  private static createRoundedBoxGeometry(
    width: number,
    height: number,
    depth: number,
    radius: number = 0.18,
    smoothness: number = 6
  ): THREE.BufferGeometry {
    const shape = new THREE.Shape();
    const eps = 0.00001;
    const r = Math.min(radius, width * 0.4, height * 0.4) - eps;
    const w = width - r * 2;
    const h = height - r * 2;

    shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
    shape.absarc(eps, h, eps, Math.PI, Math.PI / 2, true);
    shape.absarc(w, h, eps, Math.PI / 2, 0, true);
    shape.absarc(w, eps, eps, 0, -Math.PI / 2, true);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.05, depth - radius * 2),
      bevelEnabled: true,
      bevelSegments: smoothness * 2,
      steps: 1,
      bevelSize: r,
      bevelThickness: radius,
      curveSegments: smoothness
    });

    geom.center();
    geom.computeVertexNormals();
    return geom;
  }

  /**
   * 실제 타요 일러스트(my_resources/tayo_rani_gani_rogi.jpg) 완벽 고증 정면 텍스처:
   * - 상단: 왼쪽 검은 노선번호 뱃지 + 오른쪽 흰색 바탕 위 3개의 원형 표시등
   * - 중단: 진한 네이비/차콜 틴팅 앞유리창 + 하단 검은 고무 몰딩 & 와이퍼
   * - 하단(앞유리 아래 컬러 차체 얼굴 영역!): 양쪽 둥근 눈 + 중앙 입체 코 + 환한 치아 미소 + 캐릭터별 볼/깜빡이 디테일
   */
  private static createFrontFaceTexture(config: BusConfig, expr: ExpressionType = 'normal'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // 1. 기본 차체 색상 바탕
    ctx.fillStyle = config.bodyHex;
    ctx.fillRect(0, 0, 1024, 1024);

    // 은은한 입체 음영 그라데이션 (가장자리 곡면 느낌)
    const bodyGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bodyGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
    bodyGrad.addColorStop(0.12, 'rgba(255,255,255,0.08)');
    bodyGrad.addColorStop(0.88, 'rgba(255,255,255,0.08)');
    bodyGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. 상단 이마 행선지/노선 표시창 (일체형 라운드 캡슐 바: 왼쪽 블랙 노선번호 + 오른쪽 화이트 3연속 원형 램프)
    const visorX = 88;
    const visorY = 44;
    const visorW = 848;
    const visorH = 112;

    // 바깥 다크 프레임
    ctx.fillStyle = '#14181F';
    ctx.beginPath();
    ctx.roundRect(visorX - 8, visorY - 8, visorW + 16, visorH + 16, 42);
    ctx.fill();

    // 오른쪽 흰색 패널 바탕
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(visorX, visorY, visorW, visorH, 36);
    ctx.fill();

    // 왼쪽 블랙 노선번호 영역
    const leftBadgeW = 360;
    ctx.fillStyle = config.foreheadBg;
    ctx.beginPath();
    ctx.roundRect(visorX, visorY, leftBadgeW, visorH, [36, 12, 12, 36]);
    ctx.fill();

    // 노선 번호 텍스트 (120, 1000, 02, 1339)
    ctx.fillStyle = config.foreheadText;
    ctx.font = '900 76px "Arial Black", "Nanum Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.number, visorX + leftBadgeW / 2, visorY + visorH / 2 + 4);

    // 오른쪽 3개의 동그란 표시등 (일러스트 고증)
    const lampStartX = visorX + leftBadgeW + 105;
    const lampGap = 135;
    const lampY = visorY + visorH / 2;
    for (let i = 0; i < 3; i++) {
      const lx = lampStartX + i * lampGap;
      // 바깥 베젤
      ctx.beginPath();
      ctx.arc(lx, lampY, 34, 0, Math.PI * 2);
      ctx.fillStyle = '#CFD8DC';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#90A4AE';
      ctx.stroke();

      // 안쪽 렌즈
      const lensGrad = ctx.createRadialGradient(lx - 6, lampY - 6, 4, lx, lampY, 26);
      lensGrad.addColorStop(0, '#FFFFFF');
      lensGrad.addColorStop(1, config.id === 'lani' ? '#FFF59D' : '#ECEFF1');
      ctx.beginPath();
      ctx.arc(lx, lampY, 26, 0, Math.PI * 2);
      ctx.fillStyle = lensGrad;
      ctx.fill();
    }

    // 3. 상단~중단 대형 앞유리창 (일러스트처럼 짙은 차콜-네이비 틴팅 글래스!)
    const winX = 72;
    const winY = 180;
    const winW = 880;
    const winH = 355;

    // 두꺼운 검은 고무 몰딩 테두리
    ctx.fillStyle = '#11151C';
    ctx.beginPath();
    ctx.roundRect(winX - 14, winY - 12, winW + 28, winH + 26, 44);
    ctx.fill();

    // 짙은 네이비/차콜 앞유리 본체
    const glassGrad = ctx.createLinearGradient(0, winY, 0, winY + winH);
    glassGrad.addColorStop(0, '#16202A');
    glassGrad.addColorStop(0.55, '#243447');
    glassGrad.addColorStop(1, '#2E4258');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 34);
    ctx.fill();

    // 앞유리 내부 은은한 운전석 핸들/대시보드 실루엣 및 대각선 하이라이트 반사광
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(winX, winY, winW, winH, 34);
    ctx.clip();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.beginPath();
    ctx.moveTo(winX + 80, winY + winH);
    ctx.lineTo(winX + 290, winY);
    ctx.lineTo(winX + 430, winY);
    ctx.lineTo(winX + 220, winY + winH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(winX + 470, winY + winH);
    ctx.lineTo(winX + 680, winY);
    ctx.lineTo(winX + 735, winY);
    ctx.lineTo(winX + 525, winY + winH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 앞유리 하단 검은 와이퍼 겸 눈썹! (일러스트에서 앞유리창 맨 아래 좌우에 아치형으로 달린 눈썹/와이퍼)
    const wiperY = winY + winH - 12;
    [275, 749].forEach((wx, idx) => {
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#0D1117';
      ctx.lineCap = 'round';
      const browOffset = expr === 'surprised' ? -18 : expr === 'happy' ? -8 : 0;
      if (idx === 0) {
        ctx.arc(wx, wiperY + 42 + browOffset, 95, Math.PI * 1.15, Math.PI * 1.82);
      } else {
        ctx.arc(wx, wiperY + 42 + browOffset, 95, Math.PI * 1.18, Math.PI * 1.85);
      }
      ctx.stroke();
      ctx.restore();
    });

    // 4. 앞유리 아래쪽 컬러 얼굴 영역 (y: 550 ~ 920)
    // 캐릭터별 하단 볼/방향지시등 장식 (일러스트 완벽 재현!)
    if (config.id === 'tayo') {
      // 타요: 양쪽 볼 아래 노란색 곡선 삼각 스트라이프
      ctx.fillStyle = '#FFC400';
      // 왼쪽 노란 볼 장식
      ctx.beginPath();
      ctx.moveTo(45, 790);
      ctx.quadraticCurveTo(185, 835, 310, 885);
      ctx.lineTo(310, 920);
      ctx.lineTo(45, 900);
      ctx.closePath();
      ctx.fill();

      // 오른쪽 노란 볼 장식
      ctx.beginPath();
      ctx.moveTo(979, 790);
      ctx.quadraticCurveTo(839, 835, 714, 885);
      ctx.lineTo(714, 920);
      ctx.lineTo(979, 900);
      ctx.closePath();
      ctx.fill();
    } else if (config.id === 'rogi') {
      // 로기: 양쪽 모서리 주황/노란 방향지시등 램프
      ctx.fillStyle = '#FFB300';
      ctx.beginPath();
      ctx.roundRect(48, 825, 165, 58, 22);
      ctx.roundRect(811, 825, 165, 58, 22);
      ctx.fill();
    } else if (config.id === 'lani') {
      // 라니: 핑크 볼터치 + 양쪽 날렵한 흰색/주황 코너 램프
      [185, 839].forEach(bx => {
        const blushGrad = ctx.createRadialGradient(bx, 760, 8, bx, 760, 56);
        blushGrad.addColorStop(0, 'rgba(255, 105, 180, 0.55)');
        blushGrad.addColorStop(1, 'rgba(255, 105, 180, 0)');
        ctx.fillStyle = blushGrad;
        ctx.beginPath();
        ctx.arc(bx, 760, 56, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.roundRect(52, 815, 130, 64, 24);
      ctx.roundRect(842, 815, 130, 64, 24);
      ctx.fill();
    }

    // 5. 환하게 웃는 입 (하단 중앙, 일러스트처럼 하얀 치아가 보이는 입체 미소!)
    const mouthCenterY = 765;
    ctx.save();
    if (expr === 'surprised') {
      // 놀란 동그란 입 "오!"
      ctx.beginPath();
      ctx.ellipse(512, mouthCenterY + 55, 75, 62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7F1D1D';
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    } else {
      // 타요 특유의 반달형 활짝 웃는 입
      ctx.beginPath();
      ctx.arc(512, mouthCenterY - 20, 175, 0.14 * Math.PI, 0.86 * Math.PI, false);
      ctx.quadraticCurveTo(512, mouthCenterY + 95, 512 - Math.cos(0.14 * Math.PI) * 175, mouthCenterY - 20 + Math.sin(0.14 * Math.PI) * 175);
      ctx.closePath();

      // 입 안쪽 어두운 배경
      ctx.fillStyle = '#3E2723';
      ctx.fill();

      // 입 안 클리핑하여 하얀 윗니 & 분홍 혀 그리기
      ctx.clip();

      // 하얀 치아 라인
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(320, mouthCenterY + 25, 384, 52);

      // 귀여운 분홍 혀
      ctx.beginPath();
      ctx.arc(512, mouthCenterY + 145, 95, Math.PI, 0, false);
      ctx.fillStyle = '#FF8A80';
      ctx.fill();

      ctx.restore();

      // 입술 흰색/실버 밝은 테두리 라인 (일러스트의 미소 테두리!)
      ctx.beginPath();
      ctx.arc(512, mouthCenterY - 20, 175, 0.14 * Math.PI, 0.86 * Math.PI, false);
      ctx.quadraticCurveTo(512, mouthCenterY + 95, 512 - Math.cos(0.14 * Math.PI) * 175, mouthCenterY - 20 + Math.sin(0.14 * Math.PI) * 175);
      ctx.closePath();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 3D 입체 눈알 텍스처 생성 (표정에 따라 기본 눈 / 윙크 / 웃는 눈 전환)
   */
  private static createEyeTexture(isLeft: boolean, mode: 'open' | 'wink' | 'blink' = 'open'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // 눈 바탕 (깨끗한 흰자위 + 입체 그림자)
    const eyeGrad = ctx.createRadialGradient(128, 128, 30, 128, 128, 124);
    eyeGrad.addColorStop(0, '#FFFFFF');
    eyeGrad.addColorStop(0.82, '#F8FAFC');
    eyeGrad.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    // 눈 테두리 링
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1E293B';
    ctx.stroke();

    if (mode === 'wink' || mode === 'blink') {
      // 귀여운 반달 윙크 눈 (`^`)
      ctx.beginPath();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#1E293B';
      ctx.lineCap = 'round';
      ctx.arc(128, 152, 64, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    } else {
      // 크고 초롱초롱한 눈동자 (중앙 쪽으로 살짝 모인 귀여운 시선)
      const px = 128 + (isLeft ? 12 : -12);
      const py = 132;

      // 홍채 바깥 링
      ctx.beginPath();
      ctx.arc(px, py, 64, 0, Math.PI * 2);
      ctx.fillStyle = '#263238';
      ctx.fill();

      // 짙은 검은 눈동자
      ctx.beginPath();
      ctx.arc(px, py, 54, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();

      // 큰 반사광 하이라이트 (10시 방향)
      ctx.beginPath();
      ctx.ellipse(px - 18, py - 20, 18, 22, -0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // 작은 반사광 하이라이트 (4시 방향)
      ctx.beginPath();
      ctx.arc(px + 18, py + 20, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 옆면 텍스처: 일러스트(tayo_rani_gani_rogi.jpg)와 동일하게
   * - 상단 짙은 네이비 통유리 창문 4칸 + 검은 창틀 몰딩
   * - 차체 측면에 큼직하게 적힌 검은색 노선 번호(120, 1000, 02, 1339)
   * - 측면 노란 방향지시등 및 하단 다크그레이 사이드 스커트 몰딩
   */
  private static createSideTexture(config: BusConfig, isRightSide: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. 바디 메인 컬러
    ctx.fillStyle = config.bodyHex;
    ctx.fillRect(0, 0, 1024, 512);

    // 하단 다크 그레이 사이드 스커트 라인
    ctx.fillStyle = '#262B30';
    ctx.fillRect(0, 452, 1024, 60);

    // 2. 상단 측면 창문 프레임 (짙은 차콜/네이비 유리창)
    const winTop = 44;
    const winHeight = 216;

    // 검은 창문 가스켓 틀
    ctx.fillStyle = '#11151C';
    ctx.beginPath();
    ctx.roundRect(36, winTop - 8, 952, winHeight + 16, 22);
    ctx.fill();

    // 4분할 측면 창문 + 승객 실루엣
    const numPanes = 4;
    const gap = 16;
    const paneW = (928 - gap * (numPanes - 1)) / numPanes;

    const glassGrad = ctx.createLinearGradient(0, winTop, 0, winTop + winHeight);
    glassGrad.addColorStop(0, '#16202A');
    glassGrad.addColorStop(0.6, '#243447');
    glassGrad.addColorStop(1, '#2E4258');

    for (let i = 0; i < numPanes; i++) {
      const wx = 48 + i * (paneW + gap);
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.roundRect(wx, winTop, paneW, winHeight, 14);
      ctx.fill();

      // 대각선 유리 반사광
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(wx + 25, winTop + winHeight);
      ctx.lineTo(wx + 95, winTop);
      ctx.lineTo(wx + 135, winTop);
      ctx.lineTo(wx + 65, winTop + winHeight);
      ctx.closePath();
      ctx.fill();
    }

    // 오른쪽 면 앞쪽에는 승하차 폴딩 도어 유리 프레임 표현
    const doorX = isRightSide ? 660 : 80;
    ctx.strokeStyle = '#0D1117';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(doorX, winTop, 170, 395, 14);
    ctx.stroke();

    // 3. 측면 차체 노선 번호 (일러스트처럼 창문 아래 차체에 굵은 블랙 텍스트로 120 / 1000 / 02 / 1339 표시!)
    const numX = isRightSide ? 390 : 634;
    const numY = 352;

    ctx.fillStyle = '#11151C';
    ctx.font = '900 84px "Arial Black", "Nanum Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.number, numX, numY);

    // 측면 작은 주황색 보조 방향지시등
    const blinkerX = isRightSide ? 875 : 149;
    ctx.fillStyle = '#FFB300';
    ctx.beginPath();
    ctx.roundRect(blinkerX, 345, 42, 22, 8);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 뒷면 텍스처 (뒷유리창 + 노선번호 + 후미등/브레이크등 + 배기구 디테일)
   */
  private static createRearTexture(config: BusConfig): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = config.bodyHex;
    ctx.fillRect(0, 0, 512, 512);

    // 뒷유리창
    ctx.fillStyle = '#11151C';
    ctx.beginPath();
    ctx.roundRect(52, 65, 408, 175, 26);
    ctx.fill();

    ctx.fillStyle = '#1E2D3D';
    ctx.beginPath();
    ctx.roundRect(62, 75, 388, 155, 20);
    ctx.fill();

    // 후면 노선번호 뱃지
    ctx.fillStyle = '#14181F';
    ctx.beginPath();
    ctx.roundRect(176, 268, 160, 58, 14);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.number, 256, 299);

    // 엔진룸 방열 슬릿
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 6;
    for (let y = 350; y <= 400; y += 16) {
      ctx.beginPath();
      ctx.moveTo(150, y);
      ctx.lineTo(362, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * 3D 꼬마버스 비주얼 생성 (타요, 로기, 라니, 가니)
   */
  public static createBusVisual(busType: BusType = 'tayo'): BusVisualInstance {
    const config = BUS_CONFIGS[busType] || BUS_CONFIGS.tayo;

    const root = new THREE.Group();
    root.name = `BusVisual_${config.id}`;

    const chassisGroup = new THREE.Group();
    chassisGroup.name = 'ChassisVisual';
    root.add(chassisGroup);

    const isLani = config.id === 'lani';
    const bodyW = isLani ? 1.92 : 2.02;
    const bodyH = isLani ? 1.96 : 2.04;
    const bodyL = isLani ? 3.35 : 3.62;
    const bodyCenterY = bodyH / 2 + 0.42;

    // 1. 둥근 모서리 3D 메인 차체 (Rounded Box)
    const bodyGeom = this.createRoundedBoxGeometry(bodyW, bodyH, bodyL, 0.22, 6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.28,
      metalness: 0.06
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = bodyCenterY;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // 2. 정면 얼굴 텍스처 패널 (앞유리 + 이마 노선표시판 + 웃는 입)
    const frontMat = new THREE.MeshBasicMaterial({
      map: this.createFrontFaceTexture(config, 'normal')
    });
    const frontGeom = new THREE.PlaneGeometry(bodyW * 0.88, bodyH * 0.88);
    const frontMesh = new THREE.Mesh(frontGeom, frontMat);
    frontMesh.position.set(0, bodyCenterY, bodyL / 2 + 0.012);
    chassisGroup.add(frontMesh);

    // 3. 앞유리 아래 볼 영역에 장착된 3D 입체 눈알 2개! (일러스트 완벽 재현!)
    const eyeRadius = isLani ? 0.23 : 0.24;
    const eyeY = bodyCenterY - bodyH * 0.14; // 앞유리 아래쪽 컬러 볼 영역!
    const eyeXOffset = bodyW * 0.24;
    const eyeZ = bodyL / 2 + 0.025;

    const leftEyeTexOpen = this.createEyeTexture(true, 'open');
    const rightEyeTexOpen = this.createEyeTexture(false, 'open');
    const leftEyeTexWink = this.createEyeTexture(true, 'wink');
    const rightEyeTexWink = this.createEyeTexture(false, 'wink');

    const eyeGeom = new THREE.SphereGeometry(eyeRadius, 24, 24);
    eyeGeom.scale(1.0, 1.08, 0.32); // 볼록하게 튀어나온 3D 눈알

    const leftEyeMat = new THREE.MeshBasicMaterial({ map: leftEyeTexOpen });
    const rightEyeMat = new THREE.MeshBasicMaterial({ map: rightEyeTexOpen });

    const leftEyeMesh = new THREE.Mesh(eyeGeom, leftEyeMat);
    leftEyeMesh.rotation.y = -Math.PI / 2;
    leftEyeMesh.position.set(eyeXOffset, eyeY, eyeZ);
    chassisGroup.add(leftEyeMesh);

    const rightEyeMesh = new THREE.Mesh(eyeGeom, rightEyeMat);
    rightEyeMesh.rotation.y = -Math.PI / 2;
    rightEyeMesh.position.set(-eyeXOffset, eyeY, eyeZ);
    chassisGroup.add(rightEyeMesh);

    // 4. 양쪽 눈 사이의 3D 가로형 캡슐 코 (일러스트의 핵심 입체 포인트)
    const noseGeom = new THREE.CapsuleGeometry(0.065, 0.28, 8, 16);
    noseGeom.rotateZ(Math.PI / 2);
    const noseMat = new THREE.MeshStandardMaterial({
      color: config.noseColor,
      roughness: 0.3,
      metalness: 0.05
    });
    const noseMesh = new THREE.Mesh(noseGeom, noseMat);
    noseMesh.position.set(0, eyeY - 0.04, bodyL / 2 + 0.055);
    chassisGroup.add(noseMesh);

    // 5. 지붕 위 3D 루프 에어컨 유닛 (캐릭터별 슬릿 디테일 반영)
    const roofPodW = bodyW * 0.62;
    const roofPodH = 0.28;
    const roofPodL = 1.55;
    const roofPodGeom = this.createRoundedBoxGeometry(roofPodW, roofPodH, roofPodL, 0.09, 4);
    const roofPod = new THREE.Mesh(roofPodGeom, bodyMat);
    roofPod.position.set(0, bodyCenterY + bodyH / 2 + 0.1, 0.18);
    roofPod.castShadow = true;
    chassisGroup.add(roofPod);

    // 루프 에어컨 전면 흡기구 슬릿 (타요는 세로 6슬릿, 로기/라니/가니는 가로 2슬릿)
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x161A20 });
    if (config.id === 'tayo') {
      for (let i = -2.5; i <= 2.5; i += 1) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.04), slotMat);
        slot.position.set(i * 0.14, bodyCenterY + bodyH / 2 + 0.12, 0.18 + roofPodL / 2 + 0.01);
        chassisGroup.add(slot);
      }
    } else {
      [-0.26, 0.26].forEach(sx => {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.075, 0.04), slotMat);
        slot.position.set(sx, bodyCenterY + bodyH / 2 + 0.12, 0.18 + roofPodL / 2 + 0.01);
        chassisGroup.add(slot);
      });
    }

    // 6. 하단 다크 그레이 입체 앞/뒤 범퍼 & 안개등
    const bumperMat = new THREE.MeshStandardMaterial({
      color: 0x22272E,
      roughness: 0.45,
      metalness: 0.15
    });
    const fBumpGeom = this.createRoundedBoxGeometry(bodyW * 1.03, 0.34, 0.32, 0.1, 4);
    const frontBumper = new THREE.Mesh(fBumpGeom, bumperMat);
    frontBumper.position.set(0, 0.48, bodyL / 2 + 0.06);
    chassisGroup.add(frontBumper);

    // 범퍼 양쪽 동그란 안개등 / 헤드라이트 + 야간용 SpotLight
    const headlights: THREE.Light[] = [];
    const headlightMeshes: THREE.Mesh[] = [];
    const fogGeom = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16);
    fogGeom.rotateX(Math.PI / 2);
    const fogMat = new THREE.MeshBasicMaterial({ color: 0xFFFDE7 });

    [-bodyW * 0.34, bodyW * 0.34].forEach(hx => {
      const fogLamp = new THREE.Mesh(fogGeom, fogMat);
      fogLamp.position.set(hx, 0.48, bodyL / 2 + 0.21);
      chassisGroup.add(fogLamp);
      headlightMeshes.push(fogLamp);
    });

    // 야간 주행용 전조등 불빛 (SpotLight + 빛 기둥 콘)
    const spotLight = new THREE.SpotLight(0xFFF9C4, 0, 32, Math.PI / 4, 0.45, 1.2);
    spotLight.position.set(0, 0.8, bodyL / 2 + 0.2);
    spotLight.target.position.set(0, 0, bodyL / 2 + 16);
    chassisGroup.add(spotLight);
    chassisGroup.add(spotLight.target);
    headlights.push(spotLight);

    // 뒷 범퍼
    const rBumpGeom = this.createRoundedBoxGeometry(bodyW * 1.03, 0.34, 0.26, 0.08, 4);
    const rearBumper = new THREE.Mesh(rBumpGeom, bumperMat);
    rearBumper.position.set(0, 0.48, -bodyL / 2 - 0.05);
    chassisGroup.add(rearBumper);

    // 7. 양쪽 3D 사이드미러 (일러스트처럼 앞유리 상단 모서리에서 뻗어 나오는 검은 파이프 암 + 둥근 사각 미러)
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x181C22, roughness: 0.4 });
    [-1, 1].forEach(dir => {
      const mGroup = new THREE.Group();
      mGroup.position.set(dir * (bodyW / 2 - 0.02), bodyCenterY + bodyH * 0.28, bodyL / 2 - 0.18);

      // 수평 암
      const armH = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 8), mirrorMat);
      armH.rotation.z = Math.PI / 2;
      armH.position.set(dir * 0.14, 0.06, 0);
      mGroup.add(armH);

      // 수직 암
      const armV = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 8), mirrorMat);
      armV.position.set(dir * 0.26, -0.04, 0);
      mGroup.add(armV);

      // 미러 헤드
      const head = new THREE.Mesh(this.createRoundedBoxGeometry(0.14, 0.34, 0.18, 0.04, 3), mirrorMat);
      head.position.set(dir * 0.26, -0.16, 0.02);
      mGroup.add(head);

      chassisGroup.add(mGroup);
    });

    // 8. 좌우 옆면 텍스처 & 3D 개폐형 승하차 문
    const sideGeom = new THREE.PlaneGeometry(bodyL * 0.88, bodyH * 0.86);
    const rightMat = new THREE.MeshBasicMaterial({ map: this.createSideTexture(config, true) });
    const rSideMesh = new THREE.Mesh(sideGeom, rightMat);
    rSideMesh.position.set(bodyW / 2 + 0.012, bodyCenterY, 0);
    rSideMesh.rotation.y = Math.PI / 2;
    chassisGroup.add(rSideMesh);

    const leftMat = new THREE.MeshBasicMaterial({ map: this.createSideTexture(config, false) });
    const lSideMesh = new THREE.Mesh(sideGeom, leftMat);
    lSideMesh.position.set(-bodyW / 2 - 0.012, bodyCenterY, 0);
    lSideMesh.rotation.y = -Math.PI / 2;
    chassisGroup.add(lSideMesh);

    // 3D 폴딩 도어 패널 (승하차 시 옆으로 열리는 애니메이션 지원)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(bodyW / 2 + 0.02, bodyCenterY - 0.12, bodyL * 0.22);
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, bodyH * 0.72, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.2, metalness: 0.3 })
    );
    doorPivot.add(doorPanel);
    chassisGroup.add(doorPivot);
    let targetDoorOpen = false;

    // 9. 뒷면 텍스처 및 후미등
    const rearMat = new THREE.MeshBasicMaterial({ map: this.createRearTexture(config) });
    const rearGeom = new THREE.PlaneGeometry(bodyW * 0.86, bodyH * 0.86);
    const rearMesh = new THREE.Mesh(rearGeom, rearMat);
    rearMesh.position.set(0, bodyCenterY, -bodyL / 2 - 0.012);
    rearMesh.rotation.y = Math.PI;
    chassisGroup.add(rearMesh);

    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
    const tailGeom = this.createRoundedBoxGeometry(0.28, 0.18, 0.08, 0.03, 3);
    [-bodyW * 0.32, bodyW * 0.32].forEach(x => {
      const tl = new THREE.Mesh(tailGeom, tailLightMat);
      tl.position.set(x, 0.78, -bodyL / 2 - 0.02);
      chassisGroup.add(tl);
    });

    // 10. 3D 휠 아치 (휀더 몰딩) 및 4개의 입체 타이어/휠
    const wheelMeshes: THREE.Group[] = [];
    const steerPivots: THREE.Group[] = [];

    const wheelRadius = 0.42;
    const wheelThickness = 0.32;
    const tireGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 28);
    tireGeom.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1C2026, roughness: 0.75 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xECEFF1, roughness: 0.25, metalness: 0.35 });
    const hubMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.3 });

    const wheelPositions = [
      { name: 'FL', x: -bodyW / 2 - 0.03, z: bodyL * 0.29, isFront: true },
      { name: 'FR', x: bodyW / 2 + 0.03, z: bodyL * 0.29, isFront: true },
      { name: 'RL', x: -bodyW / 2 - 0.03, z: -bodyL * 0.29, isFront: false },
      { name: 'RR', x: bodyW / 2 + 0.03, z: -bodyL * 0.29, isFront: false }
    ];

    // 휠 아치 눈썹 몰딩 추가
    const archGeom = new THREE.TorusGeometry(wheelRadius + 0.06, 0.06, 10, 20, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x22272E, roughness: 0.5 });

    wheelPositions.forEach(pos => {
      const arch = new THREE.Mesh(archGeom, archMat);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(pos.x * 0.96, wheelRadius + 0.05, pos.z);
      chassisGroup.add(arch);

      const wheelGroup = new THREE.Group();

      const tire = new THREE.Mesh(tireGeom, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, wheelThickness * 1.05, 20);
      rimGeom.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeom, rimMat);
      wheelGroup.add(rim);

      const hubGeom = new THREE.CylinderGeometry(wheelRadius * 0.25, wheelRadius * 0.25, wheelThickness * 1.12, 12);
      hubGeom.rotateZ(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeom, hubMat);
      wheelGroup.add(hub);

      if (pos.isFront) {
        const steerPivot = new THREE.Group();
        steerPivot.position.set(pos.x, wheelRadius, pos.z);
        steerPivot.add(wheelGroup);
        root.add(steerPivot);
        steerPivots.push(steerPivot);
      } else {
        wheelGroup.position.set(pos.x, wheelRadius, pos.z);
        root.add(wheelGroup);
      }

      wheelMeshes.push(wheelGroup);
    });

    // 표정 및 눈 깜빡임 상태 관리
    let currentExpr: ExpressionType = 'normal';
    let exprTimer = 0;
    let blinkTimer = 2.8;
    let isBlinking = false;

    const setExpression = (expr: ExpressionType, duration: number = 2.5) => {
      currentExpr = expr;
      exprTimer = duration;
      if (expr === 'wink' || expr === 'happy') {
        leftEyeMat.map = leftEyeTexWink;
        rightEyeMat.map = expr === 'happy' ? rightEyeTexWink : rightEyeTexOpen;
      } else {
        leftEyeMat.map = leftEyeTexOpen;
        rightEyeMat.map = rightEyeTexOpen;
      }
      leftEyeMat.needsUpdate = true;
      rightEyeMat.needsUpdate = true;
    };

    const setDoorOpen = (open: boolean) => {
      targetDoorOpen = open;
    };

    const setNightLights = (enabled: boolean) => {
      spotLight.intensity = enabled ? 4.5 : 0;
      headlightMeshes.forEach(m => {
        (m.material as THREE.MeshBasicMaterial).color.setHex(enabled ? 0xFFFF00 : 0xFFFDE7);
      });
    };

    const updateVisuals = (speed: number, steerAngle: number, delta: number) => {
      // 바퀴 회전
      const rotDelta = speed * 0.075;
      wheelMeshes.forEach(w => {
        w.rotation.x += rotDelta;
      });

      // 앞바퀴 조향 피벗 회전
      steerPivots.forEach(pivot => {
        pivot.rotation.y = steerAngle;
      });

      // 시선이 조향 방향을 따라 살짝 돌아가는 생동감 있는 눈동자 연출!
      const eyeLookOffset = THREE.MathUtils.clamp(steerAngle * 0.35, -0.18, 0.18);
      leftEyeMesh.rotation.y = -Math.PI / 2 + eyeLookOffset;
      rightEyeMesh.rotation.y = -Math.PI / 2 + eyeLookOffset;

      // 자연스러운 자동 눈 깜빡임 (Blinking)
      if (exprTimer > 0) {
        exprTimer -= delta;
        if (exprTimer <= 0) {
          currentExpr = 'normal';
          leftEyeMat.map = leftEyeTexOpen;
          rightEyeMat.map = rightEyeTexOpen;
        }
      } else {
        blinkTimer -= delta;
        if (blinkTimer <= 0 && !isBlinking) {
          isBlinking = true;
          blinkTimer = 0.14;
          leftEyeMat.map = leftEyeTexWink;
          rightEyeMat.map = rightEyeTexWink;
        } else if (blinkTimer <= 0 && isBlinking) {
          isBlinking = false;
          blinkTimer = 2.5 + Math.random() * 2.5;
          leftEyeMat.map = leftEyeTexOpen;
          rightEyeMat.map = rightEyeTexOpen;
        }
      }

      // 승하차 도어 개폐 애니메이션
      const targetDoorZ = targetDoorOpen ? bodyL * 0.22 - 0.52 : bodyL * 0.22;
      const targetDoorX = targetDoorOpen ? bodyW / 2 + 0.12 : bodyW / 2 + 0.02;
      doorPivot.position.z += (targetDoorZ - doorPivot.position.z) * 8 * delta;
      doorPivot.position.x += (targetDoorX - doorPivot.position.x) * 8 * delta;

      // 서스펜션 코너링 롤링 & 주행 바운스
      const targetRoll = -steerAngle * Math.min(1.1, Math.abs(speed) * 0.11);
      chassisGroup.rotation.z += (targetRoll - chassisGroup.rotation.z) * 12 * delta;

      if (Math.abs(speed) > 0.1) {
        chassisGroup.position.y = Math.sin(Date.now() * 0.015) * 0.025;
      } else {
        chassisGroup.position.y += (0 - chassisGroup.position.y) * 8 * delta;
      }
    };

    return {
      root,
      chassisGroup,
      wheelMeshes,
      steerPivots,
      headlights,
      headlightMeshes,
      config,
      setExpression,
      setDoorOpen,
      setNightLights,
      updateVisuals
    };
  }

  /**
   * 마을을 순찰하는 귀여운 AI 친구 차량 생성 (패트 경찰차, 프랭크 소방차, 앨리스 구급차, 다른 꼬마버스)
   */
  public static createNpcCarMesh(type: 'pat' | 'frank' | 'alice' | 'rogi' | 'lani'): {
    mesh: THREE.Group;
    wheelMeshes: THREE.Object3D[];
    headlights: THREE.Light[];
  } {
    if (type === 'rogi' || type === 'lani') {
      const bus = this.createBusVisual(type);
      return {
        mesh: bus.root,
        wheelMeshes: bus.wheelMeshes,
        headlights: bus.headlights
      };
    }

    const group = new THREE.Group();
    const wheelMeshes: THREE.Object3D[] = [];
    const headlights: THREE.Light[] = [];

    const isFrank = type === 'frank';
    const mainColor = type === 'pat' ? 0x1E3A8A : isFrank ? 0xDC2626 : 0xFFFFFF;
    const subColor = type === 'pat' ? 0xFFFFFF : isFrank ? 0xFBBF24 : 0xEF4444;

    const bodyW = isFrank ? 1.95 : 1.75;
    const bodyH = isFrank ? 1.85 : 1.45;
    const bodyL = isFrank ? 3.6 : 2.95;

    // 하단 차체
    const lowerGeom = this.createRoundedBoxGeometry(bodyW, bodyH * 0.58, bodyL, 0.14, 4);
    const lowerMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.3 });
    const lowerMesh = new THREE.Mesh(lowerGeom, lowerMat);
    lowerMesh.position.y = 0.4 + bodyH * 0.29;
    lowerMesh.castShadow = true;
    group.add(lowerMesh);

    // 상단 캐빈
    const cabinGeom = this.createRoundedBoxGeometry(bodyW * 0.88, bodyH * 0.48, bodyL * 0.68, 0.12, 4);
    const cabinMat = new THREE.MeshStandardMaterial({ color: subColor, roughness: 0.3 });
    const cabinMesh = new THREE.Mesh(cabinGeom, cabinMat);
    cabinMesh.position.set(0, 0.4 + bodyH * 0.75, -0.15);
    cabinMesh.castShadow = true;
    group.add(cabinMesh);

    // 귀여운 눈 2개
    const eyeGeom = new THREE.SphereGeometry(0.18, 16, 16);
    eyeGeom.scale(1, 1, 0.3);
    const eyeMat = new THREE.MeshBasicMaterial({ map: this.createEyeTexture(true, 'open') });
    [-0.42, 0.42].forEach(ex => {
      const eye = new THREE.Mesh(eyeGeom, eyeMat);
      eye.rotation.y = -Math.PI / 2;
      eye.position.set(ex, 0.4 + bodyH * 0.68, bodyL * 0.34 + 0.02);
      group.add(eye);
    });

    // 경광등 (사이렌 바)
    const sirenGroup = new THREE.Group();
    sirenGroup.position.set(0, 0.4 + bodyH + 0.06, -0.1);
    const redSiren = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xFF1744 })
    );
    redSiren.position.x = -0.24;
    const blueSiren = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.16, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x00B0FF })
    );
    blueSiren.position.x = 0.24;
    sirenGroup.add(redSiren, blueSiren);
    group.add(sirenGroup);

    // 바퀴 4개
    const wGeom = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 16);
    wGeom.rotateZ(Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x1E293B });
    [
      [-bodyW / 2, 0.36, bodyL * 0.3],
      [bodyW / 2, 0.36, bodyL * 0.3],
      [-bodyW / 2, 0.36, -bodyL * 0.3],
      [bodyW / 2, 0.36, -bodyL * 0.3]
    ].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeom, wMat);
      w.position.set(wx, wy, wz);
      group.add(w);
      wheelMeshes.push(w);
    });

    return { mesh: group, wheelMeshes, headlights };
  }
}
