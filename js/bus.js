/**
 * Tayo Bus 3D Model & Animation Manager
 * 꼬마버스 4총사(타요, 로기, 라니, 가니)의 귀여운 3D 모델 및 바퀴 회전/서스펜션 연출
 */

const BUS_CONFIGS = {
    tayo: {
        id: 'tayo',
        name: '타요',
        number: '120',
        color: 0x1E88E5, // 선명하고 귀여운 파랑
        roofColor: 0xFAFAFA,
        bumperColor: 0x37474F,
        description: '장난기 많고 정의로운 꼬마버스 리더',
        speed: 1.0,
        voiceIntro: '안녕! 나는 타요야! 오늘도 신나게 달려보자!'
    },
    rogi: {
        id: 'rogi',
        name: '로기',
        number: '1000',
        color: 0x43A047, // 발랄한 초록
        roofColor: 0xFAFAFA,
        bumperColor: 0x37474F,
        description: '활기차고 씩씩한 장난꾸러기 버스',
        speed: 1.05,
        voiceIntro: '하하! 나는 초록버스 로기! 내가 제일 빠를걸?'
    },
    lani: {
        id: 'lani',
        name: '라니',
        number: '02',
        color: 0xFDD835, // 사랑스러운 노랑
        roofColor: 0xFAFAFA,
        bumperColor: 0x37474F,
        description: '상냥하고 귀여운 애교쟁이 막내 버스',
        speed: 0.95,
        voiceIntro: '반가워요! 나는 라니! 우리 안전하게 운전해요!'
    },
    gani: {
        id: 'gani',
        name: '가니',
        number: '1339',
        color: 0xE53935, // 듬직한 빨강
        roofColor: 0xFAFAFA,
        bumperColor: 0x37474F,
        description: '조용하고 배려심 깊은 든든한 버스',
        speed: 1.0,
        voiceIntro: '안녕, 나는 가니야. 모두를 안전하게 태워줄게.'
    }
};

class BusFactory {
    // 캔버스를 이용해 귀여운 타요 얼굴(눈 & 미소) 텍스처 동적 생성
    static createFaceTexture(character) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 배경 유리창 (하늘빛 반사)
        ctx.fillStyle = '#CBE9FF';
        ctx.fillRect(0, 0, 512, 256);

