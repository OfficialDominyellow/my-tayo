/**
 * Tayo Main Game Engine & Rules
 * 조작, 물리 연산, 카메라, 신호등 판정, 승객 탑승, 돌발상황 미션 총괄
 */

class TayoGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // 버스 상태
        this.currentBusType = 'tayo';
        this.bus = null;
        this.busPosition = new THREE.Vector3(0, 0, 15);
        this.busHeading = 0; // 라디안
        this.speed = 0;
        this.maxSpeed = 12.0;
        this.acceleration = 14.0;
        this.friction = 7.0;
        this.steerAngle = 0;
        this.maxSteer = 0.55;

        // 카메라 모드
        this.cameraMode = 'follow'; // 'follow' or 'top'
        this.camOffset = new THREE.Vector3(0, 5.5, -9.5);

        // 월드 요소
        this.world = null;
        this.colliders = [];
        this.busStops = [];
        this.trafficLights = [];

        // 미션 & 학습 상태
        this.stars = 0;
        this.currentPassenger = null; // 현재 태운 승객 정보
        this.targetStop = null;      // 목적지 정류장
        this.hasStoppedForRedLight = false;
        this.lastTrafficState = null;

        // 돌발 상황 (공 굴러오기)
        this.ballMesh = null;
        this.ballActive = false;
        this.ballTimer = 25; // 25초마다 기회

        // 입력 상태
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };

        // 시계
        this.clock = new THREE.Clock();
        this.totalTime = 0;
    }

    init() {
        // 1. Scene 생성
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xB3E5FC); // 맑고 밝은 하늘색
        this.scene.fog = new THREE.FogExp2(0xB3E5FC, 0.012);

        // 2. Camera 생성
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            300
        );

        // 3. Renderer 생성 (저사양 라즈베리파이 최적화)
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 라즈베리파이 해상도 부하 경감
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 4. 조명 세팅 (따뜻한 동화풍 햇살)
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xFFF9C4, 0.85);
        dirLight.position.set(40, 60, 30);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 150;
        const d = 45;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        this.scene.add(dirLight);

        // 5. 마을 월드 생성
        this.world = new WorldGenerator(this.scene);
        const worldData = this.world.generate();
        this.colliders = worldData.colliders;
        this.busStops = worldData.busStops;
        this.trafficLights = worldData.trafficLights;

        // 6. 목적지 안내 3D 화살표 생성 (지붕 위 또는 목적지 표시)
        this.createGuideArrow();

        // 7. 돌발 상황 축구공 3D 메시 사전 생성
        this.createBallHazard();

        // 8. 버스 스폰
        this.spawnBus(this.currentBusType);

        // 9. 리사이즈 이벤트
        window.addEventListener('resize', () => this.onWindowResize());

        // 10. 게임 루프 시작
        this.animate();
    }

    createGuideArrow() {
        const arrowGroup = new THREE.Group();
        const coneGeom = new THREE.ConeGeometry(0.7, 1.4, 12);
        coneGeom.rotateX(Math.PI); // 아래를 가리킴
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xFFEB3B });
        const cone = new THREE.Mesh(coneGeom, coneMat);
        cone.position.y = 1.0;
        arrowGroup.add(cone);

        arrowGroup.position.set(0, -999, 0); // 처음엔 숨김
        this.scene.add(arrowGroup);
        this.guideArrow = arrowGroup;
    }

    createBallHazard() {
        const ballGeom = new THREE.SphereGeometry(0.8, 16, 16);
        const ballMat = new THREE.MeshLambertMaterial({ color: 0xFF5722 });
        this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
        this.ballMesh.castShadow = true;
        this.ballMesh.position.set(0, -999, 0);
        this.scene.add(this.ballMesh);
    }

    // 버스 교체 및 스폰
    spawnBus(busType) {
        if (this.bus) {
            this.scene.remove(this.bus.root);
        }

        this.currentBusType = busType;
        this.bus = BusFactory.createBus(busType);
        this.bus.root.position.copy(this.busPosition);
        this.bus.root.rotation.y = this.busHeading;
        this.scene.add(this.bus.root);

        // 안내 음성
        window.soundManager.speak(this.bus.config.voiceIntro);
    }

    // 창 크기 변경 시
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // 경적 울리기
    honk() {
        window.soundManager.playHorn();
        if (this.bus) {
            this.bus.triggerBoing();
        }
        this.showPopup('🎺 빵빵! 즐겁게 달려요!');
    }

    // 카메라 모드 토글
    toggleCamera() {
        this.cameraMode = this.cameraMode === 'follow' ? 'top' : 'follow';
        const label = this.cameraMode === 'follow' ? '운전 시점' : '헬리콥터 시점';
        this.showPopup(`📷 ${label}`);
    }

    // 미션 안내 팝업 배너 표시
    showPopup(text, isStar = false) {
        const popup = document.getElementById('mission-popup');
        if (!popup) return;
        popup.textContent = text;
        popup.classList.remove('hidden');
        popup.classList.add('pop-animation');

        clearTimeout(this.popupTimeout);
        this.popupTimeout = setTimeout(() => {
            popup.classList.remove('pop-animation');
            popup.classList.add('hidden');
        }, 2800);
    }

    // 별 획득
    addStar(reason) {
        this.stars += 1;
        const starElem = document.getElementById('star-counter');
        if (starElem) {
            starElem.textContent = `⭐ ${this.stars}`;
            starElem.classList.add('star-bounce');
            setTimeout(() => starElem.classList.remove('star-bounce'), 800);
        }

        window.soundManager.playStar();
        this.showPopup(`⭐ 참 잘했어요! (+1 별) \n${reason}`, true);

        // 5개 단위로 팡파레 축하
        if (this.stars % 5 === 0) {
            window.soundManager.playCelebration();
            window.soundManager.speak(`우와! 별을 ${this.stars}개나 모았어요! 꼬마버스 최고 안전 대장!`);
        }
    }

    // 메인 물리 & 주행 업데이트
    updatePhysics(delta) {
        if (!this.bus) return;

        // 1. 가속 및 감속 계산
        let accel = 0;
        if (this.input.forward) {
            accel += this.acceleration;
        }
        if (this.input.backward) {
            accel -= this.acceleration * 0.7; // 후진은 조금 천천히
        }

        // 브레이크
        if (this.input.brake) {
            if (Math.abs(this.speed) > 0.5) {
                window.soundManager.playBrake();
            }
            if (this.speed > 0) {
                this.speed = Math.max(0, this.speed - this.acceleration * 1.6 * delta);
            } else if (this.speed < 0) {
                this.speed = Math.min(0, this.speed + this.acceleration * 1.6 * delta);
            }
        } else {
            // 속도 가속
            this.speed += accel * delta;

            // 자연스러운 마찰력 감속
            if (accel === 0) {
                if (this.speed > 0) {
                    this.speed = Math.max(0, this.speed - this.friction * delta);
                } else if (this.speed < 0) {
                    this.speed = Math.min(0, this.speed + this.friction * delta);
                }
            }
        }

        // 최고 속도 제한
        const maxForward = this.maxSpeed * this.bus.config.speed;
        const maxReverse = -5.0;
        this.speed = Math.max(maxReverse, Math.min(maxForward, this.speed));

        // 2. 조향 (핸들 회전)
        let steerTarget = 0;
        if (this.input.left) steerTarget += this.maxSteer;
        if (this.input.right) steerTarget -= this.maxSteer;

        this.steerAngle += (steerTarget - this.steerAngle) * 10 * delta;

        // 차량 이동 및 회전 반영
        if (Math.abs(this.speed) > 0.05) {
            const turnFactor = (this.speed > 0 ? 1 : -1) * (this.steerAngle * 1.8 * delta);
            this.busHeading += turnFactor;

            this.busPosition.x += Math.sin(this.busHeading) * this.speed * delta;
            this.busPosition.z += Math.cos(this.busHeading) * this.speed * delta;
        }

        // 3. 충돌 검사 (건물, 나무, 월드 경계)
        this.checkCollisions();

        // 4. 버스 3D 트랜스폼 동기화
        this.bus.root.position.copy(this.busPosition);
        this.bus.root.rotation.y = this.busHeading;

        // 바퀴 & 서스펜션 연출
        this.bus.updateWheels(this.speed, this.steerAngle);
        this.bus.updateSuspension(this.speed, this.steerAngle, accel, delta);
        this.bus.updateBouncePhysics(delta);

        // 엔진 사운드 피치 조절
        window.soundManager.updateEngine(this.speed / maxForward);
    }

    // 충돌 처리 (벽에 부딪혀도 게임오버 없이 귀엽게 통~ 튕김)
    checkCollisions() {
        const busRadius = 1.6;

        // 월드 외곽 경계 (-65 ~ 65)
        const boundary = 65;
        if (Math.abs(this.busPosition.x) > boundary || Math.abs(this.busPosition.z) > boundary) {
            this.busPosition.x = Math.max(-boundary, Math.min(boundary, this.busPosition.x));
            this.busPosition.z = Math.max(-boundary, Math.min(boundary, this.busPosition.z));
            this.speed = -this.speed * 0.4;
            window.soundManager.playBoing();
            this.bus.triggerBoing();
            return;
        }

        // 건물 및 나무 충돌
        for (let col of this.colliders) {
            const dx = this.busPosition.x - col.x;
            const dz = this.busPosition.z - col.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = busRadius + col.radius;

            if (dist < minDist) {
                // 충돌 발생: 통~ 하고 부드럽게 밀어냄
                const overlap = minDist - dist;
                const normalX = dx / dist;
                const normalZ = dz / dist;

                this.busPosition.x += normalX * overlap * 1.1;
                this.busPosition.z += normalZ * overlap * 1.1;

                this.speed = -this.speed * 0.35; // 반대 방향으로 가볍게 튕김
                window.soundManager.playBoing();
                this.bus.triggerBoing();
                break;
            }
        }
    }

    // 카메라 추적 업데이트
    updateCamera(delta) {
        if (!this.bus) return;

        if (this.cameraMode === 'follow') {
            // 버스 뒤통수를 따스하게 따라가는 3인칭 뷰
            const idealOffset = new THREE.Vector3(
                -Math.sin(this.busHeading) * 9.5,
                5.2,
                -Math.cos(this.busHeading) * 9.5
            );
            const targetPos = this.busPosition.clone().add(idealOffset);
            this.camera.position.lerp(targetPos, 7 * delta);

            const lookAtTarget = this.busPosition.clone().add(new THREE.Vector3(0, 1.2, 0));
            this.camera.lookAt(lookAtTarget);
        } else {
            // 헬리콥터 하이 뷰 (위에서 마을을 내려다봄)
            const targetPos = this.busPosition.clone().add(new THREE.Vector3(0, 32, -18));
            this.camera.position.lerp(targetPos, 5 * delta);
            this.camera.lookAt(this.busPosition);
        }
    }

    // 신호등 규칙 학습 체크
    checkTrafficRules(trafficState) {
        // 중앙 사거리 근처에 있는지 확인
        const distFromCenter = Math.sqrt(this.busPosition.x ** 2 + this.busPosition.z ** 2);
        if (distFromCenter > 14) {
            this.hasStoppedForRedLight = false;
            return;
        }

        // 현재 주행 방향에 따른 신호 판별
        // 대략 Z축 방향 주행이면 남북신호, X축 방향 주행이면 동서신호
        const absHeading = Math.abs(this.busHeading % Math.PI);
        const isNorthSouth = (absHeading < Math.PI / 4 || absHeading > 3 * Math.PI / 4);
        const currentLight = isNorthSouth ? trafficState.nsState : trafficState.ewState;

        // 빨간불일 때
        if (currentLight === 'red') {
            // 교차로 진입 직전 정지선 부근(5m ~ 11m)에 멈췄는지?
            if (distFromCenter >= 5 && distFromCenter <= 11 && Math.abs(this.speed) < 0.2) {
                if (!this.hasStoppedForRedLight) {
                    this.hasStoppedForRedLight = true;
                    this.addStar('🚦 빨간불에 멈춰섰어요! 참 잘했어요!');
                    window.soundManager.speak('빨간불에 아주 잘 멈췄어요! 신호등 박사님이네요!');
                }
            } else if (distFromCenter < 5 && Math.abs(this.speed) > 1.0 && !this.hasStoppedForRedLight) {
                // 빨간불인데 지나침 -> 친절한 훈계 음성 (절대 혼내지 않음)
                window.soundManager.speak('어? 빨간불에는 멈춰야 해요! 다음엔 멈춰보자!');
                this.hasStoppedForRedLight = true; // 중복 경고 방지
            }
        } else if (currentLight === 'green') {
            if (this.hasStoppedForRedLight && this.speed > 1.0) {
                // 신호 바뀌고 출발
                this.hasStoppedForRedLight = false;
            }
        }
    }

    // 버스 정류장 승객 승하차 체크
    checkBusStops() {
        for (let stop of this.busStops) {
            const dx = this.busPosition.x - stop.x;
            const dz = this.busPosition.z - stop.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // 정류장 정차 구역 내에 있고 속도가 거의 0일 때
            if (dist < 3.8 && Math.abs(this.speed) < 0.3) {
                // 1. 대기 중인 승객 태우기
                if (stop.hasPassenger && !this.currentPassenger) {
                    stop.hasPassenger = false;
                    this.currentPassenger = {
                        targetStopName: stop.targetStopName,
                        passengerMesh: stop.passenger
                    };

                    stop.passenger.userData.isBoarded = true;
                    stop.passenger.visible = false; // 버스 탑승

                    window.soundManager.playDoor();
                    window.soundManager.speak(`어서오세요! ${stop.targetStopName}로 가주세요!`);
                    this.showPopup(`🚏 손님이 탔어요! \n목적지: ${stop.targetStopName}`);

                    // 목적지 정류장 화살표 가이드 활성화
                    const target = this.busStops.find(s => s.name.includes(stop.targetStopName) || stop.targetStopName.includes(s.name));
                    if (target) {
                        this.targetStop = target;
                        this.guideArrow.position.set(target.x, 3.8, target.z);
                    }
                }
                // 2. 목적지에 도착해서 내려주기
                else if (this.currentPassenger && this.targetStop && this.targetStop.id === stop.id) {
                    const passenger = this.currentPassenger.passengerMesh;
                    passenger.visible = true;
                    passenger.userData.isBoarded = false;
                    passenger.position.set(stop.x + 2.2, 0, stop.z + 1.0);

                    this.currentPassenger = null;
                    this.targetStop = null;
                    this.guideArrow.position.set(0, -999, 0); // 화살표 숨김

                    window.soundManager.playDoor();
                    this.addStar(`🚏 손님을 안전하게 모셔다드렸어요!`);
                    window.soundManager.speak('도착했어요! 안전하게 태워줘서 고마워요 타요!');
                }
            }
        }
    }

    // 돌발상황: 도로로 축구공이 굴러오는 이벤트
    updateBallHazard(delta) {
        if (!this.ballActive) {
            this.ballTimer -= delta;
            if (this.ballTimer <= 0) {
                // 돌발상황 발동! 버스 전방 22m 지점으로 공 굴러가기
                this.ballActive = true;
                this.ballTimer = 35; // 다음 이벤트 간격

                const spawnDist = 20;
                const spawnX = this.busPosition.x + Math.sin(this.busHeading) * spawnDist + (Math.random() > 0.5 ? 9 : -9);
                const spawnZ = this.busPosition.z + Math.cos(this.busHeading) * spawnDist;

                this.ballMesh.position.set(spawnX, 0.8, spawnZ);
                this.ballVelX = (this.busPosition.x - spawnX) * 0.4;
                this.ballVelZ = (this.busPosition.z - spawnZ) * 0.4;

                window.soundManager.speak('어? 조심해요! 길 위로 공이 굴러와요! 멈춰요!');
                this.showPopup('⚽ 조심해요! 공이 굴러와요! 브레이크!');
            }
        } else {
            // 공 굴러가기 및 회전
            this.ballMesh.position.x += this.ballVelX * delta;
            this.ballMesh.position.z += this.ballVelZ * delta;
            this.ballMesh.rotation.x += 6 * delta;

            const dx = this.busPosition.x - this.ballMesh.position.x;
            const dz = this.busPosition.z - this.ballMesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // 안전하게 멈췄을 때 칭찬
            if (dist < 7 && Math.abs(this.speed) < 0.4) {
                this.ballActive = false;
                this.ballMesh.position.set(0, -999, 0);
                this.addStar('⚽ 공을 보고 안전하게 잘 멈췄어요! 안전 운전 최고!');
                window.soundManager.speak('휴~ 잘 멈췄어요! 안전 운전 최고에요!');
            } else if (dist < 2.0) {
                // 공과 부딪혔을 때 (공이 뻥 튕겨나감)
                this.ballActive = false;
                this.ballMesh.position.set(0, -999, 0);
                window.soundManager.playBoing();
                this.showPopup('⚽ 공이 통~ 튕겨나갔어요! 다음엔 미리 멈춰봐요!');
            }
        }
    }

    // 메인 렌더 루프
    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.totalTime += delta;

        // 1. 물리 & 주행 업데이트
        this.updatePhysics(delta);

        // 2. 카메라 업데이트
        this.updateCamera(delta);

        // 3. 신호등 주기 및 판정
        const trafficState = this.world.updateTrafficLights(this.totalTime);
        this.checkTrafficRules(trafficState);

        // 4. 승객 애니메이션 및 정류장 판정
        this.world.updatePassengers(delta);
        this.checkBusStops();

        // 5. 돌발상황 업데이트
        this.updateBallHazard(delta);

        // 6. 목적지 안내 화살표 애니메이션 (위아래 둥둥)
        if (this.targetStop) {
            this.guideArrow.position.y = 4.2 + Math.sin(this.totalTime * 4) * 0.4;
            this.guideArrow.rotation.y += 2 * delta;
        }

        // 7. 3D 렌더링
        this.renderer.render(this.scene, this.camera);
    }
}

window.TayoGame = TayoGame;

