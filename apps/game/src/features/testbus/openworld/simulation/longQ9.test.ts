import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SaigonRoadGraph } from "../traffic/roadGraph";
import {
  LONG_Q9_CLIPS,
  LONG_Q9_CROUCH_SECONDS,
  LONG_Q9_CURB_HEIGHT,
  LONG_Q9_DISMOUNT_SECONDS,
  LONG_Q9_FAREWELL_SECONDS,
  LONG_Q9_GREET_SECONDS,
  LONG_Q9_KICKSTAND_LEAN,
  LONG_Q9_LANE_V,
  LONG_Q9_MOUNT_SECONDS,
  LONG_Q9_PARK_SECONDS,
  LONG_Q9_PARK_V,
  LONG_Q9_PHASES,
  LONG_Q9_REPAIR_SECONDS,
  LONG_Q9_RIDE_OFF_MAX_WAIT_SECONDS,
  LONG_Q9_SITES,
  LONG_Q9_WALK_SPEED,
  createLongQ9State,
  longQ9CurbHeight,
  longQ9SitePoint,
  longQ9TakeoverWindow,
  longQ9WalkRoute,
  stepLongQ9,
  type LongQ9Frame,
  type LongQ9Phase,
  type LongQ9TrafficReading,
} from "./longQ9";

const DT = 1 / 30;

/** Runs the scripted fallback (no traffic manager) for `seconds` and returns every frame. */
function runScripted(seconds: number, siteIndex = 0) {
  const state = createLongQ9State(LONG_Q9_SITES, siteIndex);
  const frames: LongQ9Frame[] = [];
  for (let t = 0; t < seconds; t += DT) frames.push(stepLongQ9(state, DT, LONG_Q9_SITES));
  return { state, frames };
}

/** Drives the managed path: feeds a reading that moves along the site's edge at a steady speed. */
function runManaged(seconds: number) {
  const state = createLongQ9State(LONG_Q9_SITES, 0);
  let site = LONG_Q9_SITES[state.site];
  let s = 1;
  const frames: LongQ9Frame[] = [];
  for (let t = 0; t < seconds; t += DT) {
    site = LONG_Q9_SITES[state.site];
    let reading: LongQ9TrafficReading | null = null;
    if (state.phase === "cruise") {
      s = Math.min(site.edgeLength, s + 7 * DT);
      const p = longQ9SitePoint(site, s, 1.5);
      reading = { edgeId: site.edgeId, s, latOffset: 1.5, x: p.x, z: p.z, yaw: Math.atan2(site.dir.x, site.dir.z), speed: 7 };
    }
    const f = stepLongQ9(state, DT, LONG_Q9_SITES, reading);
    if (f.handback) s = f.handback.s;
    if (f.phase === "cruise" && f.handback) s = 0.5;
    frames.push(f);
  }
  return { state, frames };
}

function phaseOrder(frames: LongQ9Frame[]): LongQ9Phase[] {
  const out: LongQ9Phase[] = [];
  for (const f of frames) if (out[out.length - 1] !== f.phase) out.push(f.phase);
  return out;
}

function phaseSeconds(frames: LongQ9Frame[], phase: LongQ9Phase, nth = 0) {
  let run = -1;
  let count = 0;
  let prev: LongQ9Phase | null = null;
  for (const f of frames) {
    if (f.phase === phase && prev !== phase) run++;
    if (f.phase === phase && run === nth) count++;
    prev = f.phase;
  }
  return count * DT;
}

