import type { DriverPersonality, RoadEdge, VehicleAgent, VehicleCategory } from "./types";

const ACC_COOL = 0.99;

function fastTanh(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return -1;
  const e2 = Math.exp(2 * x);
  return (e2 - 1) / (e2 + 1);
}

/**
 * Road surface grip multiplier μ(wetness) for Ho Chi Minh City asphalt:
 *   Dry (wetness = 0.0): μ = 1.00
 *   Damp drizzle (0.5):  μ = 0.78
 *   Monsoon rain (1.0):  μ = 0.58 (lengthens braking distance ~70% like real wet Saigon asphalt!)
 */
export function roadFrictionFactor(wetness: number): number {
  const w = Math.max(0, Math.min(1, wetness));
  return 1.0 - 0.42 * w;
}

/** Create realistic Saigon driver personality distribution per vehicle category. */
export function createDriverPersonality(category: VehicleCategory, seed: number): DriverPersonality {
  // Deterministic pseudo-random [0, 1) from integer seed
  const h = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const r1 = h(1);
  const r2 = h(2);
  const r3 = h(3);
  const r4 = h(4);

  if (category === "moto") {
    return {
      driverFactor: 0.88 + r1 * 0.30, // 0.88..1.18 (agile Saigon riders)
      timeHeadway: 0.68 + r2 * 0.42, // 0.68..1.10s (tight urban motorbike headway)
      minGap: 0.85 + r3 * 0.45, // 0.85..1.30m bumper-to-bumper standstill gap
      maxAccel: 2.3 + r1 * 1.1, // 2.3..3.4 m/s^2 brisk scooter launch
      comfortBrake: 2.8 + r2 * 0.9, // 2.8..3.7 m/s^2
      maxBrake: 8.5,
      politeness: 0.05 + r3 * 0.25, // Motorcycles filter assertively
      reactionTime: 0.42 + r4 * 0.28,
      impatient: r4 > 0.72, // ~28% impatient riders who creep at red countdown <= 1.2s
      noiseSeed: seed * 1.618,
    };
  }

  if (category === "van" || category === "bus") {
    return {
      driverFactor: 0.84 + r1 * 0.16,
      timeHeadway: 1.35 + r2 * 0.50,
      minGap: 2.2 + r3 * 0.7,
      maxAccel: 1.35 + r1 * 0.45,
      comfortBrake: 2.0 + r2 * 0.5,
      maxBrake: 6.8,
      politeness: 0.25 + r3 * 0.3,
      reactionTime: 0.58 + r4 * 0.3,
      impatient: false,
      noiseSeed: seed * 1.618,
    };
  }

  // Passenger car / taxi / SUV
  return {
    driverFactor: 0.88 + r1 * 0.24,
    timeHeadway: 1.05 + r2 * 0.45,
    minGap: 1.7 + r3 * 0.6,
    maxAccel: 1.9 + r1 * 0.75,
    comfortBrake: 2.4 + r2 * 0.7,
    maxBrake: 8.2,
    politeness: 0.15 + r3 * 0.35,
    reactionTime: 0.48 + r4 * 0.28,
    impatient: r4 > 0.85,
    noiseSeed: seed * 1.618,
  };
}

/**
 * Treiber's ACC (IDM+ blended with Constant Acceleration Heuristic) longitudinal acceleration model.
 * Ported directly from `movsim/traffic-simulation-de/master/js/models.js` with road-wetness traction scaling.
 *
 * @param gap       Actual bumper-to-bumper net gap s [m]
 * @param v         Subject speed [m/s]
 * @param vl        Leader speed [m/s]
 * @param al        Leader acceleration [m/s^2]
 * @param vDesired  Effective speed limit / curve speed cap [m/s]
 * @param p         Driver personality parameters
 * @param muRoad    Road grip multiplier (1.0 dry, ~0.58 heavy rain)
 * @param time      Simulation clock for deterministic organic speed noise (0 = deterministic)
 */
