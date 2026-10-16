/**
 * Tayo Town World Generator
 * 아기자기한 3D 마을, 도로, 신호등, 횡단보도, 버스 정류장, 건물 및 승객 생성
 */

class WorldGenerator {
    constructor(scene) {
        this.scene = scene;
        this.colliders = []; // 충돌 가능한 건물 및 장애물 박스
        this.busStops = [];   // 버스 정류장 목록
        this.trafficLights = []; // 신호등 목록
        this.passengers = []; // 승객 캐릭터들
        this.decorations = []; // 바람개비 등 애니메이션 오브젝트
        this.ballEvent = null; // 돌발상황 공 이벤트
    }

    // 아스팔트 도로 텍스처 동적 생성
    createRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 도로 아스팔트
        ctx.fillStyle = '#37474F';
        ctx.fillRect(0, 0, 512, 512);

        // 중앙 노란색 점선
        ctx.strokeStyle = '#FDD835';
        ctx.lineWidth = 14;
        ctx.setLineDash([48, 36]);
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, 512);
        ctx.stroke();

        // 양쪽 흰색 실선 가드라인
        ctx.strokeStyle = '#ECEFF1';
        ctx.lineWidth = 10;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(35, 0);
        ctx.lineTo(35, 512);
        ctx.moveTo(477, 0);
        ctx.lineTo(477, 512);
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // 횡단보도 텍스처
    createCrosswalkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#37474F';
        ctx.fillRect(0, 0, 256, 256);

        // 흰색 얼룩말 줄무늬
        ctx.fillStyle = '#FFFFFF';
        const barHeight = 28;
        const gap = 20;
        for (let y = 10; y < 256; y += barHeight + gap) {
            ctx.fillRect(20, y, 216, barHeight);
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    // 전체 마을 구축
    generate() {
        // 1. 바닥 잔디밭 (연두빛 밝은 공원 잔디)
        const groundGeom = new THREE.PlaneGeometry(160, 160);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x81C784 });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 2. 도로망 구축 (격자 및 외곽 순환 도로)
        this.buildRoadNetwork();

        // 3. 건물들 배치 (학교, 병원, 소방서, 예쁜 집들)
        this.buildBuildings();

        // 4. 나무와 가로등 배치
        this.buildNature();

        // 5. 신호등 교차로 설치
        this.buildTrafficLights();

        // 6. 버스 정류장 4개 설치
        this.buildBusStops();

        return {
            colliders: this.colliders,
            busStops: this.busStops,
            trafficLights: this.trafficLights,
            passengers: this.passengers
        };
    }

    buildRoadNetwork() {
        const roadTex = this.createRoadTexture();
        const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
        const roadWidth = 9.0;

        // 도로 세그먼트 생성 헬퍼
        const createRoad = (x, z, length, isHorizontal) => {
            const geom = new THREE.PlaneGeometry(isHorizontal ? length : roadWidth, isHorizontal ? roadWidth : length);
            const rTex = roadTex.clone();
            rTex.repeat.set(isHorizontal ? length / roadWidth : 1, isHorizontal ? 1 : length / roadWidth);
            rTex.needsUpdate = true;
            const mat = new THREE.MeshLambertMaterial({ map: rTex });

            const mesh = new THREE.Mesh(geom, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.02, z);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        };

        // 메인 도로 격자망 (중앙 십자 교차로 + 순환선)
        createRoad(0, 0, 120, true);  // 가로 메인 대로 (Z=0)
        createRoad(0, 0, 120, false); // 세로 메인 대로 (X=0)
        createRoad(0, 42, 100, true);  // 북쪽 도로 (Z=42)
        createRoad(0, -42, 100, true); // 남쪽 도로 (Z=-42)
        createRoad(42, 0, 100, false); // 동쪽 도로 (X=42)
        createRoad(-42, 0, 100, false);// 서쪽 도로 (X=-42)

        // 교차로 횡단보도 생성
        const cwTex = this.createCrosswalkTexture();
        const cwMat = new THREE.MeshLambertMaterial({ map: cwTex });

        const addCrosswalk = (x, z, isHorizontal) => {
            const geom = new THREE.PlaneGeometry(isHorizontal ? 8.6 : 3.5, isHorizontal ? 3.5 : 8.6);
            const mesh = new THREE.Mesh(geom, cwMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.03, z);
            this.scene.add(mesh);
        };

        // 중앙 교차로 4방향 횡단보도
        addCrosswalk(0, 7.5, true);   // 북쪽 횡단보도
        addCrosswalk(0, -7.5, true);  // 남쪽 횡단보도
        addCrosswalk(7.5, 0, false);  // 동쪽 횡단보도
        addCrosswalk(-7.5, 0, false); // 서쪽 횡단보도
    }

    buildBuildings() {
        // 건물 추가 헬퍼
        const addBuilding = (x, z, width, depth, height, color, roofType = 'flat', name = '') => {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            // 본체
            const mat = new THREE.MeshLambertMaterial({ color: color });
            const geom = new THREE.BoxGeometry(width, height, depth);
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.y = height / 2;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);

            // 창문들
            const winMat = new THREE.MeshBasicMaterial({ color: 0xE1F5FE });
            const winCols = Math.max(1, Math.floor(width / 2.2));
            const winRows = Math.max(1, Math.floor(height / 2.5));

            for (let r = 0; r < winRows; r++) {
                for (let c = 0; c < winCols; c++) {
                    const winGeom = new THREE.PlaneGeometry(0.9, 0.9);
                    const win = new THREE.Mesh(winGeom, winMat);
                    const wx = (c - (winCols - 1) / 2) * 1.8;
                    const wy = 1.2 + r * 2.0;
                    win.position.set(wx, wy, depth / 2 + 0.02);
                    group.add(win);
                }
            }

            // 지붕 형태
            if (roofType === 'pitched') {
                const roofGeom = new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 2.2, 4);
                roofGeom.rotateY(Math.PI / 4);
                const roofMat = new THREE.MeshLambertMaterial({ color: 0xD32F2F });
                const roof = new THREE.Mesh(roofGeom, roofMat);
                roof.position.y = height + 1.1;
                roof.castShadow = true;
                group.add(roof);
            } else if (roofType === 'school') {
                // 학교 시계탑
                const towerGeom = new THREE.BoxGeometry(2.4, 2.5, 2.4);
                const towerMat = new THREE.MeshLambertMaterial({ color: 0xFFF9C4 });
                const tower = new THREE.Mesh(towerGeom, towerMat);
                tower.position.y = height + 1.25;
                group.add(tower);

                // 시계
                const clockGeom = new THREE.CircleGeometry(0.7, 16);
                const clockMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
                const clock = new THREE.Mesh(clockGeom, clockMat);
                clock.position.set(0, height + 1.3, 1.25);
                group.add(clock);
            }

            this.scene.add(group);

            // 충돌 판정용 바운딩 박스
            this.colliders.push({
                x: x,
                z: z,
                radius: Math.max(width, depth) * 0.65,
                name: name
            });
        };

        // 1. 꿈나무 초등학교 (남서쪽 구역)
        addBuilding(-22, -22, 14, 10, 6, 0xFFE082, 'school', '초등학교');

        // 2. 삐뽀삐뽀 소방서 (북서쪽 구역)
        addBuilding(-22, 22, 11, 9, 6.5, 0xEF5350, 'flat', '소방서');

        // 3. 달콤 베이커리 & 마트 (북동쪽 구역)
        addBuilding(22, 22, 10, 10, 5, 0x81D4FA, 'pitched', '달콤마트');

        // 4. 무지개 유치원 (남동쪽 구역)
        addBuilding(22, -22, 12, 9, 5.5, 0xF48FB1, 'pitched', '유치원');

        // 아기자기한 동네 주택들
        const houseColors = [0xFFCC80, 0xC5E1A5, 0xB0BEC5, 0xFFAB91];
        [
            { x: -22, z: -35 }, { x: -35, z: -22 },
            { x: 22, z: 35 }, { x: 35, z: 22 },
            { x: -22, z: 35 }, { x: -35, z: 22 },
            { x: 22, z: -35 }, { x: 35, z: -22 }
        ].forEach((pos, idx) => {
            addBuilding(pos.x, pos.z, 6.5, 6.5, 4.2, houseColors[idx % houseColors.length], 'pitched', '우리동네 집');
        });
    }

    buildNature() {
        // 귀여운 카툰 나무 생성
        const addTree = (x, z, scale = 1.0) => {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            // 갈색 줄기
            const trunkGeom = new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 1.8 * scale, 8);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 });
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 0.9 * scale;
            trunk.castShadow = true;
            group.add(trunk);

            // 풍성한 연두빛 잎사귀 (동글동글 구체 2개)
            const foliageMat = new THREE.MeshLambertMaterial({ color: 0x66BB6A });
            const f1Geom = new THREE.SphereGeometry(1.2 * scale, 8, 8);
            const f1 = new THREE.Mesh(f1Geom, foliageMat);
            f1.position.y = (1.8 + 0.8) * scale;
            f1.castShadow = true;
            group.add(f1);

            const f2Geom = new THREE.SphereGeometry(0.9 * scale, 8, 8);
            const f2 = new THREE.Mesh(f2Geom, foliageMat);
            f2.position.set(0.3 * scale, (2.6 + 0.6) * scale, 0);
            f2.castShadow = true;
            group.add(f2);

            this.scene.add(group);
            this.colliders.push({ x: x, z: z, radius: 0.8 * scale, name: '나무' });
        };

        // 가로수 및 공원 나무들 배치
        const treeCoords = [
            [-8, 14], [-8, 28], [8, 14], [8, 28],
            [-8, -14], [-8, -28], [8, -14], [8, -28],
            [14, 8], [28, 8], [14, -8], [28, -8],
            [-14, 8], [-28, 8], [-14, -8], [-28, -8],
            // 마을 구석 공원
            [32, 32], [36, 30], [30, 36]
        ];

        treeCoords.forEach(c => addTree(c[0], c[1], 0.9 + Math.random() * 0.3));
    }

    buildTrafficLights() {
        // 중앙 사거리 신호등 4개 설치
        const lightPositions = [
            { x: -6.0, z: 6.0, rotY: 0, dir: 'north_south' },      // 북쪽 차량용
            { x: 6.0, z: -6.0, rotY: Math.PI, dir: 'north_south' }, // 남쪽 차량용
            { x: 6.0, z: 6.0, rotY: -Math.PI / 2, dir: 'east_west' }, // 동쪽 차량용
            { x: -6.0, z: -6.0, rotY: Math.PI / 2, dir: 'east_west' } // 서쪽 차량용
        ];

        lightPositions.forEach((pos, idx) => {
            const group = new THREE.Group();
            group.position.set(pos.x, 0, pos.z);
            group.rotation.y = pos.rotY;

            // 기둥 (어두운 회색)
            const poleGeom = new THREE.CylinderGeometry(0.12, 0.12, 4.8, 12);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x455A64 });
            const pole = new THREE.Mesh(poleGeom, poleMat);
            pole.position.y = 2.4;
            group.add(pole);

            // 신호등 하우징 (검은 박스)
            const boxGeom = new THREE.BoxGeometry(0.65, 1.8, 0.45);
            const boxMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
            const box = new THREE.Mesh(boxGeom, boxMat);
            box.position.set(0, 4.0, 0);
            group.add(box);

            // 3색 램프 (빨강, 노랑, 초록)
            const lampGeom = new THREE.SphereGeometry(0.2, 16, 16);

            const redMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
            const redLamp = new THREE.Mesh(lampGeom, redMat);
            redLamp.position.set(0, 4.5, 0.22);
            group.add(redLamp);

            const yellowMat = new THREE.MeshBasicMaterial({ color: 0x443300 });
            const yellowLamp = new THREE.Mesh(lampGeom, yellowMat);
            yellowLamp.position.set(0, 4.0, 0.22);
            group.add(yellowLamp);

            const greenMat = new THREE.MeshBasicMaterial({ color: 0x004400 });
            const greenLamp = new THREE.Mesh(lampGeom, greenMat);
            greenLamp.position.set(0, 3.5, 0.22);
            group.add(greenLamp);

            this.scene.add(group);

            this.trafficLights.push({
                group: group,
                dir: pos.dir,
                lamps: {
                    red: redLamp,
                    yellow: yellowLamp,
                    green: greenLamp
                },
                stopZone: {
                    x: pos.x,
                    z: pos.z,
                    radius: 7.0
                }
            });
        });
    }

    // 귀여운 3D 승객 캐릭터 생성 (동글동글 아기곰/토끼/병아리)
    createCutePassenger(type = 'chick') {
        const group = new THREE.Group();

        let bodyColor = 0xFFEB3B; // 병아리 노랑
        if (type === 'bear') bodyColor = 0x8D6E63; // 아기곰 갈색
        if (type === 'bunny') bodyColor = 0xF5F5F5; // 토끼 흰색

        // 몸통
        const bodyGeom = new THREE.SphereGeometry(0.45, 12, 12);
        const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 0.5;
        group.add(body);

        // 머리
        const headGeom = new THREE.SphereGeometry(0.38, 12, 12);
        const head = new THREE.Mesh(headGeom, bodyMat);
        head.position.y = 1.05;
        group.add(head);

        // 귀
        const earGeom = type === 'bunny' ? new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8) : new THREE.SphereGeometry(0.12, 8, 8);
        [-0.2, 0.2].forEach(x => {
            const ear = new THREE.Mesh(earGeom, bodyMat);
            ear.position.set(x, type === 'bunny' ? 1.5 : 1.35, 0);
            group.add(ear);
        });

        // 초롱초롱 눈
        const eyeGeom = new THREE.SphereGeometry(0.05, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        [-0.12, 0.12].forEach(x => {
            const eye = new THREE.Mesh(eyeGeom, eyeMat);
            eye.position.set(x, 1.1, 0.32);
            group.add(eye);
        });

        // 볼터치 핑크
        const blushGeom = new THREE.SphereGeometry(0.06, 8, 8);
        const blushMat = new THREE.MeshBasicMaterial({ color: 0xFF80AB });
        [-0.18, 0.18].forEach(x => {
            const blush = new THREE.Mesh(blushGeom, blushMat);
            blush.position.set(x, 1.0, 0.3);
            group.add(blush);
        });

        // 대기 중 콩콩 뛰는 애니메이션 변수
        group.userData = {
            baseY: 0,
            animTime: Math.random() * 5,
            isBoarded: false
        };

        return group;
    }

    buildBusStops() {
        const stopsConfig = [
            { id: 1, name: '타요 차고지 정류장', x: -6.5, z: 18.0, passengerType: 'chick', targetStopName: '무지개 유치원' },
            { id: 2, name: '무지개 유치원 앞', x: 18.0, z: -6.5, passengerType: 'bear', targetStopName: '달콤 마트' },
            { id: 3, name: '달콤 마트 앞', x: 6.5, z: 24.0, passengerType: 'bunny', targetStopName: '꿈나무 초등학교' },
            { id: 4, name: '꿈나무 초등학교 앞', x: -18.0, z: -6.5, passengerType: 'chick', targetStopName: '타요 차고지' }
        ];

        stopsConfig.forEach(cfg => {
            const group = new THREE.Group();
            group.position.set(cfg.x, 0, cfg.z);

            // 1. 노란색 정차 구역 (바닥 페인트)
            const zoneGeom = new THREE.PlaneGeometry(3.6, 6.0);
            const zoneMat = new THREE.MeshBasicMaterial({ color: 0xFFD600, transparent: true, opacity: 0.65 });
            const zone = new THREE.Mesh(zoneGeom, zoneMat);
            zone.rotation.x = -Math.PI / 2;
            zone.position.y = 0.04;
            group.add(zone);

            // 2. 버스 정류장 표지판 기둥
            const poleGeom = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x455A64 });
            const pole = new THREE.Mesh(poleGeom, poleMat);
            pole.position.set(2.2, 1.4, 0);
            group.add(pole);

            // 둥근 정류장 간판
            const signGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 16);
            signGeom.rotateX(Math.PI / 2);
            const signMat = new THREE.MeshLambertMaterial({ color: 0x1E88E5 });
            const sign = new THREE.Mesh(signGeom, signMat);
            sign.position.set(2.2, 2.5, 0);
            group.add(sign);

            // 3. 대기 중인 귀여운 승객 배치
            const passenger = this.createCutePassenger(cfg.passengerType);
            passenger.position.set(2.2, 0, 1.0);
            group.add(passenger);

            this.scene.add(group);

            this.busStops.push({
                id: cfg.id,
                name: cfg.name,
                x: cfg.x,
                z: cfg.z,
                targetStopName: cfg.targetStopName,
                passenger: passenger,
                hasPassenger: true,
                group: group
            });

            this.passengers.push(passenger);
        });
    }

    // 신호등 색상 주기 업데이트 (Green -> Yellow -> Red)
    updateTrafficLights(cycleTime) {
        // 주기: 16초 (초록 7초 -> 노랑 2초 -> 빨강 7초)
        const cycle = cycleTime % 16;
        let nsState = 'green';
        let ewState = 'red';

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

            // 램프 밝기/색상 제어
            tl.lamps.red.material.color.setHex(state === 'red' ? 0xFF1744 : 0x440000);
            tl.lamps.yellow.material.color.setHex(state === 'yellow' ? 0xFFEA00 : 0x443300);
            tl.lamps.green.material.color.setHex(state === 'green' ? 0x00E676 : 0x004400);
        });

        return { nsState, ewState };
    }

    // 승객 대기 콩콩 뛰는 애니메이션
    updatePassengers(delta) {
        this.passengers.forEach(p => {
            if (!p.userData.isBoarded) {
                p.userData.animTime += delta * 4;
                p.position.y = Math.abs(Math.sin(p.userData.animTime)) * 0.2;
            }
        });
    }
}

window.WorldGenerator = WorldGenerator;

