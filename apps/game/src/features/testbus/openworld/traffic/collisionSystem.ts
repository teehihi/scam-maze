import { VN_TRAFFIC_TUNING } from "./driverModels";
import type { SaigonRoadGraph } from "./roadGraph";
import { sampleEdge, sampleTurn } from "./roadGraph";
import type { OBB2D, PedestrianObstacle, PlayerCollisionResult, VehicleAgent } from "./types";

const CELL_SIZE = 8;

function cellKey(ix: number, iz: number): number {
  return (ix + 512) * 2048 + (iz + 512);
}

export function vehicleToOBB(v: VehicleAgent, padWidth = 0, padLength = 0): OBB2D {
  const fx = Math.sin(v.yaw);
  const fz = Math.cos(v.yaw);
  return {
    x: v.x,
    z: v.z,
    halfWidth: v.halfWidth + padWidth,
    halfLength: v.halfLength + padLength,
    fx,
    fz,
    rx: -fz,
    rz: fx,
  };
}

/**
 * Exact 2D Circle vs Oriented Bounding Box (OBB) resolution.
 * Returns pushed-out circle position & whether collision occurred.
 */
export function resolveCircleVsOBB(
  px: number,
  pz: number,
  radius: number,
  obb: OBB2D,
): { x: number; z: number; hit: boolean; nx: number; nz: number; depth: number } {
  const dx = px - obb.x;
  const dz = pz - obb.z;
  const lx = dx * obb.rx + dz * obb.rz;
  const lz = dx * obb.fx + dz * obb.fz;

  const cx = Math.max(-obb.halfWidth, Math.min(obb.halfWidth, lx));
  const cz = Math.max(-obb.halfLength, Math.min(obb.halfLength, lz));
  const ox = lx - cx;
  const oz = lz - cz;
  const d2 = ox * ox + oz * oz;

  if (d2 >= radius * radius) {
    return { x: px, z: pz, hit: false, nx: 0, nz: 0, depth: 0 };
  }

  let lnx = 0;
  let lnz = 0;
  let depth = 0;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    lnx = ox / d;
    lnz = oz / d;
    depth = radius - d;
  } else {
    // Center is inside the OBB: eject along minimum penetration axis
    const penX = obb.halfWidth - Math.abs(lx);
    const penZ = obb.halfLength - Math.abs(lz);
    if (penX < penZ) {
      lnx = lx >= 0 ? 1 : -1;
      depth = penX + radius;
    } else {
      lnz = lz >= 0 ? 1 : -1;
      depth = penZ + radius;
    }
  }

  const nx = obb.rx * lnx + obb.fx * lnz;
  const nz = obb.rz * lnx + obb.fz * lnz;
  return {
    x: px + nx * depth,
    z: pz + nz * depth,
    hit: true,
    nx,
    nz,
    depth,
  };
}

/**
 * Exact 2D OBB vs OBB Separating Axis Theorem (4-axis SAT).
 * Returns minimum translation vector (nx, nz, depth) pushing `a` away from `b`.
 */
export function testOBBvsOBB(
  a: OBB2D,
  b: OBB2D,
): { hit: boolean; nx: number; nz: number; depth: number } {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNz = 0;

  const axes: [number, number][] = [
    [a.rx, a.rz],
    [a.fx, a.fz],
    [b.rx, b.rz],
    [b.fx, b.fz],
  ];

  for (let i = 0; i < 4; i++) {
    const ax = axes[i][0];
    const az = axes[i][1];
    const dist = dx * ax + dz * az;
    const ra =
      Math.abs(a.rx * ax + a.rz * az) * a.halfWidth +
      Math.abs(a.fx * ax + a.fz * az) * a.halfLength;
    const rb =
      Math.abs(b.rx * ax + b.rz * az) * b.halfWidth +
      Math.abs(b.fx * ax + b.fz * az) * b.halfLength;
    const overlap = ra + rb - Math.abs(dist);
    if (overlap <= 0) {
      return { hit: false, nx: 0, nz: 0, depth: 0 };
    }
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = dist >= 0 ? 1 : -1;
      bestNx = ax * sign;
      bestNz = az * sign;
    }
  }

  return { hit: true, nx: bestNx, nz: bestNz, depth: minOverlap };
}

