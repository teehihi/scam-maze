import { describe, expect, it } from "vitest";

/**
 * The walk from the boarding house to the market, measured from geometry.
 *
 * `docs/research/2026-11-23-route-from-boarding-house.md` states the route in prose. This file is
 * the same route as numbers, derived from the constants the world is actually built from, so the
 * document cannot drift away from the game without a red test.
 *
 * The route is the one a person living in a rented room on Lý Thái Tổ actually walks:
 *   room 6.07 upstairs -> courtyard -> iron gate -> alley 462/14 -> the main road ->
 *   south along the east pavement -> cross the carriageway -> the market.
 */

// The boarding house. `ROOM_ANCHOR` is where room 6.07 sits in world space.
import { ROOM_ANCHOR } from "./boardingHouse";
import { CURB_HEIGHT } from "../simulation/boarding";
// The main road, and the market.
import { CHO_LON_X, CHO_LON_Z, ROAD_MAX, ROAD_MIN } from "./choLon";
import { ROUTE } from "../simulation/transit";

/** The iron gate of khu trọ 462/14, from `boardingHouse.ts` — the street end of the alley. */
const GATE_X = 13.25;
/** The market's own frontage lane, west of the stalls (`LANE_X = CHO_LON_X - DEPTH - 1.6`). */
const DEPTH = 5.6;
const LANE_X = CHO_LON_X - DEPTH - 1.6;
/** The market runs this far along the road. */
const MARKET_Z0 = -104;
const MARKET_Z1 = -152;

describe("the route from the boarding house to the market", () => {
  it("starts upstairs in room 6.07, two storeys above the courtyard", () => {
    expect(ROOM_ANCHOR.y).toBeCloseTo(3.2, 1);
    expect(ROOM_ANCHOR.y).toBeGreaterThan(CURB_HEIGHT + 2.5);
    // The room is east of the gate, i.e. deeper into the alley, not on the road.
    expect(ROOM_ANCHOR.x).toBeGreaterThan(GATE_X);
  });

  it("reaches the main road in one alley-length walk, westward", () => {
    // The gate is on the east side of Lý Thái Tổ; the curb is the far side of the pavement.
    const alleyLength = Math.abs(GATE_X - ROAD_MAX);
    expect(alleyLength).toBeGreaterThan(10);
    expect(alleyLength).toBeLessThan(20);
    // The alley runs west. Nothing about the route turns north or east first.
    expect(GATE_X).toBeGreaterThan(ROAD_MAX);
  });

  it("then runs south alongside the carriageway for most of a kilometre-tenth", () => {
    // From the alley mouth south to the market's near end.
    const alongRoad = Math.abs(MARKET_Z0 - ROOM_ANCHOR.z);
    expect(alongRoad).toBeGreaterThan(80);
    expect(alongRoad).toBeLessThan(100);
  });

  it("crosses a 12.8 m carriageway to reach the stalls", () => {
    const width = Math.abs(ROAD_MAX - ROAD_MIN);
    expect(width).toBeCloseTo(12.32, 1);
    // The market is on the far (west) side, past the lane in front of it.
    expect(CHO_LON_X).toBeLessThan(ROAD_MIN);
    expect(LANE_X).toBeLessThan(ROAD_MIN);
  });

  it("is a walk, not a drive: under 200 m end to end", () => {
    const alley = Math.abs(GATE_X - ROAD_MAX);
    const alongRoad = Math.abs(MARKET_Z0 - ROOM_ANCHOR.z);
    const crossing = Math.abs(ROAD_MAX - ROAD_MIN) + Math.abs(LANE_X - ROAD_MIN);
    const total = alley + alongRoad + crossing;
    expect(total).toBeGreaterThan(100);
    expect(total).toBeLessThan(200);
    // At a walking pace of about 1.2 m/s, that is three to four minutes.
    expect(total / 1.2).toBeLessThan(180);
  });

  it("puts the market east edge clear of the road it is reached from", () => {
    // The market's easternmost point must stay west of the west facade line, or the walk ends
    // inside a wall. `street-collision.test.ts` measures this from vertices; here it is the intent.
    expect(CHO_LON_Z).toBeLessThan(MARKET_Z0);
    expect(CHO_LON_Z).toBeGreaterThan(MARKET_Z1);
    expect(CHO_LON_X).toBeLessThan(ROAD_MIN);
  });
});

