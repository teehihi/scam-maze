import type { BoxCollider, VehicleState, VehiclePhysicsConfig } from "./types";

/**
 * Resolves 2D collision between a circle (player radius) and an oriented bounding box (car).
 * Pushes the player along the axis of minimum penetration to allow smooth sliding along the car body.
 */
export function resolveBoxCollision(
  px: number,
  pz: number,
  radius: number,
  box: BoxCollider
): { x: number; z: number; collided: boolean } {
  const dx = px - box.x;
  const dz = pz - box.z;
  const yaw = box.yaw || 0;

  const cos = Math.cos(-yaw);
  const sin = Math.sin(-yaw);

  // Transform player into box-local coordinates
  let lx = dx * cos - dz * sin;
  let lz = dx * sin + dz * cos;

  const halfW = box.halfWidth + radius;
  const halfL = box.halfLength + radius;

  if (Math.abs(lx) < halfW && Math.abs(lz) < halfL) {
    const overlapX = halfW - Math.abs(lx);
    const overlapZ = halfL - Math.abs(lz);

    if (overlapX < overlapZ) {
      lx = Math.sign(lx || 1) * halfW;
    } else {
      lz = Math.sign(lz || 1) * halfL;
    }

    // Transform back to world space
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    return {
      x: box.x + (lx * cosY - lz * sinY),
      z: box.z + (lx * sinY + lz * cosY),
      collided: true,
    };
  }

  return { x: px, z: pz, collided: false };
}

/**
 * Checks if the player is within interactive reach of the car's driver door.
 */
export function checkProximityToCar(
  px: number,
  _py: number,
  pz: number,
  carPos: [number, number, number],
  carYaw: number
): boolean {
  // Driver door is located at car-local (-1.35m X, -0.2m Z); check both sides
  const cosY = Math.cos(carYaw);
  const sinY = Math.sin(carYaw);
  const leftDoorX = carPos[0] + (-1.35 * cosY - (-0.2) * sinY);
  const leftDoorZ = carPos[2] + (-1.35 * sinY + (-0.2) * cosY);
  const rightDoorX = carPos[0] + (1.35 * cosY - (-0.2) * sinY);
  const rightDoorZ = carPos[2] + (1.35 * sinY + (-0.2) * cosY);

  const distToLeftDoor = Math.hypot(px - leftDoorX, pz - leftDoorZ);
  const distToRightDoor = Math.hypot(px - rightDoorX, pz - rightDoorZ);
  const distToCenter = Math.hypot(px - carPos[0], pz - carPos[2]);

  return distToLeftDoor < 3.0 || distToRightDoor < 3.0 || distToCenter < 3.8;
}

