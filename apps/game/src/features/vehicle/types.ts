export interface BoxCollider {
  x: number;
  z: number;
  halfWidth: number;
  halfLength: number;
  yaw?: number;
}

export interface VehicleState {
  position: [number, number, number];
  yaw: number;
  speed: number;
  steering: number;
  gear: "P" | "D" | "R";
  isDriving: boolean;
  isNearCar: boolean;
  steeringWheelRotation: number;
  pitch: number;
  roll: number;
}

export interface VehiclePhysicsConfig {
  maxSpeedForward: number; // m/s (~65 km/h)
  maxSpeedReverse: number; // m/s (~18 km/h)
  acceleration: number;    // m/s^2
  brakeForce: number;      // m/s^2
  handbrakeForce: number;  // m/s^2
  friction: number;        // drag coefficient
  steerSpeed: number;      // rad/s
  maxSteerAngle: number;   // rad (~32 deg)
  roadBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export const DEFAULT_VEHICLE_CONFIG: VehiclePhysicsConfig = {
  maxSpeedForward: 17.5, // ~63 km/h
  maxSpeedReverse: 4.8,  // ~17 km/h
  acceleration: 10.5,
  brakeForce: 22.0,
  handbrakeForce: 30.0,
  friction: 2.2,
  steerSpeed: 2.0,
  maxSteerAngle: 0.52, // ~30 deg
  roadBounds: {
    minX: 184.2,
    maxX: 194.0,
    minZ: -87.0,
    maxZ: 47.0,
  },
};