export function computeAccIdmPlus(
  gap: number,
  v: number,
  vl: number,
  al: number,
  vDesired: number,
  p: DriverPersonality,
  muRoad: number,
  time = 0,
): number {
  const bEff = p.comfortBrake * muRoad;
  const bMaxEff = p.maxBrake * muRoad;
  const aEff = p.maxAccel * p.driverFactor * (0.85 + 0.15 * muRoad);
  const v0Eff = Math.max(0.01, Math.min(vDesired, vDesired * p.driverFactor));

  // Hard close-gap smooth ramp (exact Treiber ACC s < s0 guard)
  if (gap < p.minGap) {
    const ratio = (p.minGap - gap) / Math.max(p.minGap, 0.25);
    return Math.max(-bMaxEff, -(bEff + (bMaxEff - bEff) * Math.min(1.5, ratio)));
  }

  // Free-road acceleration term
  const accFree = v < v0Eff ? aEff * (1 - Math.pow(v / v0Eff, 4)) : aEff * (1 - v / v0Eff);

  // Desired dynamical gap s* (depends on own speed AND relative closing speed dv = v - vl!)
  const dv = v - vl;
  const sStar = p.minGap + Math.max(0, v * p.timeHeadway + (0.5 * v * dv) / Math.sqrt(Math.max(0.1, aEff * bEff)));
  const accInt = -aEff * Math.pow(sStar / Math.max(gap, 0.15), 2);

  // IDM+
  const accIdm = Math.min(accFree, aEff + accInt);

  // Constant Acceleration Heuristic (CAH) — prevents artificial panic-braking on close merges/cut-ins
  const alClamped = Math.max(-bMaxEff, Math.min(al, aEff));
  const accCahRaw =
    vl * dv < -2 * gap * alClamped
      ? (v * v * alClamped) / Math.max(vl * vl - 2 * gap * alClamped, 0.05)
      : alClamped - (dv > 0 ? (dv * dv) / (2 * Math.max(gap, 0.05)) : 0);
  const accCah = Math.min(accCahRaw, aEff);

  const accMix = accIdm > accCah ? accIdm : accCah + bEff * fastTanh((accIdm - accCah) / Math.max(bEff, 0.5));
  const accAcc = ACC_COOL * accMix + (1 - ACC_COOL) * accIdm;

  // Subtle organic human throttle fluctuation (zero when stopped or close to leader)
  const noise =
    time > 0 && v > 1.2 && gap > p.minGap * 2
      ? 0.14 * Math.sin(time * 0.9 + p.noiseSeed) * Math.cos(time * 0.37 + p.noiseSeed * 2.1)
      : 0;

  return Math.max(-bMaxEff, Math.min(aEff, accAcc + noise));
}

/**
 * MOBIL lane-change decision for 4-wheelers (adapted from `movsim/traffic-simulation-de/master/js/models.js`).
 * Uses speed-dependent safe deceleration so congested city traffic allows realistic polite merges.
 */
export function evaluateMobilLaneChange(params: {
  vRel: number;
  accOwnOld: number;
  accOwnNew: number;
  accLagOld: number;
  accLagNew: number;
  politeness: number;
  bias: number; // + for preferred lane (e.g. turn lane prep), 0 neutral
  muRoad: number;
}): boolean {
  const bSafeHigh = 2.8 * params.muRoad;
  const bSafeLow = 4.6 * params.muRoad;
  const bSafeActual = params.vRel * bSafeHigh + (1 - params.vRel) * bSafeLow;
  const bThr = 0.28;

  // Safety criterion: never force the new follower in target lane to slam brakes
  if (params.accLagNew < -bSafeActual) return false;

  // Incentive criterion
  const deltaAcc =
    params.accOwnNew -
    params.accOwnOld +
    params.politeness * (params.accLagNew - params.accLagOld) +
    params.bias -
    bThr;
  return deltaAcc > 0;
}

export interface LateralNeighbor {
  /** Longitudinal center offset ahead (+ = ahead, - = behind) */
  ds: number;
  /** Lateral offset on the same edge */
  lat: number;
  halfLength: number;
  halfWidth: number;
  speed: number;
  category: VehicleCategory;
}

/**
 * Saigon Motorbike Sublane & Social-Force Planner (SUMO SL2015 + HCMC Mixed Traffic Research).
 *
 * Computes desired continuous lateral offset inside `edge.motoLatRange`:
 *  1. Speed-dependent lateral clearance (tight 0.38m at crawl -> wide 0.85m at 40 km/h)
 *  2. Curb obstruction avoidance (parked SUV/van, Bus 06 stopped at curb)
 *  3. Queue seepage / red-light motorbike swarm: within 26m of a red/amber stop line,
 *     actively seeks open lateral gaps beside stopped cars/vans to fan out abreast at the stop bar!
 *  4. Dynamic overtaking around slower cars/trucks on mid-block stretches
 *  5. Turn positioning: shifts smoothly to the right curb before a right turn, or left before a left turn.
 */