describe("Long Q9 rescue sites", () => {
  const graph = new SaigonRoadGraph();
  it("lie on real road edges with the stored origin, direction and length", () => {
    for (const site of LONG_Q9_SITES) {
      const edge = graph.edges.get(site.edgeId);
      expect(edge, site.edgeId).toBeDefined();
      expect(edge!.start.x).toBeCloseTo(site.origin.x, 5);
      expect(edge!.start.z).toBeCloseTo(site.origin.z, 5);
      expect(edge!.tx).toBeCloseTo(site.dir.x, 5);
      expect(edge!.tz).toBeCloseTo(site.dir.z, 5);
      expect(site.edgeLength).toBeLessThanOrEqual(edge!.length + 0.01);
      // The curb of these carriageways (road plane edge at z = -70 and z = -153) is 3 m to the right of the centre line.
      const curb = longQ9SitePoint(site, 10, 3);
      expect([-70, -153]).toContain(Math.round(curb.z * 10) / 10);
      expect(edge!.motoLatRange[1]).toBeGreaterThanOrEqual(LONG_Q9_LANE_V);
    }
  });
  it("keep every pavement point inside the sidewalk strips and the approach on the road", () => {
    // Sidewalk strips of the world (see isWalkableSidewalk): Đường 3/2 south, Điện Biên Phủ north.
    const onSidewalk = (x: number, z: number) =>
      (x >= 6.8 && x <= 128 && !(x > 50 && x < 62) && z >= -70 && z <= -65.6) ||
      (x >= 6.8 && x <= 132 && !(x > 50 && x < 62) && z >= -157.4 && z <= -153);
    const onRoad = (x: number, z: number) =>
      (x >= 8 && x <= 128 && z >= -82 && z <= -70) || (x >= 8 && x <= 132 && z >= -153 && z <= -141);
    for (let i = 0; i < LONG_Q9_SITES.length; i++) {
      const { frames } = runScripted(240, i);
      for (const f of frames) {
        const near = (p: { x: number; z: number }) => p;
        if (f.phase === "park" || f.phase === "dismount" || f.phase === "greet" || f.phase === "repair" || f.phase === "kickstand_up") {
          expect(onSidewalk(near(f.bike).x, f.bike.z), `${i} ${f.phase} bike`).toBe(true);
          expect(onSidewalk(f.person.x, f.person.z), `${i} ${f.phase} person`).toBe(true);
        }
        if (f.phase === "walk_to" || f.phase === "walk_back") expect(onSidewalk(f.person.x, f.person.z)).toBe(true);
        if (f.phase === "signal" || f.phase === "pull_over") expect(onRoad(f.bike.x, f.bike.z)).toBe(true);
      }
    }
  });
  it("keep the pavement route clear of trees and lamp posts", () => {
    // Trunks of the boulevard trees (x, z) and lamp posts that stand in the strips used by the sites.
    const trunks: [number, number, number][] = [];
    for (const x of [12, 18, 25, 32, 38, 44, 70, 77, 86, 95, 102, 110, 118, 125]) {
      trunks.push([x, -67.8, 0.32]);
      if (x % 2 === 0) trunks.push([x + 3.2, -154.0, 0.2]);
    }
    for (let i = 0; i < LONG_Q9_SITES.length; i++) {
      const site = LONG_Q9_SITES[i];
      const pts = [
        ...longQ9WalkRoute(site),
        { u: site.parkU, v: LONG_Q9_PARK_V },
        { u: site.strangerBikeU, v: LONG_Q9_PARK_V },
        { u: site.npcU, v: 5.3 },
      ];
      // Sample the polyline of the walk and check the body radius against each trunk.
      const route = longQ9WalkRoute(site);
      const samples: { x: number; z: number; r: number }[] = [];
      for (let k = 0; k + 1 < route.length; k++) {
        for (let f = 0; f <= 1; f += 0.05) {
          const p = longQ9SitePoint(site, route[k].u + (route[k + 1].u - route[k].u) * f, route[k].v + (route[k + 1].v - route[k].v) * f);
          samples.push({ ...p, r: 0.25 });
        }
      }
      for (const p of pts.slice(3)) samples.push({ ...longQ9SitePoint(site, p.u, p.v), r: 0.9 });
      for (const s of samples) for (const [tx, tz, tr] of trunks) expect(Math.hypot(s.x - tx, s.z - tz), `site ${i}`).toBeGreaterThan(s.r + tr - 0.05);
    }
  });
  it("leave the takeover window inside the edge and long enough to slow down", () => {
    for (const site of LONG_Q9_SITES) {
      const { sLo, sHi } = longQ9TakeoverWindow(site);
      expect(sHi).toBeGreaterThan(sLo);
      // He is handed back to traffic (parkU + 6) with at least 8 m of edge left before the junction.
      expect(site.edgeLength - (site.parkU + 6)).toBeGreaterThanOrEqual(8);
      // The window is wide enough that a rider at lane speed cannot cross it between two frames.
      expect(sHi - sLo).toBeGreaterThanOrEqual(3);
      expect(site.strangerBikeU).toBeLessThan(site.parkU - 5);
    }
  });
});

