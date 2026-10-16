import * as THREE from 'three';

export type BusType = 'tayo' | 'rogi' | 'lani' | 'gani';
export type ExpressionType = 'normal' | 'happy' | 'wink' | 'surprised';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export type CameraMode = 'chase' | 'front_face' | 'first_person' | 'isometric' | 'top_down';

export interface BusConfig {
  id: BusType;
  name: string;
  number: string;
  color: number;
  bodyHex: string;
  accentColor: string; // 볼/범퍼 뺨 포인트 색상
  foreheadBg: string;  // 이마 노선번호 배경색
  foreheadText: string;// 이마 텍스트 색상
  hasWhiteVisor: boolean; // 가니처럼 흰색 바이저 바 여부
  noseColor: number;   // 코 색상
  speedMultiplier: number;
  turnMultiplier: number;
  description: string;
  voiceIntro: string;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
}

export interface DebugMetrics {
  fps: number;
  frameTimeMs: number;
  physicsTimeMs: number;
  speedKmh: number;
  wheelGrounded: boolean[];
}

export interface TrafficLightData {
  group: THREE.Group;
  dir: 'north_south' | 'east_west';
  lamps: {
    red: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    yellow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    green: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  };
  currentState: 'green' | 'yellow' | 'red';
  stopZone: {
    x: number;
    z: number;
    radius: number;
  };
}

export interface BusStopData {
  id: number;
  name: string;
  icon: string;
  x: number;
  z: number;
  targetStopName: string;
  passengerName: string;
  passengerIcon: string;
  passengerMesh: THREE.Group;
  hasPassenger: boolean;
  isFamily?: boolean;
}

export interface InteractiveZone {
  id: string;
  name: string;
  type: 'carwash' | 'station' | 'garage';
  x: number;
  z: number;
  radius: number;
  cooldown: number;
  group: THREE.Group;
}

export interface CollectibleStar {
  mesh: THREE.Group;
  x: number;
  z: number;
  collected: boolean;
  respawnTimer: number;
}

export interface NpcVehicle {
  id: string;
  name: string;
  mesh: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  path: THREE.Vector3[];
  currentWaypoint: number;
  speed: number;
  headlights: THREE.Light[];
}
