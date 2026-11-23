import * as T from "three";
import type { VehicleAgent } from "./types";

const GRAVITY = 9.81;
const _qTmp = new T.Quaternion();
const _yAxis = new T.Vector3(0, 1, 0);

/**
 * Second-order Spring-Damper Chassis Suspension, Physical Motorcycle Lean,
 * Ackermann Front-Wheel Steering & Rider Head-Gaze Controller.
 *
 * Unlike linear lerp, a 2nd-order damped oscillator (omega_n, zeta) reproduces:
 *  - Brake dive & signature subtle spring rebound when a car comes to a full stop
 *  - Acceleration squat on green-light launch
 *  - Centrifugal motorcycle lean φ = atan(v * yawRate / g) + lateral weave lean
 *  - Subtle engine idle vibration when stationary at a red light
 */
export function updateVehicleDynamicsAndRig(
  v: VehicleAgent,
  dt: number,
  time: number,
  stepDist: number,
  curvature: number,
  playerX: number,
  playerZ: number,
) {
  const rig = v.rig;
  if (!rig) return;

  // 1. Place outer root smoothly in world space
  rig.root.position.set(v.x, 0, v.z);
  rig.root.rotation.y = v.yaw;

  // Coarse LOD (>135m): skip suspension, steering & head gaze
  if (v.lodTier === 2) return;

  // 2. Ackermann front-wheel steering angle δ = atan(L * κ) + lateral lane-change steering
  const latSteer = v.speed > 0.35 ? Math.atan2(-v.latVel, Math.max(v.speed, 1.5)) * 0.55 : 0;
  const targetSteer = T.MathUtils.clamp(Math.atan(v.wheelBase * curvature) + latSteer, -0.52, 0.52);
  v.steerAngle += (targetSteer - v.steerAngle) * Math.min(1, dt * 10);

  // 3. Spin all wheels + steer front wheels (LOD 0 & 1)
  if (stepDist > 0.0005 && rig.wheelRadius > 0.05) {
    const turn = stepDist / rig.wheelRadius;
    for (const w of rig.wheels) {
      w.node.rotation.x += w.sign * turn;
      if (w.isFront && v.lodTier === 0) {
        w.node.rotation.y = w.baseYaw + v.steerAngle;
      }
    }
  } else if (v.lodTier === 0) {
    for (const w of rig.wheels) {
      if (w.isFront) w.node.rotation.y = w.baseYaw + v.steerAngle;
    }
  }

  // 4. Brake light & turn-signal lamps (blinking at realistic 1.6 Hz = ~96 flashes/min)
  const targetBrake =
    v.accel < -0.75
      ? T.MathUtils.clamp((-v.accel - 0.5) / 3.2, 0.35, 1.0)
      : v.speed < 0.25 && v.waitTime > 0.1
        ? 0.72 // Foot on brake while stopped at red light!
        : 0;
  v.brakeLevel += (targetBrake - v.brakeLevel) * Math.min(1, dt * 14);
  const blinkOn = v.blinker !== 0 && Math.floor(time * 3.2) % 2 === 0;
  rig.lights?.setBrake(v.brakeLevel);
  rig.lights?.setBlinker(v.blinker, blinkOn);

  // Full 2nd-order suspension & rider gaze ONLY within Tier 0 (< 48m of player)
  if (v.lodTier > 0) {
    rig.chassis.rotation.x = 0;
    rig.chassis.rotation.z = 0;
    return;
  }

  // 5. Second-order spring-damper pitch (brake dive & launch squat)
  const isMoto = v.category === "moto";
  const isHeavy = v.category === "van" || v.category === "bus";

  // Positive rotation.x dips nose (+Z) down? Check right-hand rule around +X (left):
  // Thumb along +X (left) -> fingers curl +Y -> +Z (nose dips DOWN for +rotation.x)!
  // Braking (accel < 0) dips nose DOWN -> targetPitch > 0!
  const pitchGain = isMoto ? 0.0065 : isHeavy ? 0.0085 : 0.0062;
  const maxPitch = isMoto ? 0.055 : 0.048;
  const targetPitch = T.MathUtils.clamp(-v.accel * pitchGain, -maxPitch, maxPitch);

  const omegaP = isHeavy ? 8.5 : 11.5; // Natural frequency (rad/s)
  const zetaP = isHeavy ? 0.52 : 0.60; // Slightly underdamped -> crisp realistic settle bounce!
  const pitchAcc = omegaP * omegaP * (targetPitch - v.pitch) - 2 * zetaP * omegaP * v.pitchVel;
  v.pitchVel += pitchAcc * dt;
  v.pitch = T.MathUtils.clamp(v.pitch + v.pitchVel * dt, -0.09, 0.09);

  // 6. Roll / Physical Motorcycle Lean!
  // Right-hand rule around +Z (nose): thumb along +Z -> fingers curl +X (left) -> +Y (up),
  // so +rotation.z leans the top (+Y) toward -X (RIGHT)!
  // Left turn = yawRate > 0 -> centrifugal pushes car top RIGHT (+rotZ), while motorcycle leans INTO turn LEFT (-rotZ)!
  const lateralAccel = v.speed * v.yawRate + v.latVel * 1.4;
  let targetRoll: number;
  if (isMoto) {
    // Physical bike lean into the turn: φ = atan(a_lat / g)
    targetRoll = T.MathUtils.clamp(-Math.atan(lateralAccel / GRAVITY) * 1.15, -0.40, 0.40);
  } else {
    // 4-wheeler body roll outward during cornering
    const rollGain = isHeavy ? 0.011 : 0.0075;
    targetRoll = T.MathUtils.clamp(lateralAccel * rollGain, -0.068, 0.068);
  }

  const omegaR = isMoto ? 9.5 : 10.0;
  const zetaR = isMoto ? 0.72 : 0.58;
  const rollAcc = omegaR * omegaR * (targetRoll - v.roll) - 2 * zetaR * omegaR * v.rollVel;
  v.rollVel += rollAcc * dt;
  v.roll = T.MathUtils.clamp(v.roll + v.rollVel * dt, -0.44, 0.44);

  // Subtle idle engine vibration on motorbikes & vans when waiting at red lights
  const idleVib =
    v.speed < 0.35
      ? Math.sin(time * (isMoto ? 34 : 22) + v.personality.noiseSeed) * (isMoto ? 0.0028 : 0.0014)
      : Math.sin(time * (14 + v.speed * 1.2) + v.personality.noiseSeed) * 0.0018;

  rig.chassis.rotation.x = v.pitch + idleVib;
  rig.chassis.rotation.z = v.roll;

  // 7. Rider / driver head gaze: looks into corners or glances toward player when stopped for them!
  if (rig.crewHead && rig.crewHeadRestQ) {
    let headYaw = T.MathUtils.clamp(v.steerAngle * 0.65, -0.45, 0.45);
    if (v.speed < 1.2) {
      const dx = playerX - v.x;
      const dz = playerZ - v.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < 64 && dSq > 0.25) {
        // Transform direction to player into vehicle local frame (+Z = forward, +X = left)
        const fx = Math.sin(v.yaw);
        const fz = Math.cos(v.yaw);
        const localFwd = dx * fx + dz * fz;
        const localLeft = dx * fz - dz * fx;
        if (localFwd > -0.8) {
          headYaw = T.MathUtils.clamp(Math.atan2(localLeft, Math.max(0.5, localFwd)), -0.75, 0.75);
        }
      }
    }
    _qTmp.setFromAxisAngle(_yAxis, headYaw);
    rig.crewHead.quaternion.copy(rig.crewHeadRestQ).multiply(_qTmp);
  }
}