describe("Long Q9 rescue loop", () => {
  it("runs the phases in order and returns to cruise", () => {
    const { frames } = runScripted(200);
    const order = phaseOrder(frames);
    // First rescue, then the transit back into cruise.
    expect(order.slice(0, LONG_Q9_PHASES.length + 1)).toEqual([...LONG_Q9_PHASES, "cruise"]);
  });
  it("runs the same order against managed traffic and hands the bike back on the road", () => {
    const { frames } = runManaged(200);
    const order = phaseOrder(frames);
    // The managed rider is already inside the takeover window on the first frame.
    expect(order.slice(0, LONG_Q9_PHASES.length)).toEqual([...LONG_Q9_PHASES.slice(1), "cruise"]);
    const hand = frames.filter((f) => f.handback);
    expect(hand.length).toBeGreaterThan(0);
    const h = hand[0].handback!;
    expect(h.edgeId).toBe(LONG_Q9_SITES[0].edgeId);
    expect(h.latOffset).toBeCloseTo(LONG_Q9_LANE_V, 5);
    expect(h.speed).toBeGreaterThan(3);
    expect(longQ9CurbHeight(h.latOffset)).toBe(0);
    // Control is external for every phase but cruise.
    for (const f of frames) expect(f.external).toBe(f.phase !== "cruise");
  });
  it("keeps the timed phases at their durations", () => {
    const { frames } = runScripted(200);
    expect(phaseSeconds(frames, "park")).toBeCloseTo(LONG_Q9_PARK_SECONDS, 1);
    expect(phaseSeconds(frames, "dismount")).toBeCloseTo(LONG_Q9_DISMOUNT_SECONDS, 1);
    expect(phaseSeconds(frames, "greet")).toBeCloseTo(LONG_Q9_GREET_SECONDS, 1);
    expect(phaseSeconds(frames, "repair")).toBeCloseTo(LONG_Q9_REPAIR_SECONDS, 1);
    expect(phaseSeconds(frames, "farewell")).toBeCloseTo(LONG_Q9_FAREWELL_SECONDS, 1);
    expect(phaseSeconds(frames, "mount")).toBeCloseTo(LONG_Q9_MOUNT_SECONDS, 1);
    // The walk takes route length / speed.
    for (const phase of ["walk_to", "walk_back"] as const) {
      const route = longQ9WalkRoute(LONG_Q9_SITES[0]);
      let len = 0;
      for (let i = 0; i + 1 < route.length; i++) len += Math.hypot(route[i + 1].u - route[i].u, route[i + 1].v - route[i].v);
      expect(Math.abs(phaseSeconds(frames, phase) - len / LONG_Q9_WALK_SPEED)).toBeLessThan(0.5);
    }
  });
  it("is at curb height only between the climb and the ride off, and back on the road afterwards", () => {
    const { frames } = runScripted(200);
    const firstClimb = frames.findIndex((f) => f.phase === "climb_curb");
    const lastPark = frames.findIndex((f) => f.phase === "ride_off");
    for (const f of frames.slice(0, firstClimb)) expect(f.bike.y).toBe(0);
    const parked = frames.find((f) => f.phase === "repair")!;
    expect(parked.bike.y).toBeCloseTo(LONG_Q9_CURB_HEIGHT, 5);
    expect(parked.person.y).toBeCloseTo(LONG_Q9_CURB_HEIGHT, 5);
    const handbackIdx = frames.findIndex((f) => f.handback);
    expect(handbackIdx).toBeGreaterThan(lastPark);
    expect(frames[handbackIdx].bike.y).toBe(0);
    // The height never jumps by more than a few centimetres between two frames.
    for (let i = 1; i < frames.length; i++) {
      if (!frames[i].bikeVisible || !frames[i - 1].bikeVisible) continue;
      if (Math.abs(frames[i].bike.x - frames[i - 1].bike.x) > 1) continue;
      expect(Math.abs(frames[i].bike.y - frames[i - 1].bike.y)).toBeLessThan(0.02);
    }
  });
  it("puts the kickstand down while he works and up while he rides", () => {
    const { frames } = runScripted(200);
    for (const f of frames) {
      if (f.phase === "dismount" || f.phase === "walk_to" || f.phase === "greet" || f.phase === "repair" || f.phase === "farewell" || f.phase === "walk_back" || f.phase === "mount") {
        expect(f.kickstand).toBe(1);
        expect(f.lean).toBeCloseTo(LONG_Q9_KICKSTAND_LEAN, 5);
        expect(f.speed).toBe(0);
        expect(f.standingOnFoot).toBe(true);
      }
      if (f.phase === "signal" || f.phase === "pull_over" || f.phase === "climb_curb" || f.phase === "ride_off") expect(f.kickstand).toBe(0);
    }
    const down = frames.find((f) => f.phase === "park" && f.kickstand > 0.2 && f.kickstand < 0.8);
    expect(down).toBeDefined();
    const up = frames.find((f) => f.phase === "kickstand_up" && f.kickstand > 0.2 && f.kickstand < 0.8);
    expect(up).toBeDefined();
  });
  it("picks clips that match the phase", () => {
    const { frames } = runScripted(200);
    const clipsIn = (phase: LongQ9Phase) => new Set(frames.filter((f) => f.phase === phase).map((f) => f.clip));
    expect(clipsIn("walk_to")).toEqual(new Set(["Walk"]));
    expect(clipsIn("walk_back")).toEqual(new Set(["Walk"]));
    expect(clipsIn("greet")).toEqual(new Set(["Wave_Hand"]));
    expect(clipsIn("farewell")).toEqual(new Set(["Wave_Hand"]));
    expect(clipsIn("repair")).toEqual(new Set(["Crouch_Repair", "Kneel_Pump"]));
    const repair = frames.filter((f) => f.phase === "repair");
    expect(repair[0].clip).toBe("Crouch_Repair");
    expect(repair[repair.length - 1].clip).toBe("Kneel_Pump");
    expect(repair.findIndex((f) => f.clip === "Kneel_Pump") * DT).toBeCloseTo(LONG_Q9_CROUCH_SECONDS, 1);
    expect(clipsIn("park")).toEqual(new Set(["Greet_Seated"]));
    expect(clipsIn("signal")).toContain("Ride");
    for (const f of frames) {
      expect(LONG_Q9_CLIPS).toContain(f.clip);
      if (f.standingOnFoot && f.phase !== "dismount" && f.phase !== "mount") expect(f.clip).not.toMatch(/Ride|Greet_Seated/);
    }
  });
  it("signals right while pulling over, brakes while slowing and signals left riding off", () => {
    const { frames } = runScripted(200);
    for (const f of frames) {
      if (f.phase === "signal" || f.phase === "pull_over") expect(f.blinker).toBe(1);
      if (f.phase === "climb_curb" || f.phase === "repair") expect(f.blinker).toBe(0);
      if (f.phase === "ride_off") expect(f.blinker).toBe(-1);
    }
    expect(frames.some((f) => f.phase === "signal" && f.brake)).toBe(true);
    expect(frames.filter((f) => f.phase === "ride_off").every((f) => !f.brake)).toBe(true);
  });
  it("slows monotonically to a stop at the parking place and never drives backwards", () => {
    const { frames } = runScripted(60);
    const approach = frames.filter((f) => f.phase === "signal" || f.phase === "pull_over" || f.phase === "climb_curb");
    for (let i = 1; i < approach.length; i++) expect(approach[i].speed).toBeLessThanOrEqual(approach[i - 1].speed + 1e-6);
    const park = frames.find((f) => f.phase === "park")!;
    const site = LONG_Q9_SITES[0];
    const p = longQ9SitePoint(site, site.parkU, LONG_Q9_PARK_V);
    expect(park.speed).toBe(0);
    expect(Math.hypot(park.bike.x - p.x, park.bike.z - p.z)).toBeLessThan(0.05);
    // Pose in front of the sidewalk: the bike heads along the road when it stops.
    const heading = Math.atan2(site.dir.x, site.dir.z);
    let d = park.bike.yaw - heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    expect(Math.abs(d)).toBeLessThan(0.12);
  });
  it("is deterministic and cycles through at least two different sites", () => {
    const a = runScripted(400);
    const b = runScripted(400);
    expect(a.frames.map((f) => [f.phase, f.bike.x.toFixed(4), f.person.z.toFixed(4)])).toEqual(
      b.frames.map((f) => [f.phase, f.bike.x.toFixed(4), f.person.z.toFixed(4)]),
    );
    const sites = new Set(a.frames.map((f) => f.site));
    expect(sites.size).toBeGreaterThanOrEqual(2);
    // After the last site the loop starts again with the first one.
    const full = runScripted(3 * 120 + 120);
    const seq: number[] = [];
    for (const f of full.frames) if (f.phase === "park" && seq[seq.length - 1] !== f.site) seq.push(f.site);
    expect(seq.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });
  it("asks for a relocation only after a very long managed cruise, and still works when traffic never comes", () => {
    const state = createLongQ9State(LONG_Q9_SITES, 0);
    let frame = stepLongQ9(state, DT, LONG_Q9_SITES, null);
    expect(frame.relocate).toBe(false);
    state.t = 200;
    frame = stepLongQ9(state, DT, LONG_Q9_SITES, null);
    expect(frame.relocate).toBe(true);
    expect(frame.phase).toBe("cruise");
    expect(frame.external).toBe(false);
  });
  it("ignores a rider on another edge or past the window", () => {
    const state = createLongQ9State(LONG_Q9_SITES, 0);
    const site = LONG_Q9_SITES[0];
    const base = { latOffset: 1.5, x: 0, z: 0, yaw: 0, speed: 7 };
    expect(stepLongQ9(state, DT, LONG_Q9_SITES, { ...base, edgeId: "HT_N_NB", s: 5 }).phase).toBe("cruise");
    expect(stepLongQ9(state, DT, LONG_Q9_SITES, { ...base, edgeId: site.edgeId, s: site.parkU - 5 }).phase).toBe("cruise");
    expect(stepLongQ9(state, DT, LONG_Q9_SITES, { ...base, edgeId: site.edgeId, s: 3 }).phase).toBe("signal");
  });
  it("never moves the rider more than a walking step per frame while on foot", () => {
    const { frames } = runScripted(120);
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1];
      const b = frames[i];
      if (!a.standingOnFoot || !b.standingOnFoot) continue;
      expect(Math.hypot(a.person.x - b.person.x, a.person.z - b.person.z)).toBeLessThan(0.12);
    }
  });
});