        // 상단 그라데이션 햇살 반사
        const grad = ctx.createLinearGradient(0, 0, 512, 0);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 256);

        // 왼쪽 눈 & 오른쪽 눈 (크고 동글동글한 타요 눈)
        const eyeY = 135;
        const eyeRadiusX = 52;
        const eyeRadiusY = 65;

        [165, 347].forEach((eyeX, idx) => {
            // 흰자
            ctx.beginPath();
            ctx.ellipse(eyeX, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#263238';
            ctx.stroke();

            // 눈동자 (동그랗고 맑은 검은 눈)
            ctx.beginPath();
            ctx.ellipse(eyeX + (idx === 0 ? 6 : -6), eyeY + 5, 28, 38, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#1A1A1A';
            ctx.fill();

            // 초롱초롱 하이라이트 (큰 빛)
            ctx.beginPath();
            ctx.ellipse(eyeX + (idx === 0 ? 14 : 2), eyeY - 12, 11, 14, -0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 작은 반사 빛
            ctx.beginPath();
            ctx.arc(eyeX + (idx === 0 ? 0 : -10), eyeY + 20, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 귀여운 눈썹
            ctx.beginPath();
            ctx.lineWidth = 7;
            ctx.strokeStyle = '#263238';
            ctx.lineCap = 'round';
            const browY = eyeY - 78;
            if (character.id === 'lani') {
                // 라니: 동글동글 귀여운 아치형 눈썹
                ctx.arc(eyeX, browY + 15, 30, Math.PI * 1.15, Math.PI * 1.85);
            } else {
                ctx.arc(eyeX, browY + 20, 32, Math.PI * 1.1, Math.PI * 1.9);
            }
            ctx.stroke();
        });

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // 앞면 범퍼 미소(입) 텍스처
    static createMouthTexture(character) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 입 배경 투명
        ctx.clearRect(0, 0, 256, 128);

        // 활짝 웃는 귀여운 입
        ctx.beginPath();
        ctx.arc(128, 30, 65, 0.2 * Math.PI, 0.8 * Math.PI, false);
        ctx.fillStyle = '#C2185B'; // 입 안쪽
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#212121';
        ctx.stroke();

        // 귀여운 혓바닥
        ctx.beginPath();
        ctx.arc(128, 75, 32, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.fillStyle = '#FF8A80';
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // 버스 번호판 & LED 행선지 텍스처
    static createSignTexture(text, bgColor = '#212121', textColor = '#FFD54F') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 256, 64);

        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 60);

        ctx.fillStyle = textColor;
        ctx.font = 'bold 36px "Nanum Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // 옆면 번호 로고 텍스처
    static createSideNumberTexture(number, busColorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // 배경색
        ctx.fillStyle = busColorHex;
        ctx.fillRect(0, 0, 256, 128);

        // 노란 타원 엠블럼
        ctx.beginPath();
        ctx.ellipse(128, 64, 90, 48, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FFEA00';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // 번호 텍스트
        ctx.fillStyle = '#1A237E';
        ctx.font = 'bold 50px "Arial", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number, 128, 66);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 3D 버스 인스턴스 생성
     */
    static createBus(type = 'tayo') {
        const config = BUS_CONFIGS[type] || BUS_CONFIGS.tayo;
        const busGroup = new THREE.Group();
        busGroup.name = 'TayoBusRoot';

        // 섀시(차체 본체): 서스펜션과 통통 튕기는 애니메이션용
        const chassis = new THREE.Group();
        chassis.name = 'Chassis';
        busGroup.add(chassis);

        const bodyWidth = 1.9;
        const bodyHeight = 1.85;
        const bodyLength = 3.4;

        // 1. 차체 메인 바디 (모서리가 부드러운 박스)
        const bodyMat = new THREE.MeshLambertMaterial({ color: config.color });
        const bodyGeom = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.position.y = bodyHeight / 2 + 0.35;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        chassis.add(bodyMesh);

        // 2. 지붕 캡 (흰색 라운드 루프)
        const roofMat = new THREE.MeshLambertMaterial({ color: config.roofColor });
        const roofGeom = new THREE.BoxGeometry(bodyWidth * 0.96, 0.25, bodyLength * 0.94);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);
        roofMesh.position.y = bodyHeight + 0.45;
        roofMesh.castShadow = true;
        chassis.add(roofMesh);

        // 3. 앞유리창 & 타요 눈
        const faceTex = this.createFaceTexture(config);
        const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
        const faceGeom = new THREE.PlaneGeometry(bodyWidth * 0.88, 0.85);
        const faceMesh = new THREE.Mesh(faceGeom, faceMat);
        faceMesh.position.set(0, bodyHeight * 0.72 + 0.35, bodyLength / 2 + 0.015);
        chassis.add(faceMesh);

        // 4. 상단 LED 번호판 ("120 타요")
        const signTex = this.createSignTexture(`${config.number} ${config.name}`);
        const signMat = new THREE.MeshBasicMaterial({ map: signTex });
        const signGeom = new THREE.PlaneGeometry(1.2, 0.3);
        const signMesh = new THREE.Mesh(signGeom, signMat);
        signMesh.position.set(0, bodyHeight + 0.2, bodyLength / 2 + 0.02);
        chassis.add(signMesh);

        // 5. 앞면 미소 범퍼 & 입
        const mouthTex = this.createMouthTexture(config);
        const mouthMat = new THREE.MeshBasicMaterial({ map: mouthTex, transparent: true });
        const mouthGeom = new THREE.PlaneGeometry(0.9, 0.45);
        const mouthMesh = new THREE.Mesh(mouthGeom, mouthMat);
        mouthMesh.position.set(0, 0.75, bodyLength / 2 + 0.02);
        chassis.add(mouthMesh);

        // 앞/뒤 범퍼 가드 (다크 그레이)
        const bumperMat = new THREE.MeshLambertMaterial({ color: config.bumperColor });
        const fBumpGeom = new THREE.BoxGeometry(bodyWidth * 1.02, 0.28, 0.22);
        const fBumper = new THREE.Mesh(fBumpGeom, bumperMat);
        fBumper.position.set(0, 0.45, bodyLength / 2 + 0.08);
        chassis.add(fBumper);

        const rBumper = new THREE.Mesh(fBumpGeom, bumperMat);
        rBumper.position.set(0, 0.45, -bodyLength / 2 - 0.08);
        chassis.add(rBumper);

        // 6. 헤드라이트 (둥글고 밝은 노란빛)
        const headLightMat = new THREE.MeshBasicMaterial({ color: 0xFFF9C4 });
        const headLightGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16);
        headLightGeom.rotateX(Math.PI / 2);

        const leftLight = new THREE.Mesh(headLightGeom, headLightMat);
        leftLight.position.set(-0.68, 0.75, bodyLength / 2 + 0.02);
        chassis.add(leftLight);

        const rightLight = new THREE.Mesh(headLightGeom, headLightMat);
        rightLight.position.set(0.68, 0.75, bodyLength / 2 + 0.02);
        chassis.add(rightLight);

        // 7. 옆면 창문 & 번호 엠블럼
        const windowMat = new THREE.MeshLambertMaterial({ color: 0x90CAF9 });
        const sideWinGeom = new THREE.PlaneGeometry(0.7, 0.55);

        // 좌/우 옆면 창문 2개씩
        [-0.6, 0.6].forEach(zPos => {
            // 오른쪽 창문
            const rWin = new THREE.Mesh(sideWinGeom, windowMat);
            rWin.position.set(bodyWidth / 2 + 0.01, bodyHeight * 0.72 + 0.35, zPos);
            rWin.rotation.y = Math.PI / 2;
            chassis.add(rWin);

            // 왼쪽 창문
            const lWin = new THREE.Mesh(sideWinGeom, windowMat);
            lWin.position.set(-bodyWidth / 2 - 0.01, bodyHeight * 0.72 + 0.35, zPos);
            lWin.rotation.y = -Math.PI / 2;
            chassis.add(lWin);
        });

        // 옆면 번호 엠블럼
        const sideNumberTex = this.createSideNumberTexture(config.number, `#${config.color.toString(16).padStart(6, '0')}`);
        const sideNumberMat = new THREE.MeshBasicMaterial({ map: sideNumberTex });
        const sideNumberGeom = new THREE.PlaneGeometry(0.9, 0.45);

        const rSideNum = new THREE.Mesh(sideNumberGeom, sideNumberMat);
        rSideNum.position.set(bodyWidth / 2 + 0.015, 0.85, 0);
        rSideNum.rotation.y = Math.PI / 2;
        chassis.add(rSideNum);

        const lSideNum = new THREE.Mesh(sideNumberGeom, sideNumberMat);
        lSideNum.position.set(-bodyWidth / 2 - 0.015, 0.85, 0);
        lSideNum.rotation.y = -Math.PI / 2;
        chassis.add(lSideNum);

        // 8. 뒷면 창문 & 후미등
        const backWinGeom = new THREE.PlaneGeometry(bodyWidth * 0.8, 0.6);
        const backWin = new THREE.Mesh(backWinGeom, windowMat);
        backWin.position.set(0, bodyHeight * 0.72 + 0.35, -bodyLength / 2 - 0.01);
        backWin.rotation.y = Math.PI;
        chassis.add(backWin);

        // 빨간 후미등 2개
        const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xFF1744 });
        const tailGeom = new THREE.BoxGeometry(0.24, 0.16, 0.05);
        [-0.68, 0.68].forEach(xPos => {
            const tailLight = new THREE.Mesh(tailGeom, tailLightMat);
            tailLight.position.set(xPos, 0.65, -bodyLength / 2 - 0.01);
            chassis.add(tailLight);
        });

        // 9. 바퀴 4개 (앞바퀴는 조향 회전 가능하도록 피벗 추가)
        const wheels = [];
        const frontWheelPivots = [];

        const wheelRadius = 0.42;
        const wheelThickness = 0.28;
        const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 20);
        wheelGeom.rotateZ(Math.PI / 2); // 좌우 방향으로 눕힘

        const tireMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
        const rimMat = new THREE.MeshLambertMaterial({ color: 0xCFD8DC });

        const wheelPositions = [
            { name: 'FL', x: -bodyWidth / 2 - 0.04, z: 1.0, isFront: true },
            { name: 'FR', x: bodyWidth / 2 + 0.04, z: 1.0, isFront: true },
            { name: 'RL', x: -bodyWidth / 2 - 0.04, z: -1.0, isFront: false },
            { name: 'RR', x: bodyWidth / 2 + 0.04, z: -1.0, isFront: false }
        ];

        wheelPositions.forEach(pos => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(pos.x, wheelRadius, pos.z);

            // 타이어
            const tire = new THREE.Mesh(wheelGeom, tireMat);
            tire.castShadow = true;
            wheelGroup.add(tire);

            // 휠캡 (은색 디스크)
            const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelThickness * 1.02, 16);
            rimGeom.rotateZ(Math.PI / 2);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            wheelGroup.add(rim);

            if (pos.isFront) {
                // 조향을 위한 피벗 그룹
                const steerPivot = new THREE.Group();
                steerPivot.position.set(pos.x, wheelRadius, pos.z);
                wheelGroup.position.set(0, 0, 0); // 피벗 하위로 이동
                steerPivot.add(wheelGroup);
                busGroup.add(steerPivot);
                frontWheelPivots.push(steerPivot);
            } else {
                busGroup.add(wheelGroup);
            }

            wheels.push(wheelGroup);
        });

        // 10. 배기구 (머플러) 및 연기 효과 위치
        const exhaustPipeGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10);
        exhaustPipeGeom.rotateX(Math.PI / 2);
        const exhaustMat = new THREE.MeshLambertMaterial({ color: 0x546E7A });
        const exhaust = new THREE.Mesh(exhaustPipeGeom, exhaustMat);
        exhaust.position.set(-0.65, 0.32, -bodyLength / 2 - 0.12);
        chassis.add(exhaust);

        // 버스 제어 인터페이스 번들링
        const busController = {
            root: busGroup,
            chassis: chassis,
            wheels: wheels,
            frontWheelPivots: frontWheelPivots,
            config: config,
            exhaustPos: new THREE.Vector3(-0.65, 0.32, -bodyLength / 2 - 0.25),
            bounceTime: 0,
            bounceVelocity: 0,

            // 주행 중 바퀴 굴러감 & 앞바퀴 조향 각도 업데이트
            updateWheels(speed, steerAngle) {
                const rotationDelta = (speed * 0.06);
                wheels.forEach(w => {
                    w.rotation.x += rotationDelta;
                });
                frontWheelPivots.forEach(pivot => {
                    pivot.rotation.y = steerAngle;
                });
            },

            // 부드러운 서스펜션 애니메이션 (가속시 들림, 감속시 쏠림, 코너링시 기울어짐)
            updateSuspension(speed, steerAngle, acceleration, delta) {
                // 좌우 롤링 (코너링시 살짝 기울어짐)
                const targetRoll = -steerAngle * (Math.abs(speed) * 0.15);
                chassis.rotation.z += (targetRoll - chassis.rotation.z) * 0.15;

                // 전후 피칭 (급브레이크/가속시 코가 숙여짐)
                const targetPitch = acceleration * 0.2;
                chassis.rotation.x += (targetPitch - chassis.rotation.x) * 0.15;

                // 통통 튀는 탄성 애니메이션 (도로를 달릴 때 귀여운 흔들림)
                if (Math.abs(speed) > 0.05) {
                    this.bounceTime += delta * 12;
                    chassis.position.y = Math.sin(this.bounceTime) * 0.035;
                } else {
                    chassis.position.y += (0 - chassis.position.y) * 0.1;
                }
            },

            // 쿵 부딪혔을 때 통~ 하고 튀어오르는 효과
            triggerBoing() {
                this.bounceVelocity = 0.22;
            },

            updateBouncePhysics(delta) {
                if (this.bounceVelocity > 0 || chassis.position.y > 0.01) {
                    chassis.position.y += this.bounceVelocity;
                    this.bounceVelocity -= 1.8 * delta; // 중력
                    if (chassis.position.y < 0) {
                        chassis.position.y = 0;
                        this.bounceVelocity = 0;
                    }
                }
            }
        };

        return busController;
    }
}

window.BusFactory = BusFactory;
window.BUS_CONFIGS = BUS_CONFIGS;

