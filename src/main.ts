import { TayoGame } from './game';
import { soundManager } from './sound';
import { BusType } from './types';
import { BUS_CONFIGS } from './bus-model';

document.addEventListener('DOMContentLoaded', async () => {
  const game = new TayoGame('game-container');
  await game.init();
  (window as unknown as { game: TayoGame }).game = game;

  // 첫 사용자 제스처 시 사운드 컨텍스트 잠금 해제 및 BGM 시작
  const unlockAudio = () => {
    soundManager.init();
    soundManager.startEngine();
    soundManager.startBgm();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  // BGM 토글 헬퍼
  const handleToggleBgm = () => {
    soundManager.init();
    const isPlaying = soundManager.toggleBgm();
    const btnBgm = document.getElementById('btn-bgm');
    if (btnBgm) {
      btnBgm.innerHTML = isPlaying ? '<span>🎵</span><span>음악 ON</span>' : '<span>🔇</span><span>음악 OFF</span>';
    }
  };

  // 1. 키보드 입력 바인딩 (화살표, WASD, 스페이스, C, R, L, T, M, E)
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        game.input.forward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        game.input.backward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        game.input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        game.input.right = true;
        break;
      case 'KeyB':
        game.input.brake = true;
        break;
      case 'Space':
        e.preventDefault();
        game.honk();
        break;
      case 'KeyC':
        game.toggleCamera();
        break;
      case 'KeyR':
        game.recoverVehicle();
        break;
      case 'KeyL':
        game.toggleLowSpecMode();
        break;
      case 'KeyT':
        game.toggleTimeOfDay();
        break;
      case 'KeyM':
        handleToggleBgm();
        break;
      case 'KeyE':
        game.openLearningNow();
        break;
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        game.input.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        game.input.backward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        game.input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        game.input.right = false;
        break;
      case 'KeyB':
        game.input.brake = false;
        break;
    }
  });

  // 2. 화면 터치 & 마우스 온스크린 버튼 바인딩
  const bindButton = (btnId: string, onDown: () => void, onUp: () => void) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const start = (e: Event) => {
      e.preventDefault();
      btn.classList.add('active');
      onDown();
    };

    const end = (e: Event) => {
      e.preventDefault();
      btn.classList.remove('active');
      onUp();
    };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('touchcancel', end, { passive: false });
  };

  bindButton('btn-gas', () => game.input.forward = true, () => game.input.forward = false);
  bindButton('btn-reverse', () => game.input.backward = true, () => game.input.backward = false);
  bindButton('btn-brake', () => game.input.brake = true, () => game.input.brake = false);
  bindButton('btn-left', () => game.input.left = true, () => game.input.left = false);
  bindButton('btn-right', () => game.input.right = true, () => game.input.right = false);

  // 경적 버튼
  const btnHorn = document.getElementById('btn-horn');
  if (btnHorn) {
    btnHorn.addEventListener('click', (e) => {
      e.preventDefault();
      game.honk();
    });
  }

  // 카메라 시점 전환 버튼
  const btnCamera = document.getElementById('btn-camera');
  if (btnCamera) {
    btnCamera.addEventListener('click', () => game.toggleCamera());
  }

  // 바로세우기 (복구) 버튼
  const btnRecover = document.getElementById('btn-recover');
  if (btnRecover) {
    btnRecover.addEventListener('click', () => game.recoverVehicle());
  }

  // 저사양 모드 토글 버튼
  const btnLowSpec = document.getElementById('btn-low-spec');
  if (btnLowSpec) {
    btnLowSpec.addEventListener('click', () => game.toggleLowSpecMode());
  }

  // 4세 놀이교실 바로 열기 버튼
  const btnEduOpen = document.getElementById('btn-edu-open');
  if (btnEduOpen) {
    btnEduOpen.addEventListener('click', () => game.openLearningNow());
  }

  // 낮/노을/밤 전환 버튼
  const btnTime = document.getElementById('btn-time');
  if (btnTime) {
    btnTime.addEventListener('click', () => game.toggleTimeOfDay());
  }

  // 배경음악 토글 버튼
  const btnBgm = document.getElementById('btn-bgm');
  if (btnBgm) {
    btnBgm.addEventListener('click', () => handleToggleBgm());
  }

  // 4세 운전보조 토글 버튼
  const btnKidAssist = document.getElementById('btn-kid-assist');
  if (btnKidAssist) {
    btnKidAssist.addEventListener('click', () => game.toggleKidAssist());
  }

  // 3. 캐릭터 선택 팝업 모달
  const modal = document.getElementById('char-modal');
  const btnOpenSelect = document.getElementById('btn-char-select');
  const btnCloseModal = document.getElementById('btn-close-modal');

  if (btnOpenSelect && modal) {
    btnOpenSelect.addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
  }

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  document.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', () => {
      const charId = card.getAttribute('data-char') as BusType | null;
      if (charId && BUS_CONFIGS[charId]) {
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        game.spawnVisualBus(charId);
        const nameSpan = document.getElementById('current-bus-name');
        if (nameSpan) {
          nameSpan.textContent = BUS_CONFIGS[charId].name;
        }

        if (modal) modal.classList.add('hidden');
      }
    });
  });

  // 4. USB 게임패드 / 조이스틱 폴링 (라즈베리파이 5 아케이드 최적화)
  let lastHonkPressed = false;
  let lastRecoverPressed = false;

  const pollGamepad = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (gamepads && gamepads[0]) {
      const gp = gamepads[0];

      // 조향: 아날로그 스틱 또는 D-pad
      const stickX = gp.axes[0] || 0;
      const dpadLeft = gp.buttons[14]?.pressed;
      const dpadRight = gp.buttons[15]?.pressed;

      game.input.left = stickX < -0.3 || dpadLeft;
      game.input.right = stickX > 0.3 || dpadRight;

      // 가속: A 버튼 또는 오른쪽 트리거
      const btnA = gp.buttons[0]?.pressed;
      const triggerR = gp.buttons[7]?.pressed;
      const dpadUp = gp.buttons[12]?.pressed;
      game.input.forward = btnA || triggerR || dpadUp;

      // 후진 및 브레이크: B/X 버튼 또는 왼쪽 트리거
      const btnB = gp.buttons[1]?.pressed;
      const btnX = gp.buttons[2]?.pressed;
      const triggerL = gp.buttons[6]?.pressed;
      const dpadDown = gp.buttons[13]?.pressed;
      game.input.backward = btnB || dpadDown;
      game.input.brake = btnX || triggerL;

      // 빵빵! 경적: Y 버튼 또는 RB
      const btnY = gp.buttons[3]?.pressed;
      const btnRB = gp.buttons[5]?.pressed;
      if ((btnY || btnRB) && !lastHonkPressed) {
        game.honk();
        lastHonkPressed = true;
      } else if (!btnY && !btnRB) {
        lastHonkPressed = false;
      }

      // 바로세우기: Select/Back 버튼 (8번)
      const btnSelect = gp.buttons[8]?.pressed;
      if (btnSelect && !lastRecoverPressed) {
        game.recoverVehicle();
        lastRecoverPressed = true;
      } else if (!btnSelect) {
        lastRecoverPressed = false;
      }
    }
    requestAnimationFrame(pollGamepad);
  };

  window.addEventListener('gamepadconnected', () => {
    game.showPopup('🎮 게임패드가 연결되었어요!');
  });
  pollGamepad();
});