describe("Long Q9 waits for the lane before riding off", () => {
  /** Runs a managed rescue until the stand is up, then keeps stepping with the given merge flag. */
  function untilStandUp(clear: boolean, extraSeconds: number) {
    const state = createLongQ9State(LONG_Q9_SITES, 0);
    const site = LONG_Q9_SITES[0];
    const p = longQ9SitePoint(site, 2, 1.5);
    const reading = { edgeId: site.edgeId, s: 2, latOffset: 1.5, x: p.x, z: p.z, yaw: Math.atan2(site.dir.x, site.dir.z), speed: 6 };
    let frame = stepLongQ9(state, DT, LONG_Q9_SITES, reading);
    for (let i = 0; i < 30 * 200 && state.phase !== "kickstand_up"; i++) frame = stepLongQ9(state, DT, LONG_Q9_SITES, null, clear);
    expect(state.phase).toBe("kickstand_up");
    const phases = new Set<string>();
    for (let t = 0; t < extraSeconds; t += DT) phases.add(stepLongQ9(state, DT, LONG_Q9_SITES, null, clear).phase);
    return { state, phases, frame };
  }
  it("stays parked with the stand up while a vehicle closes in, then goes after the wait limit", () => {
    expect(untilStandUp(false, 10).phases.has("ride_off")).toBe(false);
    expect(untilStandUp(false, LONG_Q9_RIDE_OFF_MAX_WAIT_SECONDS + 5).phases.has("ride_off")).toBe(true);
  });
  it("rides off right after the stand is up when the lane is clear", () => {
    expect(untilStandUp(true, 3).phases.has("ride_off")).toBe(true);
  });
});