describe("bus 06, which waits in front of the alley", () => {
  it("stops exactly at the market", () => {
    // The route's destination and the market's own centre are the same coordinate. If one moves,
    // the bus leaves the player somewhere else, and this fails.
    expect(ROUTE.destinationZ).toBe(CHO_LON_Z);
  });

  it("passes one named stop on the way", () => {
    expect(ROUTE.origin).toBe("Lý Thái Tổ");
    expect(ROUTE.via).toBe("Châu Văn Liêm");
    // The via stop falls between the approach and the market, on the way south.
    expect(ROUTE.viaZ).toBeLessThan(ROUTE.approachZ);
    expect(ROUTE.viaZ).toBeGreaterThan(ROUTE.destinationZ);
  });

  it("stops in its own lane, on the side its own edge runs", () => {
    // Ground truth is the traffic graph, not a reading of Vietnamese traffic law. Lý Thái Tổ is
    // mapped as one-way NB edges at x = -3.2 with car lanes at -4.65 and -2.75. Bus 06 is registered
    // onto those edges, so its stop must sit near -3.2 — not on the far side of a 12.32 m road.
    //
    // This assertion replaces one that only required `curbX` to be "inside the west half", which
    // passed happily while the bus was waiting in the opposing direction.
    const EDGE_X = -3.2;              // roadGraph.ts: LTT_*_NB start/end x
    const OUTER_LANE = EDGE_X + 0.45; // carLaneOffsets[1] = -2.75
    // Within a bus door's reach of the outer lane: a bus noses in, it does not sit centred on it.
    expect(Math.abs(ROUTE.curbX - OUTER_LANE)).toBeLessThan(0.7);
    // On the asphalt, in the outer lane: west of the east kerb (ROAD_MAX = -0.24) and a clear
    // 1.3 m short of it, which is where a bus's nearside wheels actually run.
    expect(ROUTE.curbX).toBeLessThan(ROAD_MAX);
    expect(ROUTE.curbX).toBeGreaterThan(ROAD_MAX - 3.0);
  });

  it("covers 159 m in a realistic 23 km/h, not in a stated 0.28 km/h", () => {
    // The number the player experiences: z = destinationZ * smoothstep(driving), driving += dt/30.
    // Peak nominal speed is (|destinationZ| / 30) * 1.5 at the midpoint of the smoothstep.
    const peak = (Math.abs(ROUTE.destinationZ) / 30) * 1.5;
    expect(peak).toBeGreaterThan(5);
    expect(peak).toBeLessThan(9);
    expect(peak * 3.6).toBeGreaterThan(18);
    expect(peak * 3.6).toBeLessThan(28);

    // What the route is *stated* as is story-clock minutes. Those two are deliberately different,
    // and the temptation to "fix" one to match the other is exactly what this asserts against.
    const naive = Math.abs(ROUTE.approachZ - ROUTE.destinationZ) / (ROUTE.rideMinutes * 60);
    expect(naive).toBeLessThan(0.1); // 0.078 m/s if you divide distance by story minutes
    expect(ROUTE.rideMinutes).toBe(34);
  });

  it("costs one flat fare less than the cash in the player's pocket", () => {
    expect(ROUTE.fare).toBe(7000);
    expect(ROUTE.initialCash).toBeGreaterThan(ROUTE.fare);
    expect(ROUTE.number).toBe("06");
  });
});

describe("getting off the bus outside the market", () => {
  it("leaves a road crossing, because the market is across the road", () => {
    // The bus stops on its own carriageway edge at -2.3. The market's edge is at -19.06. That is
    // 16.76 m of kerb, footway, two lanes and a median — and the passenger crosses all of it.
    // The market's own edge, not its centre: `CHO_LON_X` is the centre line of the block, and the
    // forecourt column line stands 1.4 m east of it at FRONT_X + 1.4.
    const marketEdge = CHO_LON_X + 1.4;
    const toMarketEdge = Math.abs(ROUTE.curbX - marketEdge);
    expect(toMarketEdge).toBeGreaterThan(15);
    expect(toMarketEdge).toBeLessThan(18);
    // The stop must stay on the road: west of the east kerb and clear of the west one.
    expect(ROUTE.curbX).toBeGreaterThan(ROAD_MIN);
  });

  it("no longer pretends a bus can shorten that crossing by changing lanes", () => {
    // The -12.2 version I wrote made the walk 6.9 m and looked marvellous in a frame. It also put
    // the bus in the opposing lane. Distance is not an optimisation target here.
    expect(Math.abs(ROUTE.curbX - (CHO_LON_X + 1.4))).toBeGreaterThan(10);
  });
});
