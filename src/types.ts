import * as THREE from 'three';

export type BusType = 'tayo' | 'rogi' | 'lani' | 'gani' | 'pat' | 'frank' | 'alice';
export type VehicleRole = 'bus' | 'police' | 'firetruck' | 'ambulance';
export type ExpressionType = 'normal' | 'happy' | 'wink' | 'surprised';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'blossom' | 'rain_rainbow' | 'snow';
export type CameraMode = 'chase' | 'front_face' | 'first_person' | 'isometric' | 'top_down';

export interface BusConfig {
  id: BusType;
  role: VehicleRole;
  name: string;
  number: string;
  color: number;
  bodyHex: string;
  accentColor: string; // 볼/범퍼 뺨 포인트 색상
  foreheadBg: string;  // 이마 노선번호 배경색
  foreheadText: string;// 이마 텍스트 색상
  hasWhiteVisor: boolean; // 가니처럼 흰색 바이저 바 여부
  hasSiren?: boolean;     // 경찰차/소방차/구급차 경광등 탑재 여부
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
  passengerPhotoUrl?: string;
  passengerMesh: THREE.Group;
  hasPassenger: boolean;
  isFamily?: boolean;
}

export type InteractiveZoneType =
  | 'carwash'
  | 'station'
  | 'garage'
  | 'repair_shop'
  | 'f1_pitstop'
  | 'police_station'
  | 'fire_station'
  | 'hospital';

export interface InteractiveZone {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: InteractiveZoneType;
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

export type NpcVehicleKind =
  | 'pat'
  | 'frank'
  | 'alice'
  | 'ferrari_f1'
  | 'mercedes_f1'
  | 'sedan_yellow'
  | 'suv_mint';

export interface NpcVehicle {
  id: string;
  name: string;
  kind: NpcVehicleKind;
  mapColor?: string;
  mesh: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  sirenMeshes?: THREE.Mesh[];
  path: THREE.Vector3[];
  currentWaypoint: number;
  speed: number;
  headlights: THREE.Light[];
  isF1?: boolean;
}

export interface PedestrianWalker {
  id: string;
  name: string;
  mesh: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  crosswalkDir: 'north_south' | 'east_west';
  progress: number;       // 0 ~ 1
  direction: 1 | -1;
  speed: number;
  isCrossing: boolean;
}

export interface MinimapRoadSegment {
  kind: 'straight' | 'arc' | 'roundabout';
  x1?: number;
  z1?: number;
  x2?: number;
  z2?: number;
  cx?: number;
  cz?: number;
  radius?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  width: number;
}

export interface EmergencyDispatchMission {
  id: string;
  title: string;
  icon: string;
  stationType: 'fire_station' | 'police_station' | 'hospital';
  targetX: number;
  targetZ: number;
  voiceIntro: string;
}