describe("Long Q9 renderer wiring", () => {
  const src = readFileSync(resolve(__dirname, "../world/saigonDistricts.ts"), "utf8");
  it("places the bike in every phase when there is no traffic manager", () => {
    expect(src).toMatch(/if \(frame\.external \|\| !agent\) \{/);
  });
  it("passes the merge check to the routine and guards the stranger clips", () => {
    expect(src).toMatch(/stepLongQ9\(state, dt, LONG_Q9_SITES, reading, rideOffClear\)/);
    expect(src).toMatch(/streetClips\(cfg\.npc, npcGltf\.scene, npcGltf\.animations\)\.catch\(/);
  });
  it("only switches the parked bike solid on when the player is not standing in it", () => {
    expect(src).toMatch(/if \(!solidOn\) \{[\s\S]{0,200}> 1\.6 \* 1\.6/);
  });
});

describe("Long Q9 is the only Long Q9", () => {
  const src = readFileSync(resolve(__dirname, "../world/saigonDistricts.ts"), "utf8");
  it("is spawned behind a one-shot guard and listed in no NPC pool", () => {
    expect(src).toMatch(/if \(longQ9Spawned\) return;\s*longQ9Spawned = true;/);
    expect(src.match(/loadLongQ9Repair\(\)/g)?.length).toBe(1); // the single start
    const configs = src.slice(src.indexOf("const npcConfigs"), src.indexOf("let actorSeed"));
    expect(configs.toLowerCase()).not.toContain("longq9");
    expect(configs).not.toContain("nguoigia");
    for (const file of ["../world/boardingHouse.ts", "./storyNpcs.ts", "./humanRealism.ts"]) {
      expect(readFileSync(resolve(__dirname, file), "utf8").toLowerCase()).not.toContain("longq9.optimized");
    }
  });
});
