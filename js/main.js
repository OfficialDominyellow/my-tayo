/**
 * Tayo Main Bootstrapper & Controls
 * 키보드, 터치 버튼, USB 게임패드(조이스틱) 지원 및 UI 상호작용
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 게임 인스턴스 생성 및 초기화
    const game = new TayoGame();
    game.init();
    window.game = game;

    // 첫 인터랙션 시 사운드 컨텍스트 활성화
    const unlockAudio = () => {
        window.soundManager.init();
        window.soundManager.startEngine();
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // 2. 키보드 컨트롤 바인딩
    window.addEventListener('keydown', (e) => {
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
            case 'Space':
                e.preventDefault();
                game.honk();
                break;
            case 'KeyC':
                game.toggleCamera();
                break;
            case 'KeyB':
                game.input.brake = true;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
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

    // 3. 화면 터치 & 마우스 온스크린 버튼 바인딩
    const bindTouchButton = (btnId, onDown, onUp) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        const handleStart = (e) => {
            e.preventDefault();
            btn.classList.add('active');
            onDown();
        };

        const handleEnd = (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            onUp();
        };

        btn.addEventListener('mousedown', handleStart);
        btn.addEventListener('mouseup', handleEnd);
        btn.addEventListener('mouseleave', handleEnd);

        btn.addEventListener('touchstart', handleStart, { passive: false });
        btn.addEventListener('touchend', handleEnd, { passive: false });
        btn.addEventListener('touchcancel', handleEnd, { passive: false });
    };

    // 가상 페달 & 핸들 버튼들
    bindTouchButton('btn-gas', () => game.input.forward = true, () => game.input.forward = false);
    bindTouchButton('btn-reverse', () => game.input.backward = true, () => game.input.backward = false);
    bindTouchButton('btn-brake', () => game.input.brake = true, () => game.input.brake = false);
    bindTouchButton('btn-left', () => game.input.left = true, () => game.input.left = false);
    bindTouchButton('btn-right', () => game.input.right = true, () => game.input.right = false);

    // 경적 버튼
    const btnHorn = document.getElementById('btn-horn');
    if (btnHorn) {
        btnHorn.addEventListener('click', (e) => {
            e.preventDefault();
            game.honk();
        });
        btnHorn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            game.honk();
        }, { passive: false });
    }

    // 카메라 전환 버튼
    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) {
        btnCamera.addEventListener('click', () => game.toggleCamera());
    }

    // 4. 캐릭터 선택 모달 바인딩
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

    // 4대 버스 선택 카드
    document.querySelectorAll('.char-card').forEach(card => {
        card.addEventListener('click', () => {
            const charId = card.getAttribute('data-char');
            if (charId && window.BUS_CONFIGS[charId]) {
                document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');

                game.spawnBus(charId);
                const busNameSpan = document.getElementById('current-bus-name');
                if (busNameSpan) {
                    busNameSpan.textContent = window.BUS_CONFIGS[charId].name;
                }

                if (modal) modal.classList.add('hidden');
            }
        });
    });

    // 5. USB 게임패드 / 조이스틱 지원 (다이소/Xbox 패드 등 라즈베리파이 완벽 호환)
    let lastHonkPressed = false;
    function pollGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        if (gamepads && gamepads[0]) {
            const gp = gamepads[0];

            // 좌우 스틱 or D-pad
            const stickX = gp.axes[0];
            const dpadLeft = gp.buttons[14]?.pressed;
            const dpadRight = gp.buttons[15]?.pressed;

            game.input.left = stickX < -0.3 || dpadLeft;
            game.input.right = stickX > 0.3 || dpadRight;

            // 가속 (A 버튼 또는 오른쪽 트리거/위 방향키)
            const btnA = gp.buttons[0]?.pressed;
            const triggerR = gp.buttons[7]?.pressed;
            const dpadUp = gp.buttons[12]?.pressed;
            game.input.forward = btnA || triggerR || dpadUp;

            // 후진/브레이크 (B/X 버튼 또는 왼쪽 트리거/아래 방향키)
            const btnB = gp.buttons[1]?.pressed;
            const btnX = gp.buttons[2]?.pressed;
            const triggerL = gp.buttons[6]?.pressed;
            const dpadDown = gp.buttons[13]?.pressed;
            game.input.backward = btnB || dpadDown;
            game.input.brake = btnX || triggerL;

            // 경적 (Y 버튼 또는 RB)
            const btnY = gp.buttons[3]?.pressed;
            const btnRB = gp.buttons[5]?.pressed;
            if ((btnY || btnRB) && !lastHonkPressed) {
                game.honk();
                lastHonkPressed = true;
            } else if (!btnY && !btnRB) {
                lastHonkPressed = false;
            }
        }
        requestAnimationFrame(pollGamepad);
    }
    window.addEventListener('gamepadconnected', () => {
        game.showPopup('🎮 게임패드가 연결되었어요!');
    });
    pollGamepad();
});

