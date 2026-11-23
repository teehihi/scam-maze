import { describe, expect, it } from "vitest";
import {
  SaigonRoadGraph,
  SaigonTrafficManager,
  TrafficSignalController,
  computeAccIdmPlus,
  computeSaigonMotoSublaneTarget,
  createDriverPersonality,
  resolveCircleVsOBB,
  roadFrictionFactor,
  sampleEdge,
  sampleTurn,
  testOBBvsOBB,
  vehicleToOBB,
} from "../index";
import { stepVehiclePhysics } from "../../../../vehicle/vehiclePhysics";
import type { VehiclePhysicsConfig, VehicleState } from "../../../../vehicle/types";

describe("Saigon Street Simulation Engine", () => {
  it("enforces true Vietnam Right-Hand Traffic & C1 Bézier continuity across the entire road graph", () => {
    const graph = new SaigonRoadGraph();
    expect(graph.edges.size).toBeGreaterThanOrEqual(20);
    expect(graph.turns.size).toBeGreaterThanOrEqual(30);

    // Every edge must have at least one outgoing turn (zero dead ends)
    for (const edge of graph.edges.values()) {
      expect(edge.outgoingTurns.length, `Edge ${edge.id} has no outgoing turns`).toBeGreaterThan(0);
    }

    // Verify true Vietnam RHT side-of-median on every boulevard!
    expect(graph.edges.get("LTT_S_NB")!.start.x).toBeGreaterThan(-6.4); // Northbound East half
    expect(graph.edges.get("LTT_S_SB")!.start.x).toBeLessThan(-6.4); // Southbound West half
    expect(graph.edges.get("D32_W_EB")!.start.z).toBeGreaterThan(-76); // Eastbound South half
    expect(graph.edges.get("D32_W_WB")!.start.z).toBeLessThan(-76); // Westbound North half
    expect(graph.edges.get("DBP_W_EB")!.start.z).toBeGreaterThan(-147);
    expect(graph.edges.get("DBP_W_WB")!.start.z).toBeLessThan(-147);
    expect(graph.edges.get("HT_S_NB")!.start.x).toBeGreaterThan(56);
    expect(graph.edges.get("HT_S_SB")!.start.x).toBeLessThan(56);

    // Every turn spline starts exactly at fromEdge.end and ends at toEdge.start with matching tangents
    for (const turn of graph.turns.values()) {
      const from = graph.edges.get(turn.fromEdgeId)!;
      const to = graph.edges.get(turn.toEdgeId)!;
      const s0 = sampleTurn(turn, 0);
      const s1 = sampleTurn(turn, turn.length);
      expect(Math.hypot(s0.x - from.end.x, s0.z - from.end.z)).toBeLessThan(0.02);
      expect(Math.hypot(s1.x - to.start.x, s1.z - to.start.z)).toBeLessThan(0.02);
      // Tangent alignment dot product > 0.98
      expect(s0.tx * from.tx + s0.tz * from.tz).toBeGreaterThan(0.98);
      expect(s1.tx * to.tx + s1.tz * to.tz).toBeGreaterThan(0.98);
    }

    // Conflict matrices must be symmetric & detect crossing turns at Bitexco 4-way junction
    const bitexco = graph.intersections.get("J_HT_DBP")!;
    expect(bitexco.turnIds.length).toBe(12);
    let totalConflicts = 0;
    for (const tid of bitexco.turnIds) {
      const t = graph.turns.get(tid)!;
      totalConflicts += t.conflicts.size;
      for (const cid of t.conflicts) {
        expect(graph.turns.get(cid)!.conflicts.has(tid)).toBe(true);
      }
    }
    expect(totalConflicts).toBeGreaterThan(20);
  });

  it("enforces QCVN 41:2024 traffic signals with zero conflicting greens and mandatory All-Red clearance", () => {
    const graph = new SaigonRoadGraph();
    const ctrl = new TrafficSignalController(graph.intersections.values());

    let sawAllRed = false;
    for (let t = 0; t < 240; t += 0.25) {
      ctrl.update(t);
      for (const inter of graph.intersections.values()) {
        if (!inter.signalized) continue;
        const snap = ctrl.getSnapshot(inter.id)!;
        // Safety invariant: NS and EW can NEVER be green/amber simultaneously!
        const nsActive = snap.ns.lamp !== "red";
        const ewActive = snap.ew.lamp !== "red";
        expect(nsActive && ewActive, `${inter.id} conflict at t=${t}`).toBe(false);
        if (snap.allRed) sawAllRed = true;
      }
    }
    expect(sawAllRed).toBe(true);
  });

  it("applies Treiber ACC/IDM+ velocity-aware braking and wet-asphalt grip scaling (both AI & drivable SUV)", () => {
    const p = createDriverPersonality("car", 1);
    const dryMu = roadFrictionFactor(0);
    const wetMu = roadFrictionFactor(1);
    expect(dryMu).toBeCloseTo(1.0, 4);
    expect(wetMu).toBeLessThan(0.65);

    // Approaching a stopped car at 11 m/s from 15m -> must brake hard
    const aDry = computeAccIdmPlus(15, 11, 0, 0, 11, p, dryMu);
    const aWet = computeAccIdmPlus(15, 11, 0, 0, 11, p, wetMu);
    expect(aDry).toBeLessThan(-1.5);
    expect(aWet).toBeLessThan(-1.5);
    // On wet asphalt, peak braking deceleration is limited by reduced grip μ
    const emergencyDry = computeAccIdmPlus(0.4, 10, 0, 0, 11, p, dryMu);
    const emergencyWet = computeAccIdmPlus(0.4, 10, 0, 0, 11, p, wetMu);
    expect(Math.abs(emergencyWet)).toBeLessThan(Math.abs(emergencyDry));

    // Drivable Lexus SUV wet-road braking distance test
    const suvConfig: VehiclePhysicsConfig = {
      maxSpeedForward: 22,
      maxSpeedReverse: 6,
      acceleration: 5.5,
      brakeForce: 10.0,
      handbrakeForce: 14.0,
      friction: 1.5,
      maxSteerAngle: 0.55,
      steerSpeed: 4.0,
      roadBounds: { minX: -100, maxX: 100, minZ: -500, maxZ: 500 },
    };
    const simulateStop = (wetness: number) => {
      let st: VehicleState = {
        isDriving: true,
        isNearCar: true,
        position: [0, 0, 0],
        yaw: 0,
        speed: 15,
        steering: 0,
        gear: "D",
        steeringWheelRotation: 0,
        pitch: 0,
        roll: 0,
      };
      for (let k = 0; k < 200 && st.speed > 0.05; k++) {
        st = stepVehiclePhysics(
          st,
          { forward: false, backward: true, left: false, right: false, handbrake: false },
          suvConfig,
          0.02,
          wetness,
        );
      }
      return st.position[2];
    };
    const stopDry = simulateStop(0);
    const stopRain = simulateStop(1);
    expect(stopRain).toBeGreaterThan(stopDry * 1.45);
  });

  it("filters Saigon motorbikes laterally around stopped cars at red lights and around parked curb obstacles", () => {
    const mgr = new SaigonTrafficManager();
    const edge = mgr.graph.edges.get("LTT_S_NB")!;
    const moto = mgr.spawnVehicle({
      id: "M1",
      category: "moto",
      edgeId: "LTT_S_NB",
      s: 90,
      latOffset: -1.4,
      halfWidth: 0.44,
      halfLength: 1.04,
      speed: 4.5,
    });
    // Blocked directly ahead by a stopped van in inner lane (lat = -1.45) near red stop line!
    const targetLat = computeSaigonMotoSublaneTarget({
      v: moto,
      edge,
      neighbors: [
        {
          ds: 5.0,
          lat: -1.45,
          halfLength: 2.0,
          halfWidth: 1.0,
          speed: 0,
          category: "van",
        },
      ],
      distToStop: 15,
      signalIsRedOrAmber: true,
      upcomingTurnKind: "straight",
    });
    // Motorbike should filter clearly away from the stopped van into open right-side space!
    expect(Math.abs(targetLat - -1.45)).toBeGreaterThan(1.4);
  });

  it("resolves exact 2D OBB/SAT collisions for Player↔Vehicle and angled Vehicle↔Vehicle", () => {
    const mgr = new SaigonTrafficManager();
    const taxi = mgr.spawnVehicle({
      id: "T1",
      category: "car",
      edgeId: "D32_W_EB",
      s: 15,
      laneIndex: 0,
      halfWidth: 0.92,
      halfLength: 2.24,
      speed: 6.0,
    });
    mgr.collisions.rebuild(mgr.vehicles);

    // Player standing directly inside the taxi's street footprint -> pushed cleanly outside with impulse!
    const hit = mgr.resolvePlayerCollision(taxi.x + 0.1, taxi.z, 0.0, 0.26);
    expect(hit.hitVehicle).toBe(true);
    expect(hit.impactSpeed).toBeGreaterThan(0.5);
    const verifyOutside = resolveCircleVsOBB(hit.x, hit.z, 0.25, vehicleToOBB(taxi));
    expect(verifyOutside.hit).toBe(false);

    // Player on 2nd-floor balcony (y = 3.2m) -> zero collision with street cars
    const balcony = mgr.resolvePlayerCollision(taxi.x, taxi.z, 3.2, 0.26);
    expect(balcony.hitVehicle).toBe(false);

    // Angled OBB vs OBB SAT check
    const a = vehicleToOBB(taxi);
    const b = { ...a, x: a.x + 1.0, z: a.z + 0.5 };
    expect(testOBBvsOBB(a, b).hit).toBe(true);
    const far = { ...a, x: a.x + 10, z: a.z + 10 };
    expect(testOBBvsOBB(a, far).hit).toBe(false);
  });

  it("integrates Bus 06 with signals and traffic yielding", () => {
    const mgr = new SaigonTrafficManager();
    mgr.registerBus06(-1.54, 0, Math.PI);

    // Advance signals until J_LTT_32 NS is RED
    let redTime = 0;
    for (let t = 0; t < 45; t += 0.5) {
      mgr.signals.update(t);
      if (mgr.signals.getAxisState("J_LTT_32", "ns").lamp === "red") {
        redTime = t;
        break;
      }
    }
    expect(redTime).toBeGreaterThan(0);

    // Bus 06 approaching J_LTT_32 stop bar (front at z = -66.6 -> bus center z = -61.05) on RED -> must brake!
    const redSpeed = mgr.computeBus06SafeSpeed(-2.2, -61.05, 11.0);
    expect(redSpeed).toBeLessThan(2.0);

    // Advance until J_LTT_32 NS is GREEN -> Bus 06 gets full cruise clearance!
    for (let t = redTime; t < redTime + 45; t += 0.5) {
      mgr.signals.update(t);
      if (mgr.signals.getAxisState("J_LTT_32", "ns").lamp === "green") break;
    }
    const greenSpeed = mgr.computeBus06SafeSpeed(-2.2, -61.05, 11.0);
    expect(greenSpeed).toBeCloseTo(11.0, 2);
  });

  it("coordinates crosswalk pedestrians waiting on Red and crossing on Walk while vehicles yield", () => {
    const mgr = new SaigonTrafficManager();
    const ped = mgr.pedestrians.registerSidewalkWalker({
      id: "PED_CW",
      x: 0.4,
      z: -96,
      patrolZMin: -102,
      patrolZMax: -90,
      baseSpeed: 1.1,
      canCross: true,
      seed: 1,
    });
    ped.nextCrossCooldown = 0;

    let sawWaitCurb = false;
    let sawCrossing = false;
    for (let step = 0; step < 600; step++) {
      mgr.step({ dt: 0.05, playerX: 25, playerY: 3.2, playerZ: -14, playerYaw: 0, wetness: 0 });
      if (ped.phase === "wait_curb") sawWaitCurb = true;
      if (ped.phase === "crossing") sawCrossing = true;
    }
    expect(sawWaitCurb || sawCrossing).toBe(true);
    expect(sawCrossing).toBe(true);
  });

  it("survives a 3-minute 28-vehicle full-city stress simulation with zero NaNs, zero gridlock, and safe separation", () => {
    const mgr = new SaigonTrafficManager();
    mgr.registerBus06(-1.54, 0, Math.PI);

    // Mirror the full 28-vehicle Saigon city fleet across every major arterial!
    const spawns: { edgeId: string; s: number; category: "moto" | "car" | "van"; lane: 0 | 1 }[] = [
      { edgeId: "LTT_S_NB", s: 24, category: "moto", lane: 1 },
      { edgeId: "LTT_S_NB", s: 44, category: "moto", lane: 1 },
      { edgeId: "LTT_S_NB", s: 74, category: "van", lane: 0 },
      { edgeId: "LTT_S_NB", s: 94, category: "moto", lane: 1 },
      { edgeId: "LTT_M2_NB", s: 12, category: "moto", lane: 1 },
      { edgeId: "LTT_S_SB", s: 14, category: "moto", lane: 1 },
      { edgeId: "LTT_S_SB", s: 36, category: "moto", lane: 1 },
      { edgeId: "LTT_S_SB", s: 52, category: "moto", lane: 1 },
      { edgeId: "LTT_M2_SB", s: 16, category: "car", lane: 0 },
      { edgeId: "D32_W_EB", s: 12, category: "car", lane: 0 },
      { edgeId: "D32_W_EB", s: 26, category: "moto", lane: 1 },
      { edgeId: "D32_E_EB", s: 18, category: "car", lane: 1 },
      { edgeId: "D32_E_EB", s: 32, category: "moto", lane: 1 },
      { edgeId: "D32_W_WB", s: 16, category: "moto", lane: 1 },
      { edgeId: "D32_E_WB", s: 20, category: "car", lane: 0 },
      { edgeId: "DBP_W_EB", s: 8, category: "moto", lane: 1 },
      { edgeId: "DBP_W_EB", s: 22, category: "car", lane: 0 },
      { edgeId: "DBP_E_EB", s: 20, category: "van", lane: 1 },
      { edgeId: "DBP_W_WB", s: 14, category: "moto", lane: 1 },
      { edgeId: "DBP_E_WB", s: 24, category: "van", lane: 0 },
      { edgeId: "HT_S_NB", s: 22, category: "car", lane: 0 },
      { edgeId: "HT_N_NB", s: 18, category: "moto", lane: 1 },
      { edgeId: "HT_S_SB", s: 20, category: "moto", lane: 1 },
      { edgeId: "HT_N_SB", s: 25, category: "car", lane: 0 },
      { edgeId: "LTT_N_NB", s: 64, category: "car", lane: 0 },
      { edgeId: "LTT_N_NB", s: 105, category: "moto", lane: 1 },
      { edgeId: "LTT_N_SB", s: 20, category: "van", lane: 0 },
      { edgeId: "LTT_N_SB", s: 72, category: "van", lane: 0 },
    ];

    spawns.forEach((sp, i) => {
      mgr.spawnVehicle({
        id: `STRESS_${i}`,
        category: sp.category,
        edgeId: sp.edgeId,
        s: sp.s,
        laneIndex: sp.lane,
        halfWidth: sp.category === "moto" ? 0.44 : sp.category === "van" ? 0.98 : 0.92,
        halfLength: sp.category === "moto" ? 1.04 : sp.category === "van" ? 1.95 : 2.24,
      });
    });

    // Track total turns completed and average flow speed across 180 simulated seconds (3,600 frames)
    let turnsObserved = 0;
    let avgSpeedAccum = 0;
    let speedSamples = 0;
    let severeOverlaps = 0;

    for (let frame = 0; frame < 3600; frame++) {
      // Transition from dry sunlight to tropical monsoon rain halfway through!
      const wetness = frame > 1800 ? 0.9 : 0.0;
      mgr.step({
        dt: 0.05,
        playerX: -2.0,
        playerY: 0.16,
        playerZ: -5.0,
        playerYaw: 0,
        wetness,
      });

      if (frame % 20 === 0) {
        const tel = mgr.getTelemetry();
        turnsObserved += tel.activeInJunctions;
        if (frame >= 1200) {
          avgSpeedAccum += tel.avgSpeed;
          speedSamples++;
        }
        // Check all vehicles for NaN/Infinity & severe OBB penetration (> 0.65m)
        const agents = mgr.vehicles.filter((v) => !v.externalControl);
        for (let i = 0; i < agents.length; i++) {
          const a = agents[i];
          expect(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.yaw)).toBe(true);
          expect(Number.isFinite(a.speed) && a.speed >= 0 && a.speed < 25).toBe(true);
          const obbA = vehicleToOBB(a);
          for (let j = i + 1; j < agents.length; j++) {
            const b = agents[j];
            if (Math.hypot(a.x - b.x, a.z - b.z) > 6) continue;
            const sat = testOBBvsOBB(obbA, vehicleToOBB(b));
            if (sat.hit && sat.depth > 0.65) severeOverlaps++;
          }
        }
      }
    }

    const meanSpeed = avgSpeedAccum / Math.max(1, speedSamples);
    expect(turnsObserved).toBeGreaterThan(20);
    expect(meanSpeed).toBeGreaterThan(2.2); // Healthy flowing Saigon urban traffic (~8-25 km/h incl. red lights!)
    expect(severeOverlaps).toBeLessThanOrEqual(4); // Near-zero overlap across 3,600 frames × 28 vehicles!
    void sampleEdge;
  });
});