/** Which of two vehicles standing in a junction box goes first: the one that has waited longer, then the lower id. */
function hasBoxPriority(a: VehicleAgent, b: VehicleAgent): boolean {
  return a.waitTime > b.waitTime || (a.waitTime === b.waitTime && a.id < b.id);
}

export interface HazardForecast {
  /** Net bumper-to-bumper gap to nearest predicted hazard along geodesic path (m) */
  gap: number;
  /** Velocity of hazard projected onto subject forward direction (m/s) */
  hazardSpeed: number;
  /** Acceleration of hazard if it's a vehicle (m/s^2) */
  hazardAccel: number;
  /** What caused the hazard */
  kind: "none" | "vehicle" | "player" | "pedestrian";
  /** True when player is directly blocking this vehicle */
  blockedByPlayer: boolean;
}

/**
 * Spatial Hash Grid + Exact 2D OBB/SAT + CARLA-style Geodesic Collision Forecast.
 */
export class TrafficCollisionSystem {
  private readonly grid = new Map<number, VehicleAgent[]>();
  private readonly obbs = new Map<string, OBB2D>();

  rebuild(vehicles: readonly VehicleAgent[]) {
    this.grid.clear();
    this.obbs.clear();
    for (const v of vehicles) {
      const obb = vehicleToOBB(v);
      this.obbs.set(v.id, obb);
      const r = Math.hypot(v.halfWidth, v.halfLength) + 0.5;
      const x0 = Math.floor((v.x - r) / CELL_SIZE);
      const x1 = Math.floor((v.x + r) / CELL_SIZE);
      const z0 = Math.floor((v.z - r) / CELL_SIZE);
      const z1 = Math.floor((v.z + r) / CELL_SIZE);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = cellKey(ix, iz);
          let list = this.grid.get(k);
          if (!list) {
            list = [];
            this.grid.set(k, list);
          }
          list.push(v);
        }
      }
    }
  }

  queryRadius(x: number, z: number, radius: number): VehicleAgent[] {
    const out: VehicleAgent[] = [];
    const seen = new Set<string>();
    const x0 = Math.floor((x - radius) / CELL_SIZE);
    const x1 = Math.floor((x + radius) / CELL_SIZE);
    const z0 = Math.floor((z - radius) / CELL_SIZE);
    const z1 = Math.floor((z + radius) / CELL_SIZE);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(cellKey(ix, iz));
        if (!list) continue;
        for (const v of list) {
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          out.push(v);
        }
      }
    }
    return out;
  }

  /**
   * Resolve Player (circle) against EVERY moving vehicle & Bus 06 in the city!
   * Guarantees the player can NEVER walk through any moving car, van, bus, or motorbike,
   * and returns realistic bump impulse when brushed by a moving vehicle.
   */
  resolvePlayerVsTraffic(
    px: number,
    pz: number,
    playerY: number,
    playerRadius: number,
  ): PlayerCollisionResult {
    // Player on 2nd-floor balcony or inside Room 6.07 cannot collide with street vehicles
    if (playerY > 1.35) {
      return { x: px, z: pz, hitVehicle: false, impulseX: 0, impulseZ: 0, impactSpeed: 0 };
    }

    let x = px;
    let z = pz;
    let hitVehicle = false;
    let impulseX = 0;
    let impulseZ = 0;
    let impactSpeed = 0;

    const nearby = this.queryRadius(x, z, 9.0);
    for (let iter = 0; iter < 2; iter++) {
      for (const v of nearby) {
        const obb = this.obbs.get(v.id) ?? vehicleToOBB(v);
        const res = resolveCircleVsOBB(x, z, playerRadius + 0.06, obb);
        if (res.hit) {
          x = res.x;
          z = res.z;
          hitVehicle = true;
          if (v.speed > 0.9) {
            // Project vehicle velocity onto collision normal for realistic bump feel
            const vfx = Math.sin(v.yaw) * v.speed;
            const vfz = Math.cos(v.yaw) * v.speed;
            const rel = Math.max(0.6, vfx * res.nx + vfz * res.nz);
            if (rel > impactSpeed) {
              impactSpeed = rel;
              impulseX = res.nx * Math.min(4.8, rel * 0.85);
              impulseZ = res.nz * Math.min(4.8, rel * 0.85);
            }
            // Trigger immediate emergency brake on the vehicle that bumped the player!
            if (!v.externalControl) {
              v.speed = Math.max(0, v.speed * 0.35);
              v.collisionPause = Math.max(v.collisionPause, 0.85);
            }
          }
        }
      }
    }

    return { x, z, hitVehicle, impulseX, impulseZ, impactSpeed };
  }

  /**
   * CARLA Collision Stage — Geodesic Bounding Box Forecast along the vehicle's actual curved trajectory!
   * Detects:
   *  - Leading / merging / crossing vehicles (including Bus 06!)
   *  - Player stepping into the road ahead
   *  - Pedestrians crossing zebra crosswalks ahead
   */
  forecastHazards(
    v: VehicleAgent,
    graph: SaigonRoadGraph,
    playerX: number,
    playerY: number,
    playerZ: number,
    pedestrians: readonly PedestrianObstacle[],
  ): HazardForecast {
    let bestGap = Infinity;
    let bestSpeed = 0;
    let bestAccel = 0;
    let bestKind: HazardForecast["kind"] = "none";
    let blockedByPlayer = false;

    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const rx = -fz;
    const rz = fx;

    const lookDist = Math.max(10.0, Math.min(28.0, v.speed * 2.4 + 6.5));

    // 1. Check Player ahead on street level
    if (playerY < 1.15) {
      const pdx = playerX - v.x;
      const pdz = playerZ - v.z;
      const along = pdx * fx + pdz * fz;
      const lat = Math.abs(pdx * rx + pdz * rz);
      const latSafe = v.halfWidth + 0.62;
      if (lat < latSafe && along > -v.halfLength * 0.4 && along < lookDist) {
        const net = along - v.halfLength - 0.55;
        if (net < bestGap) {
          bestGap = net;
          bestSpeed = 0;
          bestAccel = 0;
          bestKind = "player";
          blockedByPlayer = net < 4.5;
        }
      }
    }

    // 2. Check Pedestrians in road / crosswalk ahead
    for (const ped of pedestrians) {
      const dx = ped.x - v.x;
      const dz = ped.z - v.z;
      const along = dx * fx + dz * fz;
      if (along < -0.5 || along > lookDist * 0.85) continue;
      const lat = Math.abs(dx * rx + dz * rz);
      // Account for pedestrian walking toward our lane in the next 1.2s
      const futureX = ped.x + ped.vx * 1.1;
      const futureZ = ped.z + ped.vz * 1.1;
      const fLat = Math.abs((futureX - v.x) * rx + (futureZ - v.z) * rz);
      if (Math.min(lat, fLat) < v.halfWidth + ped.radius + 0.45) {
        const net = along - v.halfLength - ped.radius - 0.55;
        if (net < bestGap) {
          bestGap = net;
          bestSpeed = 0;
          bestAccel = 0;
          bestKind = "pedestrian";
        }
      }
    }

    // 3. Geodesic corridor scan against all nearby vehicles (handles curves, merges, Bus 06, cross-traffic!)
    const scanCenterX = v.x + fx * (lookDist * 0.45);
    const scanCenterZ = v.z + fz * (lookDist * 0.45);
    const nearby = this.queryRadius(scanCenterX, scanCenterZ, lookDist * 0.65 + 4.5);

    // Pre-sample geodesic waypoints every ~2.2m along this vehicle's planned path (catches even 2m motorbikes!)
    const probeCount = Math.max(5, Math.min(11, Math.ceil(lookDist / 2.2)));
    const probes = this.sampleGeodesicPath(v, graph, lookDist, probeCount);

    for (const other of nearby) {
      if (other.id === v.id) continue;
      const oObb = this.obbs.get(other.id) ?? vehicleToOBB(other);

      // Fast direct longitudinal check (same direction / straight ahead)
      const dx = other.x - v.x;
      const dz = other.z - v.z;
      const along = dx * fx + dz * fz;
      const lat = Math.abs(dx * rx + dz * rz);
      const headingDot = fx * oObb.fx + fz * oObb.fz;

      // Speed-dependent lateral safety pad (tighter for Saigon motorbikes!)
      const latPad =
        v.category === "moto"
          ? other.category === "moto"
            ? 0.24
            : VN_TRAFFIC_TUNING.moto.hazardLatPad
          : 0.32;
      if (
        headingDot > 0.6 &&
        along > 0 &&
        along < lookDist &&
        lat < v.halfWidth + other.halfWidth + latPad
      ) {
        const net = along - (v.halfLength + other.halfLength);
        if (net < bestGap) {
          bestGap = net;
          bestSpeed = other.speed * headingDot;
          bestAccel = other.accel * headingDot;
          bestKind = "vehicle";
        }
        continue;
      }

      // Geodesic curved-corridor check (handles turning vehicles, merging vehicles, and cross-traffic!)
      for (const probe of probes) {
        if (probe.dist - v.halfLength >= bestGap) break;
        const probeObb: OBB2D = {
          x: probe.x,
          z: probe.z,
          halfWidth: v.halfWidth + 0.16,
          halfLength: v.halfLength + 0.25,
          fx: probe.tx,
          fz: probe.tz,
          rx: -probe.tz,
          rz: probe.tx,
        };
        const hit = testOBBvsOBB(probeObb, oObb);
        if (hit.hit) {
          // Determine priority if crossing: vehicle already closer to conflict point has priority
          const otherDistToProbe = Math.hypot(other.x - probe.x, other.z - probe.z);
          const otherHeadingToProbe =
            ((probe.x - other.x) * oObb.fx + (probe.z - other.z) * oObb.fz) /
            Math.max(otherDistToProbe, 0.1);

          // If other is behind us or moving away from the conflict point, ignore
          if (otherHeadingToProbe < -0.25 && otherDistToProbe > other.halfLength + 1.5) continue;

          const net = Math.max(-0.5, probe.dist - (v.halfLength + other.halfLength));
          // A vehicle that is beside us (not ahead of our centre) is no leader. Braking for it makes two vehicles
          // that leave a junction side by side hold each other forever; the hard SAT pass separates real contact.
          if (net <= 0.3 && along < v.halfLength * 0.5 && (v.onTurn || other.onTurn)) continue;
          // Two vehicles standing in the junction box that block each other (oncoming left turn against a straight
          // vehicle, crossing arcs) would wait for each other forever. The one that has waited longer goes first.
          if (
            net <= 3 &&
            headingDot < 0.5 &&
            v.onTurn &&
            other.onTurn &&
            v.speed < 0.3 &&
            other.speed < 0.3 &&
            hasBoxPriority(v, other)
          ) {
            continue;
          }
          if (net < bestGap) {
            bestGap = net;
            const proj = Math.max(0, (probe.tx * oObb.fx + probe.tz * oObb.fz) * other.speed);
            bestSpeed = proj;
            bestAccel = 0;
            bestKind = "vehicle";
          }
          break;
        }
      }
    }

    return {
      gap: bestGap,
      hazardSpeed: bestSpeed,
      hazardAccel: bestAccel,
      kind: bestKind,
      blockedByPlayer,
    };
  }

  /**
   * Hard SAT safety guard between moving vehicles so two vehicles NEVER visually clip even after
   * sudden player interference, dense Saigon motorbike filtering, or distant LOD2 turns.
   */
  resolveHardVehicleContacts(vehicles: readonly VehicleAgent[]) {
    for (let i = 0; i < vehicles.length; i++) {
      const a = vehicles[i];
      if (a.externalControl) continue;
      const obbA = this.obbs.get(a.id);
      if (!obbA) continue;
      const nearby = this.queryRadius(a.x, a.z, a.halfLength + 5.5);
      for (const b of nearby) {
        if (b.id === a.id) continue;
        if (!b.externalControl && b.id < a.id) continue;
        const obbB = this.obbs.get(b.id);
        if (!obbB) continue;
        const sat = testOBBvsOBB(obbA, obbB);
        if (!sat.hit || sat.depth < 0.02) continue;

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const aProj = dx * obbA.fx + dz * obbA.fz;
        const bProj = -dx * obbB.fx - dz * obbB.fz;
        const push = Math.min(0.85, sat.depth + 0.05);

        // Crossing vehicles standing in the junction box: the one with priority is never the one pushed back,
        // otherwise the pair blocks the junction for good.
        const crossingInBox =
          a.onTurn && b.onTurn && !b.externalControl && obbA.fx * obbB.fx + obbA.fz * obbB.fz < 0.5;
        const aYields = crossingInBox ? !hasBoxPriority(a, b) : aProj >= bProj;

        if (aYields || b.externalControl) {
          // `a` is rear/yielding vehicle -> back off along `a`'s arc and update world pos immediately
          a.speed = Math.min(a.speed, Math.max(0, b.speed * 0.55));
          a.s = Math.max(0, a.s - push);
          a.x -= obbA.fx * push * 0.85;
          a.z -= obbA.fz * push * 0.85;
          a.collisionPause = Math.max(a.collisionPause, 0.35);
          obbA.x = a.x;
          obbA.z = a.z;
        } else {
          // `b` is rear/yielding vehicle -> back off `b`
          b.speed = Math.min(b.speed, Math.max(0, a.speed * 0.55));
          b.s = Math.max(0, b.s - push);
          b.x -= obbB.fx * push * 0.85;
          b.z -= obbB.fz * push * 0.85;
          b.collisionPause = Math.max(b.collisionPause, 0.35);
          obbB.x = b.x;
          obbB.z = b.z;
        }
      }
    }
  }

  private sampleGeodesicPath(
    v: VehicleAgent,
    graph: SaigonRoadGraph,
    lookDist: number,
    count: number,
  ): { x: number; z: number; tx: number; tz: number; dist: number }[] {
    const out: { x: number; z: number; tx: number; tz: number; dist: number }[] = [];
    for (let k = 1; k <= count; k++) {
      const d = (lookDist * k) / count;
      const sample = this.advanceAlongPlan(v, graph, d);
      if (sample) out.push({ x: sample.x, z: sample.z, tx: sample.tx, tz: sample.tz, dist: d });
    }
    return out;
  }

  private advanceAlongPlan(
    v: VehicleAgent,
    graph: SaigonRoadGraph,
    deltaS: number,
  ): { x: number; z: number; tx: number; tz: number } | null {
    if (v.onTurn && v.turnId) {
      const turn = graph.turns.get(v.turnId);
      if (!turn) return null;
      const ns = v.s + deltaS;
      if (ns <= turn.length) {
        const s = sampleTurn(turn, ns, v.latOffset * (1 - ns / turn.length));
        return { x: s.x, z: s.z, tx: s.tx, tz: s.tz };
      }
      const nextEdge = graph.edges.get(turn.toEdgeId);
      if (!nextEdge) return null;
      const s = sampleEdge(nextEdge, ns - turn.length, v.targetLatOffset);
      return { x: s.x, z: s.z, tx: s.tx, tz: s.tz };
    }

    const edge = graph.edges.get(v.edgeId);
    if (!edge) return null;
    const ns = v.s + deltaS;
    if (ns <= edge.length) {
      const s = sampleEdge(edge, ns, v.latOffset);
      return { x: s.x, z: s.z, tx: s.tx, tz: s.tz };
    }
    if (v.nextTurnId) {
      const turn = graph.turns.get(v.nextTurnId);
      if (turn) {
        const rem = ns - edge.length;
        if (rem <= turn.length) {
          const s = sampleTurn(turn, rem, v.latOffset * Math.max(0, 1 - rem / turn.length));
          return { x: s.x, z: s.z, tx: s.tx, tz: s.tz };
        }
        const nextEdge = graph.edges.get(turn.toEdgeId);
        if (nextEdge) {
          const s = sampleEdge(nextEdge, rem - turn.length, v.targetLatOffset);
          return { x: s.x, z: s.z, tx: s.tx, tz: s.tz };
        }
      }
    }
    return null;
  }
}