export function computeSaigonMotoSublaneTarget(opts: {
  v: VehicleAgent;
  edge: RoadEdge;
  neighbors: readonly LateralNeighbor[];
  distToStop: number;
  signalIsRedOrAmber: boolean;
  upcomingTurnKind: "straight" | "right" | "left" | "uturn" | null;
}): number {
  const { v, edge, neighbors, distToStop, signalIsRedOrAmber, upcomingTurnKind } = opts;
  const [minLat, maxLat] = edge.motoLatRange;

  // Speed-dependent required lateral clearance (SUMO SL2015 LATGAP_SPEED_THRESHOLD)
  const speedFrac = Math.min(1, v.speed / 12.0);
  const reqLatGap = 0.36 + 0.44 * speedFrac;

  // Preferred baseline lateral position:
  // - Turning right -> hug right curb (+1.55)
  // - Turning left -> shift toward inner left side (-1.45)
  // - Straight -> gentle right-side Saigon motorbike preference (+0.75 + per-rider spread)
  let preferredLat = 0.65 + ((v.personality.noiseSeed % 1) - 0.5) * 1.4;
  if (distToStop < 32 && upcomingTurnKind === "right") {
    preferredLat = Math.min(maxLat - 0.15, 1.45);
  } else if (distToStop < 32 && upcomingTurnKind === "left") {
    preferredLat = Math.max(minLat + 0.15, -1.45);
  }

  // Evaluate 9 candidate continuous sublane positions across [minLat, maxLat]
  const SAMPLES = 9;
  let bestLat = v.latOffset;
  let bestScore = -Infinity;

  for (let i = 0; i < SAMPLES; i++) {
    const cand = minLat + ((maxLat - minLat) * i) / (SAMPLES - 1);
    let score = 0;

    // Small hysteresis to prevent oscillating between two equally good sublanes
    score -= Math.abs(cand - v.latOffset) * 0.45;
    // Gentle pull toward preferred lane/turn position
    score -= Math.abs(cand - preferredLat) * 0.32;

    let blocked = false;

    // Static curb obstructions (parked SUV & Van along Lý Thái Tổ)
    for (const obs of edge.curbObstructions) {
      const ds = obs.s - v.s;
      if (ds > -obs.halfLen - 2.0 && ds < obs.halfLen + 14.0) {
        if (cand + v.halfWidth + 0.35 > obs.latMin && cand - v.halfWidth - 0.35 < obs.latMax) {
          if (ds < obs.halfLen + 5.5) blocked = true;
          score -= 18;
        }
      }
    }

    // Dynamic vehicle neighbors (cars, buses, other motorbikes)
    for (const n of neighbors) {
      const latClear = Math.abs(cand - n.lat) - (v.halfWidth + n.halfWidth);
      const longOverlap = Math.abs(n.ds) < v.halfLength + n.halfLength + 0.9;

      // Never slide sideways into an adjacent vehicle beside us!
      if (longOverlap && latClear < reqLatGap) {
        blocked = true;
        break;
      }

      // Leader directly ahead in this candidate sublane
      if (n.ds > 0 && n.ds < 22 && latClear < reqLatGap * 0.9) {
        const netGap = Math.max(0.2, n.ds - (v.halfLength + n.halfLength));
        const speedLoss = Math.max(0, edge.speedLimit * v.personality.driverFactor - n.speed);
        // Stronger penalty when blocked behind a slow/stopped wide vehicle -> triggers Saigon seepage/filtering!
        const widthFactor = n.category === "moto" ? 1.0 : 1.55;
        score -= (speedLoss * 1.45 * widthFactor) / (1 + netGap * 0.16);
      }

      // Red-light motorbike swarm bonus: when approaching a red light (<26m), prefer open lateral slots
      // so motorcycles spread abreast near the stop bar instead of forming a 1-file tail behind cars!
      if (signalIsRedOrAmber && distToStop < 26 && n.ds > -1 && n.ds < 14 && latClear >= reqLatGap + 0.15) {
        score += 0.9;
      }
    }

    if (blocked) continue;
    if (score > bestScore) {
      bestScore = score;
      bestLat = cand;
    }
  }

  return Math.max(minLat, Math.min(maxLat, bestLat));
}