export interface VehicleInputs {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

/**
 * Deterministic vehicle kinematics and suspension simulation step.
 */
export function stepVehiclePhysics(
  curr: VehicleState,
  inputs: VehicleInputs,
  config: VehiclePhysicsConfig,
  dt: number
): VehicleState {
  let { speed, yaw, steering, pitch, roll } = curr;
  let posX = curr.position[0];
  const posY = curr.position[1];
  let posZ = curr.position[2];

  // 1. Speed-sensitive progressive steering kinematics (Lexus VGRS & Caster alignment)
  // When driving straight at cruising speed (>30-60 km/h), steering sensitivity and maximum lock
  // angle are dynamically attenuated. Quick key taps yield gentle 1°–2° micro-adjustments for stable lane keeping.
  // At low parking speeds (0-15 km/h), full lock angle (~30°) is retained for easy sharp cornering.
  const absSpeed = Math.abs(speed);
  const speedFactor = 1.0 / (1.0 + Math.pow(absSpeed / 5.0, 1.4));
  const effectiveMaxSteer = config.maxSteerAngle * (0.16 + 0.84 * speedFactor);

  const targetSteerInput = (inputs.left ? 1 : 0) + (inputs.right ? -1 : 0);
  const targetSteer = targetSteerInput * effectiveMaxSteer;

  // Steering build-up rate: progressive and gentle at speed, agile when maneuvering
  const buildRate = config.steerSpeed * (0.28 + 0.42 * speedFactor);
  // Self-aligning caster return rate: faster return to center at higher speeds
  const returnRate = config.steerSpeed * (1.2 + 0.8 * Math.min(1.5, absSpeed / 8.0));

  if (targetSteerInput !== 0) {
    steering += (targetSteer - steering) * Math.min(1, buildRate * dt);
  } else {
    // Return-to-center self-aligning torque
    steering += (0 - steering) * Math.min(1, returnRate * dt);
  }

  // 2. Acceleration / Braking / Reverse
  let accelRate = 0;
  if (inputs.forward) {
    if (speed >= -0.2) {
      accelRate = config.acceleration;
    } else {
      // Braking while going backward
      accelRate = config.brakeForce;
    }
  } else if (inputs.backward) {
    if (speed > 0.4) {
      // Braking while going forward
      accelRate = -config.brakeForce;
    } else {
      // Reversing
      accelRate = -config.acceleration * 0.55;
    }
  } else {
    // Rolling friction & air drag
    accelRate = -Math.sign(speed) * Math.min(Math.abs(speed), config.friction);
  }

  if (inputs.handbrake) {
    accelRate = -Math.sign(speed) * config.handbrakeForce;
  }

  speed += accelRate * dt;

  // Clamp speeds
  if (speed > config.maxSpeedForward) speed = config.maxSpeedForward;
  if (speed < -config.maxSpeedReverse) speed = -config.maxSpeedReverse;
  if (Math.abs(speed) < 0.05 && !inputs.forward && !inputs.backward) speed = 0;

  // Determine current gear
  let gear: "P" | "D" | "R" = "P";
  if (speed > 0.1 || (inputs.forward && speed >= 0)) gear = "D";
  else if (speed < -0.1 || (inputs.backward && speed <= 0)) gear = "R";
  else gear = "P";

  // 3. Heading integration (Bicycle model / Ackermann approximation)
  // Low-speed steering requires movement, with subtle stationary dry-steering
  const wheelBase = 2.85;
  const effectiveSpeed = Math.abs(speed) > 0.08 ? speed : (inputs.forward || inputs.backward ? speed : 0);
  const rawYawRate = (effectiveSpeed / wheelBase) * Math.sin(steering);

  // Lateral acceleration limit (~0.7g) to keep 2.5-ton luxury SUV stable and prevent twitching at speed
  const maxLateralG = 0.72;
  const maxYawRate = (maxLateralG * 9.81) / Math.max(2.5, absSpeed);
  const yawRate = Math.sign(rawYawRate) * Math.min(Math.abs(rawYawRate), maxYawRate);
  yaw += yawRate * dt;

  // 4. Position integration along car's forward vector
  // In our coordinate space: facing +Z is yaw = 0, +X is right, -X is left
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);

  posX += forwardX * speed * dt;
  posZ += forwardZ * speed * dt;

  // Road curb boundary clamping
  const b = config.roadBounds;
  let hitCurb = false;
  if (posX < b.minX) {
    posX = b.minX;
    hitCurb = true;
  } else if (posX > b.maxX) {
    posX = b.maxX;
    hitCurb = true;
  }
  if (posZ < b.minZ) {
    posZ = b.minZ;
    hitCurb = true;
  } else if (posZ > b.maxZ) {
    posZ = b.maxZ;
    hitCurb = true;
  }

  if (hitCurb) {
    speed *= -0.2; // Slight bumper rebound
  }

  // 5. Dynamic vehicle suspension pitch & roll
  const targetPitch = Math.max(-0.04, Math.min(0.04, -accelRate * 0.002));
  pitch += (targetPitch - pitch) * Math.min(1, 10 * dt);

  const lateralAccel = speed * yawRate;
  const targetRoll = Math.max(-0.06, Math.min(0.06, -lateralAccel * 0.005));
  roll += (targetRoll - roll) * Math.min(1, 12 * dt);

  // Steering wheel visual rotation: scaled from wheel angle
  const steeringWheelRotation = (steering / config.maxSteerAngle) * 1.5; // up to ~85 deg

  return {
    ...curr,
    position: [posX, posY, posZ],
    yaw,
    speed,
    steering,
    gear,
    steeringWheelRotation,
    pitch,
    roll,
  };
}
