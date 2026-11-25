// CHỢ LỚN, QUẬN 5 — the market block at the end of Route 06.
//
// Why this file exists: `WorldStreamer.getZone` has returned `zone.choLonStop` / `district.d5` for
// the corridor at |z+128| < 18 since the bus was built, but no chunk ever built anything there. The
// bus arrived at z = -128, the doors opened, and the player stepped into a walkable corridor with
// nothing in it. Mission 02's entire destination is this block, so it had to be authored.
//
// What shaped it, and what the first renders got wrong (see §10 of the build plan):
//   - Chợ Lớn in the morning is read from above as an OVERLAPPING FIELD OF VENDOR CANOPIES over a
//     well of produce, with shophouse façades behind. The first version put a continuous tin roof
//     over the whole frontage and the canopies became invisible: a warehouse row, not a market. The
//     canopies are now the roof, at eye height above the stalls, in two overlapping rows.
//   - The district's institutions (temples, assembly halls) worked as dialect-group associations:
//     mutual support, commerce, reputation. That is why a shopkeeper keeping a stranger's receipts
//     is ordinary here. It is carried in writing, not in geometry (§10.5).
//   - The walkable corridor is x ∈ [-19.5, 7]. The first version put the frontage at x = -12.6 and
//     the stalls at x = -14.5, so the player would have walked a road and looked at a closed shop
//     across a pavement. The frontage now stands at x = -8.4 and the truck lane backs it.
//
// Deliberately NOT here: a temple set piece, interiors, animated vendors, a second district.
// Geometry conventions are copied from the neighbouring chunks: modular box/plane/rod composition,
// CURB_HEIGHT for anything on the pavement, `solids.push(rect(...))` for every volume the player
// must not walk through, and a streamer registration so the chunk streams like the rest.
import * as T from "three";
import { CURB_HEIGHT, rect, type Solid } from "../simulation/boarding";
import { box, contact, contactMaterial, label, material, plane, random, rod, tube } from "../simulation/scene-kit";
import {
  createCorrugatedTinPBR,
  createGranitePlazaPBR,
  createSaigonAsphaltPBR,
  createWorldFacadePBR,
} from "./pbrTextures";
import { buildRealisticPottedPlants, SaigonBotanicalBatch } from "./foliageAndProps";
import { hasProp, propSize, queueWorldProp } from "../../../khupho/world/streetFurniture";
import { createRealSaigonShophousePBR } from "./pbrTextures";
import { addVietnameseShophouseRelief } from "./gtaRealism";
import type { PooledLightSpec } from "./boardingHouse";
import type { WorldStreamer } from "./WorldStreamer";

/** Where the bus drops the player. Must match `ROUTE.destinationZ` in `simulation/transit.ts`. */
export const CHO_LON_Z = -128;
/**
 * The market frontage line, exported so district-level QA can frame the block without duplicating the
 * constant. If this moves, the placement frames move with it.
 */
export const CHO_LON_X = -20.6;
/**
 * The market's own carriageway is GONE.
 *
 * `simulation/street.ts` already draws Lý Thái Tổ at x -12.56..-0.24, 294 m of it, with kerbs,
 * shopfronts, cables and traffic on it. Round 26 did not know that and laid a second carriageway at
 * x -8.7..1.3 on top of the real one, then built a market on it: an audit found 53% of this chunk's
 * geometry standing over the real asphalt.
 *
 * So the block no longer owns a road. It owns the strip west of the street's own west apron and
 * faces the real street instead of a copy.
 *
 * THE FRONTAGE LINE IS -20.6, AND THAT NUMBER IS MEASURED. `survey462.ts:50` sets
 * `APRON_EDGE = 2.0` and `:61` draws the west apron from the shopfronts out to
 * `-SURVEY.width - APRON_EDGE = -14.8`. The market's stalls, shutters and counters all build from
 * FRONT_X toward +x, so at -19.4 the whole market grew 4.6 m into the street's own paving — 133
 * one-metre cells occupied by both, found by diffing two independent builds. At -20.6 the east edge
 * of the market lands at -15.0, clear of the apron at -14.8 by 0.2 m.
 */
export const ROAD_MIN = -12.56;
export const ROAD_MAX = -0.24;
/**
 * The east frontage line. The real carriageway ends at x = -0.24; the terrace row starts east of it.
 *
 * 3.4 is measured, not chosen. `addVietnameseShophouseRelief` builds its balconies and awning in a
 * local frame where +z is the street, then rotates; with facing "-x" the whole relief projects to
 * -x by about 2.9 m in world space. At 3.4 the deepest projection lands at x = 0.5, clear of the
 * asphalt edge at -0.24. At 1.9 it landed at -1.0, on the road, which an audit caught.
 */
export const FAR_FRONT_X = 3.4;
/** The market frontage line, at the west edge of the walkable strip. */
const FRONT_X = CHO_LON_X;
/** The real far pavement: east kerb to the east frontage line. */
/** The real east pavement runs from the kerb (x = -0.24) to the terrace frontage (x = 1.9). */
const FAR_MIN = ROAD_MAX;


/** Depth of the covered market, from the frontage back into the block. */
const DEPTH = 5.6;
/**
 * The truck/scooter access lane at the back of the market.
 *
 * This used to be -17.4, when the market faced east and its back was on the west. The block has
 * been turned around — it now faces east toward the real street and its back is on the west — so a
 * lane at -17.4 ran 48 m straight through `buildStreet`'s west shop row (x -18..-11), taking its
 * kerb, its parked wagon and its gutter with it. The lane belongs behind the market's own back wall.
 */
const LANE_X = FRONT_X - DEPTH - 1.6;
/** The block spans this z range: wide enough that the corridor reads as a place, not a pocket. */
const Z0 = -104;
const Z1 = -152;
/** Stall pitch along z: one bay per 3.05 m, the width of a real Chợ Lớn shophouse bay. */
const BAY = 3.05;
/** Service-alley cross-section. */
const ALLEY_Z = -132;
const ALLEY_W = 3.1;

/**
 * Canopy palette, sampled from photographs of the district's morning market and then corrected once
 * I had actually looked at them. The first pass used brown, navy, bottle green, mauve and sand — a
 * plausible-sounding list that made the market look like a festival. The photographs disagree: the
 * fabric over these stalls is almost colourless. Cold grey, dusty white, deep navy, slate blue, and
 * a green that has been in the sun too long. Ten thousand morning markets fade the same way, and a
 * market that has faded together reads as a place; one in five bright colours reads as a render.
 */
const CANOPY_COLORS = [
  // Ordered by how often they appear in the photographs: the dark ones carry the field, the pale
  // ones are what makes it read as fifty separate vendors rather than a tarpaulin.
  "#2b3a52",
  "#39424e",
  "#31463f",
  "#6f7378",
  "#b6b1a4",
] as const;

const frameMat = () => material(0x8d9298, 0.44, 0.62);
const plasticRed = () => material(0xa4322a, 0.62, 0.04);
const plasticBlue = () => material(0x2c4c72, 0.62, 0.04);

export interface ChoLonHandles {
  root: T.Group;
  solids: Solid[];
  lightSpecs: PooledLightSpec[];
  /**
   * Cô Ba's stall, described from the customer's side of the counter: `x, z` is where a person
   * stands to talk to her, and `yaw` is the facing toward her. The vendor's own position is
   * `x - 1.05` — derive it, do not duplicate it.
   *
   * The first version returned the vendor's spot and called it the stall, so the QA camera stood
   * inside the glass case and photographed the inside of the display. A handle that is ambiguous
   * about *whose* position it is will eventually be used by the wrong side.
   */
  cobaStall: { x: number; z: number; yaw: number };
  /**
   * The nail the bills hang on. Mission 02's W6 inspect verb is aimed here, and the receipt is the
   * proof object of the whole mission, so its address belongs to the geometry that built it.
   */
  receiptNail: { x: number; y: number; z: number };
  /** The two bus shelters: the Chợ Lớn stop the player arrives at, and Lý Thái Tổ where they left. */
  busStops: { x: number; z: number; yaw: number }[];
}

export function buildChoLon(
  root: T.Group,
  streamer: WorldStreamer,
  solids: Solid[],
  lightSpecs: PooledLightSpec[],
  seed = 5173,
  botanicals?: { batch: SaigonBotanicalBatch; potWind: { time: { value: number }; amp: { value: number } } },
): ChoLonHandles {
  const chunk = new T.Group();
  chunk.name = "ChoLonMarket";
  root.add(chunk);
  const lightSpecsLocal: PooledLightSpec[] = [];
  const rand = random(seed);
  const midZ = (Z0 + Z1) / 2;
  const spanZ = Z0 - Z1;

  // ---------------------------------------------------------------------------
  // GROUND — market floor, the customer strip, and the truck lane behind it
  //
  // Three different surfaces, because they are three different things: stained concrete under the
  // stalls, patched pavement where people stand, and a rutted asphalt lane where the trucks idle.
  // ---------------------------------------------------------------------------
  // These planes fill the lower half of every frame in the block, so they are the last place a flat
  // colour is acceptable. They use the same scanned Saigon surfaces as the neighbouring chunks.
  //
  // WHAT THIS USED TO BE, AND WHY IT WAS WRONG
  //
  // Before this chunk existed, nothing in the world covered x < 18 around z = -128: a cross-section
  // taken through the district at the market's own z found *zero* geometry between x = -40 and
  // x = +18. The "corridor" the bus drove through was a 58 m empty slot with the city only on one
  // side of it. The first version of this file put a market in that slot and called the result a
  // market by a road. It was a market in a vacant lot.
  //
  // So the street is built here: carriageway, kerbs, the pavement the market faces, the far pavement
  // the bus doors open onto, and the far shopfronts that were missing. Its width is not chosen — it
  // is derived from `ROUTE.curbX`, where the bus actually drives.
  const marketFloor = createGranitePlazaPBR(2, 17);
  marketFloor.color = new T.Color(0x8a857c); // washed concrete, not polished granite
  const pavement = createGranitePlazaPBR(2, 22);
  pavement.color = new T.Color(0x9d978c);
  const paved = createGranitePlazaPBR(2, 16);
  paved.color = new T.Color(0x87817a);

  const stretch = spanZ + 34; // the street runs past the market at both ends
  const mid = midZ;

  // THE GROUND THIS BLOCK NOW OWNS.
  //
  // There is no carriageway here and no kerb, because Lý Thái Tổ already has both and they are
  // 294 m long, drawn by `simulation/street.ts`, with traffic driving on them. This chunk owns one
  // strip: x -19.5..-12.6, the seven metres of ground between the real west kerb and the west edge
  // of the walkable world. An empty strip is not a market, so the strip gets a floor, a kerb of its
  // own along the real road, and stalls on it.

  // 1. The market's own paving, from the real kerb back to the boundary wall.
  //
  // DIRECTION MATTERS AND I HAD IT BACKWARDS. Everything this chunk builds — files, canopy rows,
  // shutters, Cô Ba's counter — extends from FRONT_X toward -x. The ground and the boundary wall
  // were written toward +x, so the paving sat in the road and the wall stood between the stalls and
  // the camera. The strip therefore runs from the back of the block (FRONT_X - DEPTH) to the real
  // kerb (ROAD_MIN - 0.22), and the wall belongs at the FRONT_X end.
  // The paving stops at the market's own frontage plus one metre of approach. It used to run all the
  // way to the real kerb at -12.78, which paved over `buildStreet`'s west shop row (x -18..-11) and
  // its apron. A block's ground is its own ground; the street's pavement is the street's business.
  const stripMinX = FRONT_X - DEPTH;   // the back of the block
  const stripMaxX = FRONT_X + 1.4;     // the approach strip, stopping short of the street's row
  const stripW = stripMaxX - stripMinX;
  const stripCx = (stripMinX + stripMaxX) / 2;
  plane(chunk, [stripCx, CURB_HEIGHT + 0.004, mid], [stripW, stretch], paved, 0, -Math.PI / 2);

  // 2. Market floor under the stalls, a shade darker and dirtier than the pavement.
  plane(chunk, [FRONT_X - DEPTH / 2, CURB_HEIGHT + 0.006, midZ], [DEPTH, spanZ], marketFloor, 0, -Math.PI / 2);

  // 3. Expansion joints across the strip every 9 m: poured concrete is poured in bays.
  const jointMat = material(0x6f6c64, 0.96, 0.02);
  for (let z = Z1 + 9; z < Z0 - 4; z += 9) {
    box(chunk, [stripCx, CURB_HEIGHT + 0.009, z], [stripW, 0.004, 0.05], jointMat, false);
  }

  // 4. A boundary wall at the back of the strip. The block needs a back to be a block; without it
  //    the market is a table standing in a field.
  const backWallX = stripMinX - 0.16;
  box(chunk, [backWallX, 1.35, midZ], [0.32, 2.7, spanZ + 6], createWorldFacadePBR("concrete_wall_007", "#a9a294", 2.4, 0.86, 0.95), false);
  solids.push(rect(backWallX, midZ, 0.32, spanZ + 6));

  // ---------------------------------------------------------------------------
  // 6a. WHY THERE IS NO PAVEMENT FURNITURE OF OURS ON THE ROAD'S WEST VERGE
  //
  // The 6.6 m between the market's paving (-19.2) and the road's west edge (-12.56) looked empty
  // from the bus door. It is not empty: it is the road's own west pavement, laid by `buildStreet` at
  // y 0.15-0.17 across x -17..-12, and it already carries 96 objects above knee height — trees, lamp
  // posts, sign poles — spread over the whole 48 m of the block. A 1 m occupancy sweep of it finds
  // 145 of 336 cells still free.
  //
  // Research on Vietnamese pavements says what should be in those cells: parked bikes, a shop's
  // overflow, a kitchen, low stools, a tea stall, an altar and a tree. The first version of this
  // block put all of it there. It was wrong for the same reason the second shop row was wrong: the
  // strip belongs to the street, the street already put its own furniture on it, and adding ours
  // stood a market's stock inside a road's pavement. `street-collision.test.ts` caught it as 104
  // shared 1 m cells.
  //
  // The market therefore stops at its own frontage. What the player walks past on the verge is the
  // street's furniture, which is real, is already placed, and is not ours to move. The vendor strip
  // — tables, stools, canopies, produce, and the real GLB bikes and stools — stays where the market
  // owns the ground, under the fabric, between -19.2 and -25.8.
  //
  // ---------------------------------------------------------------------------
  // 6b. THE MARKET'S OWN FRONTAGE — the thing you see from the road
  //
  // Removing the generic west infill across z -152..-104 (in `simulation/street.ts`) opened the
  // block face, but an open face is not a market. Bình Tây fronts Tháp Mười for 108.6 m with a gate
  // tower, a colonnade and its name over the entrance; a market that is simply a gap is a car park.
  //
  // This builds that frontage on the market's own ground at x -19.2: a colonnade of square columns,
  // a deep entrance bay at the middle where the vendor aisle starts, and a gooseneck sign over it
  // carrying the market's name. Everything sits inside the market's footprint, so nothing here can
  // land on the road or on the street's pavement.
  // ---------------------------------------------------------------------------
  const frontX = FRONT_X + 1.4;            // -19.2: the market's east edge
  // The gate does NOT go at the block's geometric middle. A density sweep of tree vertices along
  // the west pavement found z -136 almost clear (3 vertices in a 4 m band, against 1317 at -152),
  // and z -144 nearly clear too. Placing the tower where the street already has a gap in its canopy
  // means it is seen from the road on the first try, instead of being planted behind a plane tree
  // and argued about. The market's own entrance is also offset from its centre in the real one:
  // Bình Tây's main gate is on Tháp Mười, not at the middle of its 89.2 m frontage.
  const gateZ = Z1 + 16;                    // -136: a gap the trees already leave
  const colMat = createWorldFacadePBR("painted_plaster_wall", "#b8ac97", 2.2, 1.0, 0.9);
  const beamMat = createWorldFacadePBR("concrete_wall_007", "#a9a294", 2.4, 0.9, 0.94);

  // Side gates. Bình Tây has a main gate and twelve side ones, across a 2.5 ha footprint — one every
  // four metres of frontage if you copy the number. This market is 48 m by 7 m, seventy-four times
  // smaller, so the count is scaled rather than copied: two side gates, one near each end, at the
  // 1-in-17 m a real block of this length would have. Copying twelve here would give a gate every
  // 4 m on a 7 m deep block, which is a colonnade with holes in it, not a market.
  const SIDE_GATES = [Z1 + 7, Z0 - 9];

  // Colonnade: a square column every 3.05 m, standing 0.55 m inside the frontage so the columns read
  // as a portico rather than a fence. This is the one thing that says "public building" from across
  // a road.
  for (let z = Z1 + 2.0; z < Z0 - 1.0; z += 3.05) {
    // Leave the entrance bays clear: a market you cannot walk into is a wall.
    if (Math.abs(z - gateZ) < 2.6) continue;
    if (SIDE_GATES.some((g) => Math.abs(z - g) < 1.7)) continue;
    box(chunk, [frontX - 0.55, 2.1, z], [0.42, 4.2, 0.42], colMat, false);
    box(chunk, [frontX - 0.55, 4.32, z], [0.5, 0.24, 0.5], beamMat, false);
    solids.push(rect(frontX - 0.55, z, 0.42, 0.42));
  }
  // The beam the columns carry, running the length of the frontage.
  box(chunk, [frontX - 0.55, 4.48, midZ], [0.46, 0.34, spanZ - 1.6], beamMat, false);

  // ---------------------------------------------------------------------------
  // THE GATE TOWER
  //
  // The first frontage I built was a row of columns under a beam — a district market, not this one.
  // Bình Tây's main gate on Tháp Mười is a tower: 13.1 m to the top, three tiers of Guangdong roof
  // with upturned eaves, a clock face on each of its four sides, blue-and-white ceramic dragon
  // relief at its base, and "lưỡng long tranh châu" — two dragons fighting over a pearl — on the
  // ridge. Twelve gates in all; the rest are canopies with yin-yang red and green tiles.
  //
  // Everything below is inside the market's own footprint at x -19.2. The tower is 7 m across the
  // frontage and 13.1 m tall, which is the published height of the real one.
  // ---------------------------------------------------------------------------
  const TOWER_H = 13.1;

  // Two piers carrying the tower, 7 m apart, standing on the frontage line.
  for (const dz of [-3.5, 3.5]) {
    box(chunk, [frontX - 0.45, 2.6, gateZ + dz], [0.9, 5.2, 0.9], colMat, false);
    solids.push(rect(frontX - 0.45, gateZ + dz, 0.9, 0.9));
  }
  // The portal itself: an opening you walk through, not a wall you look at.
  box(chunk, [frontX - 0.45, 5.2, gateZ], [0.86, 0.6, 7.9], beamMat, false);

  // The two side gates: a narrower pier pair and a low lintel, no tower. A side gate in a real
  // market is a way in, not a monument, and giving them towers would fight the main one.
  for (const sz of SIDE_GATES) {
    for (const dz of [-1.45, 1.45]) {
      box(chunk, [frontX - 0.4, 1.5, sz + dz], [0.5, 3.0, 0.5], colMat, false);
      solids.push(rect(frontX - 0.4, sz + dz, 0.5, 0.5));
    }
    box(chunk, [frontX - 0.4, 3.1, sz], [0.54, 0.42, 3.4], beamMat, false);
    // A small enamel plate over each side gate: the same alphabet as the main sign, one character
    // and the Vietnamese, because a side entrance is still an entrance.
    const sideSign = label(384, 128, (ctx) => {
      ctx.fillStyle = "#6f1c14";
      ctx.fillRect(0, 0, 384, 128);
      ctx.strokeStyle = "#2a2622";
      ctx.lineWidth = 7;
      ctx.strokeRect(4, 4, 376, 120);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0dfba";
      ctx.font = "700 54px system-ui, sans-serif";
      ctx.fillText(sz < gateZ ? "南門" : "北門", 192, 60);
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillText(sz < gateZ ? "CỔNG NAM" : "CỔNG BẮC", 192, 100);
    });
    if (sideSign instanceof T.MeshStandardMaterial) {
      sideSign.emissiveMap = sideSign.map;
      sideSign.emissive = new T.Color(0xffdca8);
      sideSign.emissiveIntensity = 0.16;
      sideSign.roughness = 0.55;
      sideSign.metalness = 0.05;
    }
    plane(chunk, [frontX - 0.11, 3.62, sz], [3.0, 1.0], sideSign, Math.PI / 2);
  }

  // The tower body above the portal: 7 m across, 5 m deep into the market, carried up to the roof.
  // The tower body sits 2.5 m back from the frontage: a 5.0 m body centred at -21.7 spans
  // -24.2..-19.2, so its east face is flush with the market's edge at -19.2 and no part of a
  // 13.1 m tower hangs over the road's pavement. (The first version centred it at -17.6 and put
  // 2.8 m of tower on the street's ground; street-collision.test.ts caught it.)
  // Tall and slim: a gate tower's body is a shaft, not a block. 4.2 m across the frontage, 5.6 m
  // deep, carried from the portal lintel at 5.5 m to 10.6 m — 5.1 m of shaft under a roof stack that
  // only just overhangs it. The first version was 5.0 x 7.0 x 5.4 with roofs 7.6 wide, which is why
  // it read as a pavilion with a hat rather than a tower.
  box(chunk, [frontX - 2.5, 5.5 + 2.55, gateZ], [4.2, 5.1, 5.6], colMat);
  // A band of yellow ceramic tile across the body, which is the colour the market is known for.
  const tileBand = material(0xc9a23a, 0.7, 0.08);
  for (const yy of [6.4, 9.0]) {
    box(chunk, [frontX - 0.38, yy, gateZ], [0.06, 0.34, 5.64], tileBand, false);
  }

  // The dragon-and-pearl relief at the base, blue glazed ceramic on white: a flat panel with the
  // two dragons meeting over a disc, drawn rather than modelled, which is how it reads at 15 m.
  const relief = label(512, 200, (ctx) => {
    ctx.fillStyle = "#e8e4d8";
    ctx.fillRect(0, 0, 512, 200);
    ctx.strokeStyle = "#2f5f8f";
    ctx.fillStyle = "#2f5f8f";
    ctx.lineWidth = 9;
    // Two dragon bodies as curves, mirrored, meeting at the pearl.
    for (const mirror of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(256 + mirror * 210, 150);
      ctx.bezierCurveTo(256 + mirror * 150, 40, 256 + mirror * 70, 170, 256 + mirror * 26, 96);
      ctx.stroke();
      // head
      ctx.beginPath();
      ctx.ellipse(256 + mirror * 26, 96, 20, 13, mirror * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // the pearl
    ctx.beginPath();
    ctx.arc(256, 88, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 88, 11, 0, Math.PI * 2);
    ctx.fill();
    // a hint of the mosaic field the dragons swim in
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 90; i++) {
      const x = (i * 137) % 512, y = (i * 61) % 200;
      ctx.fillStyle = i % 2 ? "#6a9ac4" : "#c8d8e4";
      ctx.fillRect(x, y, 4, 4);
    }
    ctx.globalAlpha = 1;
  });
  if (relief instanceof T.MeshStandardMaterial) {
    relief.roughness = 0.42;
    relief.metalness = 0.12;
  }
  plane(chunk, [frontX - 0.42, 7.0, gateZ], [3.4, 2.0], relief, Math.PI / 2);

  // The clock: one face on each of the four sides, so the gate works from the road and from the
  // aisle. Drawn, not a sphere — a market clock is a painted dial in a square frame.
  const clockFace = label(256, 256, (ctx) => {
    ctx.fillStyle = "#f2ede0";
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = "#2a2622";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = i % 3 === 0 ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
      ctx.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
      ctx.stroke();
    }
    // 8:40, the hour the market is busiest.
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(-1.15) * 62, 128 + Math.sin(-1.15) * 62); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(0.9) * 86, 128 + Math.sin(0.9) * 86); ctx.stroke();
  });
  const clockY = 9.5;
  plane(chunk, [frontX - 0.42, clockY, gateZ], [1.55, 1.55], clockFace, Math.PI / 2);
  plane(chunk, [frontX - 4.58, clockY, gateZ], [1.55, 1.55], clockFace, -Math.PI / 2);
  plane(chunk, [frontX - 2.5, clockY, gateZ + 2.82], [1.55, 1.55], clockFace, 0);
  plane(chunk, [frontX - 2.5, clockY, gateZ - 2.82], [1.55, 1.55], clockFace, Math.PI);

  // Three tiers of Guangdong roof, each wider than the one below and each with upturned eaves.
  // The tile is the market's red, and the tier heights are what make the tower read as a pagoda
  // gate rather than a clock on a box.
  const roofTile = createWorldFacadePBR("terracotta_roof", "#8e2f22", 1.6, 0.9, 0.92);
  const eaveMat = material(0x5e1f16, 0.86, 0.02);
  // Roof tiers are centred on the body. The widest is 7.6 m across and its horns add ~1.0 m, so a
  // centre at -21.7 keeps the whole roof east edge at about -17.9... which would still overhang.
  // The lower two tiers are therefore held to 6.6 m, giving an east edge of -18.4 + horns, and the
  // top tier — the one that reads from across the road — stays full width.
  const tiers = [
    { y: 10.8, w: 5.4, d: 6.9 },
    { y: 11.8, w: 4.7, d: 6.2 },
    { y: TOWER_H - 0.55, w: 3.7, d: 5.0 },
  ];
  for (const [ti, t] of tiers.entries()) {
    // The slab.
    box(chunk, [frontX - 2.5, t.y, gateZ], [t.w, 0.34, t.d], roofTile, false);
    // Eaves: four corner horns, bent upward. This is the detail that says Guangdong.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const horn = new T.Mesh(new T.ConeGeometry(0.3, 1.5, 6), eaveMat);
      horn.position.set(frontX - 2.5 + sx * (t.w / 2 - 0.1), t.y + 0.5, gateZ + sz * (t.d / 2 - 0.1));
      horn.rotation.set(sz * 0.9, 0, -sx * 0.75);
      horn.scale.set(1, 1, 0.55);
      chunk.add(horn);
    }
    // Ridge tile along the two long sides.
    for (const sx of [-1, 1]) {
      box(chunk, [frontX - 2.5 + sx * (t.w / 2 - 0.16), t.y + 0.24, gateZ], [0.22, 0.3, t.d - 0.2], eaveMat, false);
    }
    if (ti < 2) continue;
    // The crowning ridge: "lưỡng long tranh châu" — two dragons curving up to a pearl.
    for (const sz of [-1, 1]) {
      const dragon = new T.Mesh(new T.TorusGeometry(0.62, 0.11, 5, 10, Math.PI * 0.92), eaveMat);
      dragon.position.set(frontX - 2.5 + sz * 0.75, t.y + 0.66, gateZ);
      dragon.rotation.set(Math.PI / 2, 0, sz * 0.6);
      chunk.add(dragon);
    }
    const pearl = new T.Mesh(
      new T.SphereGeometry(0.3, 10, 8),
      new T.MeshStandardMaterial({ color: 0xd8b652, roughness: 0.32, metalness: 0.5, emissive: new T.Color(0x6a4a10), emissiveIntensity: 0.25 }),
    );
    pearl.position.set(frontX - 2.5, t.y + 0.82, gateZ);
    chunk.add(pearl);
  }

  // Name over the gate, in the same weather-beaten enamel as the shop signs: CHỢ LỚN, and the
  // Chinese name with it, because this is Chợ Lớn and not a shopping centre.
  const gateSign = label(1024, 256, (ctx) => {
    ctx.fillStyle = "#7d1f16";
    ctx.fillRect(0, 0, 1024, 256);
    const gr = ctx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "rgba(14,12,10,0.34)");
    gr.addColorStop(0.3, "rgba(255,255,255,0.05)");
    gr.addColorStop(1, "rgba(10,9,7,0.42)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#2a2622";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 1012, 244);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f3e3c0";
    ctx.shadowColor = "#ffd79a";
    ctx.shadowBlur = 10;
    ctx.font = "800 96px system-ui, sans-serif";
    ctx.fillText("堤岸 CHỢ LỚN", 512, 122);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.font = "600 44px system-ui, sans-serif";
    ctx.fillText("CHỢ LỚN · BÌNH TÂY", 512, 196);
    ctx.globalAlpha = 1;
  });
  if (gateSign instanceof T.MeshStandardMaterial) {
    gateSign.emissiveMap = gateSign.map;
    gateSign.emissive = new T.Color(0xffdca8);
    gateSign.emissiveIntensity = 0.22;
    gateSign.roughness = 0.52;
    gateSign.metalness = 0.06;
  }
  plane(chunk, [frontX + 0.02, 5.85, gateZ], [5.4, 1.35], gateSign, Math.PI / 2);
  box(chunk, [frontX - 0.08, 5.85, gateZ], [0.1, 1.5, 5.5], material(0x2a2622, 0.6, 0.35), false);

  // 6c. NO SECOND TERRACE ROW.
  //
  // Round 27 added fourteen tube houses on the east side of this street. `simulation/street.ts`
  // already builds the east side of Lý Thái Tổ — shopfronts at x ~0.9..4.85 with balconies, awnings
  // and AC condensers, 294 m of them — so the fourteen were a second row standing in the first row's
  // pavement. Deleted. The street's own frontage is the far side of this block, which is what a
  // market on the west verge of a real street actually faces.

  // 6c. THE FAR PAVEMENT IS NOT EMPTY.
  //
  // The first cut of this street left 5.7 m of bare grey slab between the kerb and the new shopfronts.
  // A Saigon pavement of that width is never bare: it is a row of trees in cut-outs, potted plants
  // outside every door, and whatever the household could not fit indoors. This is also the cheapest
  // fix for "every house looks the same" that does not touch the houses at all — a staggered row of
  // trunks breaks the repetition of fourteen identical bay widths in front of the eye.
  if (botanicals) {
    const { batch, potWind } = botanicals;
    const pitMat = material(0x54504a, 0.95, 0.03);
    for (let i = 0; i < 7; i++) {
      const tz = Z0 + 5.4 - i * 8.9;
      const tx = FRONT_X + 0.85 + (i % 2) * 0.22;
      // Kerbed tree pit: a sunken concrete collar, not a painted square on the slab.
      box(chunk, [tx, 0.078, tz], [1.3, 0.155, 1.3], pitMat, false);
      batch.addShadeTree(tx, 0.0, tz, 0.92 + (i % 4) * 0.06);
      solids.push(rect(tx, tz, 0.42, 0.42));
    }
    // Potted plants crowding the shopfront doors: two per bay, at the plinth line.
    const pots: { pos: [number, number, number]; scale?: number; hasFlowers?: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const fz = Z0 + 8 - i * 4.6;
      pots.push({ pos: [FRONT_X + 0.5, 0.16, fz - 1.62], scale: 0.85 + ((i * 7) % 5) * 0.09, hasFlowers: i % 4 === 0 });
      if (i % 2 === 0) {
        pots.push({ pos: [FRONT_X + 0.5, 0.16, fz + 1.55], scale: 0.78 + ((i * 3) % 5) * 0.1, hasFlowers: i % 6 === 0 });
      }
    }
    buildRealisticPottedPlants(chunk, pots, potWind);
  }

  // 7. The service lane at the back, and the strip of waste ground between it and the market.
  const kerb = createWorldFacadePBR("concrete_wall_007", "#8e8a82", 1.6, 0.8, 0.94);
  const laneSurf = createSaigonAsphaltPBR(1, 20);
  plane(chunk, [LANE_X, 0.018, midZ], [2.8, spanZ], laneSurf, 0, -Math.PI / 2);
  box(chunk, [LANE_X + 1.55, CURB_HEIGHT / 2, midZ], [0.22, CURB_HEIGHT, spanZ + 26], kerb, false);
  const gutter = createSaigonAsphaltPBR(1, 20);
  plane(chunk, [(LANE_X + 1.4 + FRONT_X - DEPTH) / 2, 0.016, midZ], [2.4, spanZ], gutter, 0, -Math.PI / 2);
  // ...and it has to keep going past the block, or the lane dead-ends in mid-air.
  plane(chunk, [LANE_X, 0.018, mid], [2.8, stretch], laneSurf, 0, -Math.PI / 2);
  plane(chunk, [-21.6, 0.008, mid], [6.2, stretch], laneSurf, 0, -Math.PI / 2);

  // Expansion joints across the market floor: the single cheapest thing that stops a big flat plane
  // looking like a void.
  const joint = material(0x453f38, 0.98, 0.01);
  for (let z = Z1 + 4; z < Z0; z += 4.2) {
    box(chunk, [FRONT_X - DEPTH / 2, 0.006, z], [DEPTH, 0.006, 0.05], joint, false);
  }
  // Standing water: this floor is washed down every morning and never fully dries.
  const wet = new T.MeshStandardMaterial({ color: 0x3d4a4e, roughness: 0.12, metalness: 0.1 });
  for (let i = 0; i < 9; i++) {
    const wx = FRONT_X - 0.6 - rand() * (DEPTH - 1.2);
    const wz = Z1 + 3 + rand() * (spanZ - 6);
    plane(chunk, [wx, 0.024, wz], [0.7 + rand() * 1.1, 0.4 + rand() * 0.8], wet, rand() * Math.PI, -Math.PI / 2);
  }
  // Painted bay lines on the pavement, faded to almost nothing — municipal paint, twenty years old.
  const paint = material(0x9c9a86, 0.95, 0.01);
  for (let z = Z1 + 6; z < Z0; z += 6.1) {
    box(chunk, [FRONT_X + 0.7, 0.026, z], [1.4, 0.005, 0.09], paint, false);
  }

  // ---------------------------------------------------------------------------
  // THE SHOPHOUSE WALL BEHIND THE STALLS
  //
  // One continuous volume: from the street you never see its far side, and a long shophouse terrace
  // is exactly how Chợ Lớn reads at eye level. Braked with pilasters and a parapet so it does not
  // read as a hangar.
  // ---------------------------------------------------------------------------
  // The terrace wall used to be a single FlatColor 0xb0a696 over 48 m, which is 48 m of nothing.
  // `createWorldFacadePBR` projects UVs from world space, so one tile covers a fixed ~3.4 m of wall
  // however long the box is — the same function, and the same weathering shader, as the D1 frontages.
  const stuccoWarm = createWorldFacadePBR("clay_plaster", "#d3c0a4", 3.4, 0.9, 0.88);
  const backX = FRONT_X - DEPTH + 0.42;

  // ---------------------------------------------------------------------------
  // THE TERRACE BEHIND THE STALLS — individual tube houses, not one wall
  //
  // This used to be a single `box`: 0.92 m x 7.6 m x 48 m, one material, one silhouette end to end.
  // However good the texture, a 48 m unbroken volume is a warehouse. A Chợ Lớn street is a *terrace
  // of separate shophouses*: Saigoneer's survey of the district describes the two-storey type — shop
  // and storage at street level, living above — as the commonest shophouse in Saigon-Chợ Lớn, and
  // the three-storey clusters that followed as merchants grew richer. So 7.6 m is right for the
  // commonest house; what was wrong was that all 15 houses were the same object.
  //
  // Every plot now gets: its own party wall (masonry between neighbours, which is how a terrace is
  // actually built), its own height and tint, a photographed Saigon shopfront on the street face,
  // the 3D relief that `addVietnameseShophouseRelief` already provides (moisture plinth, parapet,
  // slanted awning, cantilevered balcony, AC condenser), the ROTATING shop signs and paper lanterns
  // of a Chinese-Vietnamese frontage, burglar bars, and a stainless roof tank.
  //
  // Width and height stay inside the measurements the research gives: 3.05 m plots are at the
  // narrow end of the 2.5-5 m range, which is exactly what Chợ Lớn is.
  // ---------------------------------------------------------------------------
  // Shop interiors and upper windows. A shophouse interior at 08:40 is dim but never black: a
  // fluorescent tube over a counter, spill from the street. Pure black put the mission's receipt
  // string against nothing and made the prop unreadable.
  const recessMat = new T.MeshStandardMaterial({
    color: 0x2b2418,
    emissive: new T.Color(0xffd9a0),
    emissiveIntensity: 0.62,
    roughness: 0.88,
    metalness: 0.02,
  });
  const windowMat = new T.MeshStandardMaterial({
    color: 0x2a2b28,
    emissive: new T.Color(0xffe0b0),
    emissiveIntensity: 0.06,
    roughness: 0.36,
    metalness: 0.2,
  });
  const litWindow = new T.MeshStandardMaterial({
    color: 0x2a2b28,
    emissive: new T.Color(0xffd79a),
    emissiveIntensity: 0.42,
    roughness: 0.36,
    metalness: 0.2,
  });
  /**
   * A Chợ Lớn shop sign.
   *
   * Every frontage in this district carries its name in Chinese characters with the Vietnamese
   * trading name underneath — that bilingual pairing is the single most recognisable thing about the
   * street, and the market had no lettering at all. Drawn the same way `neonSignMat` in
   * `saigonDistricts.ts` draws the district's signs: sun-faded acrylic, a dark bezel, a glow line,
   * so these belong to the same city.
   */
  const choLonSign = (han: string, viet: string, bg: string) =>
    label(512, 160, (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 160);
      const gr = ctx.createLinearGradient(0, 0, 0, 160);
      gr.addColorStop(0, "rgba(16,14,12,0.42)");
      gr.addColorStop(0.2, "rgba(255,255,255,0.06)");
      gr.addColorStop(0.8, "rgba(0,0,0,0.1)");
      gr.addColorStop(1, "rgba(10,9,7,0.5)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = "#2a2622";
      ctx.lineWidth = 9;
      ctx.strokeRect(5, 5, 502, 150);
      ctx.fillStyle = "#f6e7c4";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ffd79a";
      ctx.shadowBlur = 7;
      ctx.font = "700 62px system-ui, sans-serif";
      ctx.fillText(han, 256, 78);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.9;
      ctx.font = "600 26px system-ui, sans-serif";
      ctx.fillText(viet, 256, 128);
      ctx.globalAlpha = 1;
    });

  const PLOT = BAY;
  const plotCount = Math.round(spanZ / PLOT);
  // Photographed shopfronts: shop3 is the two-storey terrace type, shop5 the taller merchant house.
  // Tinting each instance differently keeps fifteen plots off the same two photographs.
  const shopFronts = [
    createRealSaigonShophousePBR(3, "#efe9df", 1),
    createRealSaigonShophousePBR(3, "#e2dccf", 1),
    createRealSaigonShophousePBR(5, "#e8e3da", 1),
    createRealSaigonShophousePBR(3, "#dde4dc", 1),
    createRealSaigonShophousePBR(3, "#e9dcc9", 1),
  ];
  // A Chợ Lớn frontage is Chinese-Vietnamese: shop names are in Chinese characters over Vietnamese.
  const CHINESE_SIGNS: [string, string, string][] = [
    ["金邊", "TẠP HÓA KIM BIÊN", "#8f1d16"],
    ["福興", "ĐỒ KHÔ PHÚC HƯNG", "#123f6b"],
    ["廣東", "THUỐC BẮC QUẢNG ĐÔNG", "#1d5133"],
    ["同慶", "TRÀ THƠM ĐỒNG KHÁNH", "#6b1414"],
    ["永發", "VẢI SỢI VĨNH PHÁT", "#3d2464"],
    ["大華", "KIM HOÀN ĐẠI HOA", "#7a3d0a"],
  ];

  for (let p = 0; p < plotCount; p++) {
    const z = Z1 + PLOT * (p + 0.5);
    // Height: the commonest two-storey terrace, with the occasional three-storey merchant house.
    // 7.6 m is two storeys at Vietnamese floor-to-floor; the taller plots are the 1890s clusters.
    const tall = p % 5 === 2;
    const h = tall ? 10.4 + rand() * 0.9 : 7.3 + rand() * 0.8;
    const front = shopFronts[p % shopFronts.length];
    const partyWall = createWorldFacadePBR("painted_plaster_wall", p % 3 === 0 ? "#c4b7a2" : "#cfc4b1", 3.4, 1.0, 0.9);

    // Party walls both sides: 0.2 m of masonry per plot, which is what separates two houses and is
    // the thing a single box cannot show. Slightly proud of the facade, as a real party wall is.
    for (const side of [-1, 1]) {
      const wz = z + side * PLOT * 0.5;
      box(chunk, [backX, h * 0.5, wz], [1.02, h, 0.2], partyWall, false);
    }

    // The plot volume itself, pulled back so the party wall stands proud.
    box(chunk, [backX + 0.03, h * 0.5, z], [0.8, h, PLOT - 0.22], partyWall, false);

    // The photographed shopfront on the street-facing (+x) face: shop at ground level, living above.
    // `plane` in this file faces +z by default; rotate it to face +x, toward the market.
    plane(chunk, [backX + 0.45, h * 0.5, z], [PLOT - 0.26, h * 0.96], front, Math.PI / 2);

    // Ground-floor recess behind the stalls: the shop interior, warm and dim, not a void. The
    // fluorescent strip over the counter is what the player actually sees between the canopies.
    plane(chunk, [backX + 0.48, 1.4, z], [2.4, 2.4], recessMat, Math.PI / 2);

    // First-floor window with burglar bars, two per plot at different heights so the terrace does
    // not read as a grid.
    const lit = (p * 3) % 7 === 2;
    plane(chunk, [backX + 0.47, tall ? 5.4 : 4.5, z], [1.15, 1.45], lit ? litWindow : windowMat, Math.PI / 2);
    for (let b = 0; b < 4; b++) {
      box(chunk, [backX + 0.44, (tall ? 4.72 : 3.82) + b * 0.42, z], [0.03, 0.03, 1.2], frameMat(), false);
    }

    // The 3D relief that is already shipped and that this terrace never used: moisture plinth at
    // the base, parapet coping on top, slanted awning, cantilevered balcony with railing, and the
    // wall-mounted AC condenser. `facing: "+x"` points it at the market.
    addVietnameseShophouseRelief(chunk, backX + 0.4, z, 0.82, h, PLOT - 0.2, "+x", p + 7, true);

    // Rotating shop sign: a light box over the awning, Chinese characters over the Vietnamese name.
    // This is the single most Chợ Lớn thing on the street and the terrace had none.
    const [han, viet, signColor] = CHINESE_SIGNS[p % CHINESE_SIGNS.length];
    const signY = tall ? 4.0 : 3.35;
    const signMat = choLonSign(han, viet, signColor);
    if (signMat instanceof T.MeshStandardMaterial) {
      signMat.emissiveMap = signMat.map;
      signMat.emissive = new T.Color(0xffdca8);
      signMat.emissiveIntensity = 0.3 + (p % 4) * 0.07;
      signMat.roughness = 0.5;
      signMat.metalness = 0.08;
    }
    // The box hangs proud of the awning, facing +x down the market: a plane, not a slab, so the
    // lettering is legible instead of buried inside a box's dark side.
    plane(chunk, [backX + 0.86, signY, z], [PLOT - 0.45, (PLOT - 0.45) * 0.3125], signMat, Math.PI / 2);
    box(chunk, [backX + 0.8, signY, z], [0.08, 0.66, PLOT - 0.4], material(0x2a2622, 0.6, 0.35), false);

    // A paper lantern over some plots: red, dusty, hanging from the awning bracket.
    if (p % 3 !== 1) {
      const lantern = new T.Mesh(
        new T.SphereGeometry(0.19, 10, 8),
        new T.MeshStandardMaterial({
          color: 0xb8281c,
          emissive: new T.Color(0xd8402c),
          emissiveIntensity: 0.28,
          roughness: 0.78,
          metalness: 0.02,
        }),
      );
      lantern.scale.y = 1.18;
      lantern.position.set(backX + 0.82, signY - 0.62, z + (p % 2 === 0 ? 0.5 : -0.5));
      chunk.add(lantern);
      rod(chunk, [backX + 0.82, signY - 0.42, lantern.position.z], [backX + 0.82, signY - 0.12, lantern.position.z], 0.008, frameMat(), 0.006, 4);
    }

    // Stainless roof tank on steel legs, the one thing on every Saigon roof.
    if (p % 2 === 0) {
      const tank = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.95, 12), material(0xc8ccce, 0.34, 0.72));
      tank.rotation.z = Math.PI / 2;
      tank.position.set(backX + 0.1, h + 0.62, z + (p % 4 === 0 ? 0.5 : -0.4));
      chunk.add(tank);
    }
  }
  solids.push(rect(backX, midZ, 1.04, spanZ));

  // ---------------------------------------------------------------------------
  // THE CANOPY FIELD — the district's roof (§1b.6)
  //
  // 26 canopies in two overlapping rows at 2.6–3.0 m, which is the height a vendor's frame actually
  // reaches and low enough that the player walks *under* the market rather than past it. The first
  // render failed here: 14 canopies at 3.4 m under a continuous tin roof read as awnings on a
  // warehouse. Fabric is now the only roof over the stalls.
  // ---------------------------------------------------------------------------
  // A canopy lane, not a row of parasols. Three staggered files over the walkway, a canopy every
  // ~1.6 m of frontage, 2.15–2.45 m up: low enough that the player walks *under* the market, dense
  // enough that the fabric reads as a ceiling from the street. This is the one thing the reference
  // photographs are unambiguous about, and the first version got it wrong twice — once with a tin
  // roof over everything, once with canopies too few and too high.
  // Four files, and every one of them is OUTSIDE the frontage line.
  //
  // The third version put the "mid-walkway" and "over the kerb" files at FRONT_X - 3.15 and -5.05,
  // which is *behind* the shopfronts, between the stalls and the back wall. The aerial frame showed
  // it immediately: a strip of fabric over the produce and 12 m of open pavement where the player
  // actually walks. The brief is "approaches her by walking under fabric", so the field has to hang
  // over the customer strip — from just inside the stall edge out to the kerb.
  const canopyCount = 56;
  for (let i = 0; i < canopyCount; i++) {
    const file = i % 4;
    const k = Math.floor(i / 4);
    const z = Z1 + 1.4 + (k / 13) * (spanZ - 2.8) + (rand() - 0.5) * 0.4;
    // The files run from just inside the stall edge out over the customer strip.
    //
    // They used to reach FRONT_X + 3.5 = -17.1, and with a 2.4-3.0 m radius that put the fabric
    // canopy over `buildStreet`'s west shop row at x -18..-11: 105 one-metre cells where the market
    // sat inside the street's structure above 2.6 m. The field stops at +1.9 now, so the widest
    // canopy edge lands at -16.0, clear of the row.
    // A canopy's EDGE is what collides, not its centre, so the centre range plus the largest radius
    // must stay west of -17.74. Centre max +0.1 with radius 1.7 puts the hem at -18.8.
    const x = FRONT_X + (file === 0 ? -1.1 : file === 1 ? -0.6 : file === 2 ? -0.25 : 0.1) - rand() * 0.15;
    const size = 1.45 + rand() * 0.25;
    const yaw = (rand() - 0.5) * 0.55;
    const tilt = (rand() - 0.5) * 0.15;
    const y = 2.16 + rand() * 0.3 + (file === 2 ? 0.12 : 0);
    const cloth = new T.MeshStandardMaterial({
      color: CANOPY_COLORS[i % CANOPY_COLORS.length],
      roughness: 0.9,
      metalness: 0.02,
      side: T.DoubleSide,
    });
    const canopy = new T.Mesh(new T.ConeGeometry(size, 0.62, 4, 1, true), cloth);
    canopy.position.set(x, y, z);
    canopy.rotation.set(tilt, yaw + Math.PI / 4, tilt * 0.6);
    canopy.castShadow = true;
    chunk.add(canopy);
    // The hem: a darker rim band, which is what makes overlapping canopies read as separate objects
    // rather than one continuous tent.
    const rim = new T.Mesh(new T.TorusGeometry(size * 0.708, 0.032, 4, 4), material(0x2c2924, 0.86, 0.05));
    rim.position.copy(canopy.position);
    rim.rotation.set(Math.PI / 2 + tilt, yaw, 0);
    chunk.add(rim);
    // Stems only on the files that stand on the ground: the stall file hangs from the eave purlins,
    // which is how a market vendor actually rigs a canopy.
    if (file > 0) {
      rod(chunk, [x - tilt * 1.2, CURB_HEIGHT, z], [x, y - 0.36, z], 0.032, frameMat(), 0.027, 6);
    } else {
      rod(chunk, [x, y + 0.9, z], [x, y - 0.36, z], 0.022, frameMat(), 0.02, 5);
    }
  }

  // The eave over the back wall — in two runs with a gap between them.
  //
  // Bình Tây keeps its interior lit by the space between two roofs: a slot along the ridge that
  // lets daylight and moving air down into the hall, which is why the real market is bearable at
  // midday without air conditioning. The courtyard that does the same job in the middle of the real
  // building is 2 500 m² — seven times this entire market, so it cannot be copied here.
  //
  // The gap can. The eave runs in two lengths with a 1.4 m slot over the produce aisle at z -128,
  // and the slot is the brightest thing under the fabric: a shaft of 11:00 light landing on the
  // wet floor, which is the one interior effect a market of this size actually has.
  const tin = createCorrugatedTinPBR("#7d8b93", "#6b442b", 2, 1);
  const slotZ = midZ;
  const slotHalf = 0.7;
  const runs: [number, number][] = [
    [Z1 - 0.15, slotZ - slotHalf],
    [slotZ + slotHalf, Z0 + 0.15],
  ];
  for (const [z0, z1] of runs) {
    const len = z1 - z0;
    if (len < 0.6) continue;
    const cz = (z0 + z1) / 2;
    const eave = box(chunk, [backX + 0.95, 3.32, cz], [2.5, 0.08, len], tin, false);
    eave.rotation.z = 0.085;
    for (let z = z0 + 1.2; z < z1; z += 3.2) {
      box(chunk, [backX + 0.95, 3.18, z], [2.6, 0.1, 0.12], material(0x4a4f52, 0.62, 0.5), false);
    }
  }
  // The light the slot lets in: a soft cone from the opening down to the floor, additive so it
  // reads as daylight on wet concrete rather than a painted stripe.
  const shaft = new T.Mesh(
    new T.CylinderGeometry(0.55, 1.5, 3.2, 12, 1, true),
    new T.MeshBasicMaterial({
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.11,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  shaft.position.set(backX + 1.6, 1.9, slotZ);
  chunk.add(shaft);

  // ---------------------------------------------------------------------------
  // STALLS — a line of tables under the fabric, not an open hall.
  //
  // Each bay: a trestle table at 0.78 m (the height a vendor works at), produce crates, and two
  // plastic stools on the customer side. Some bays are shuttered: a market at 11:30 is half-packed,
  // and the asymmetry is what makes it read as a working day rather than a set.
  // ---------------------------------------------------------------------------
  const tableTop = material(0x9a8b72, 0.88, 0.02);
  const tableLeg = material(0x474b4e, 0.5, 0.55);
  const crateMats = [material(0x7c5a3a, 0.92, 0.02), material(0x5d6b4a, 0.9, 0.02), material(0x8a6b4b, 0.92, 0.02)];
  let bay = 0;
  for (let z = Z1 + BAY / 2; z < Z0 - BAY / 2; z += BAY, bay++) {
    const shuttered = bay % 5 === 3;
    const x = FRONT_X - 1.55;
    if (!shuttered) {
      box(chunk, [x, 0.78, z], [1.6, 0.08, 2.15], tableTop);
      for (const sx of [-0.68, 0.68]) {
        for (const sz of [-0.94, 0.94]) {
          box(chunk, [x + sx, 0.39, z + sz], [0.06, 0.78, 0.06], tableLeg, false);
        }
      }
      // Produce: stacked crates of descending height, so the stall line is not a grid.
      const crates = 2 + (bay % 3);
      for (let c = 0; c < crates; c++) {
        const cz = z - 0.78 + c * 0.64;
        const h = 0.17 + ((bay + c) % 3) * 0.06;
        box(chunk, [x - 0.05, 0.82 + h / 2, cz], [1.2, h, 0.52], crateMats[(bay + c) % 3], false);
        // A mound of produce above the crate rim: three small boxes, never aligned.
        for (let g = 0; g < 3; g++) {
          box(
            chunk,
            [x - 0.05 + (g - 1) * 0.34, 0.82 + h + 0.05, cz + ((g % 2) - 0.5) * 0.16],
            [0.28, 0.1, 0.28],
            crateMats[(bay + g + 1) % 3],
            false,
          );
        }
      }
      // Stools on the customer side — the real plastic stools, not a cylinder with four rods.
      //
      // `streetFurniture.ts` loads `stool-low` (1 654 triangles, one material, three textures) and
      // scales it to the 0.27 m seat height a low plastic stool actually has. Two per bay, one red
      // one blue, which is what every pavement in this country looks like. When the model is not
      // loaded — a failed download, a headless test — the procedural stool still goes in, so the
      // market never loses its furniture to a network error.
      const seatX = x + 1.22;
      for (const [si, sz] of [-0.6, 0.6].entries()) {
        if (hasProp("stool-low")) {
          queueWorldProp("stool-low", seatX, CURB_HEIGHT, z + sz, ((bay + si) % 4) * (Math.PI / 2), 1);
          const sz3 = propSize("stool-low")!;
          solids.push(rect(seatX, z + sz, Math.max(0.34, sz3.x), Math.max(0.34, sz3.z)));
          continue;
        }
        const stoolMat = si === 0 ? plasticRed() : plasticBlue();
        const seat = new T.Mesh(new T.CylinderGeometry(0.18, 0.16, 0.05, 10), stoolMat);
        seat.position.set(seatX, CURB_HEIGHT + 0.44, z + sz);
        chunk.add(seat);
        for (const lx of [-1, 1]) {
          for (const lz of [-1, 1]) {
            rod(
              chunk,
              [seatX + lx * 0.11, CURB_HEIGHT, z + sz + lz * 0.11],
              [seatX + lx * 0.08, CURB_HEIGHT + 0.42, z + sz + lz * 0.08],
              0.015,
              stoolMat,
              0.015,
              5,
            );
          }
        }
        solids.push(rect(seatX, z + sz, 0.36, 0.36));
      }
      // Hanging scale over the produce: the one object that says "this is sold by weight".
      const arm = material(0x9aa0a4, 0.4, 0.7);
      rod(chunk, [x, 2.05, z], [x + 0.5, 2.05, z], 0.012, arm, 0.012, 5);
      rod(chunk, [x + 0.5, 2.05, z], [x + 0.5, 1.82, z], 0.008, arm, 0.008, 5);
      const pan = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.04, 10), arm);
      pan.position.set(x + 0.5, 1.79, z);
      chunk.add(pan);
    } else {
      // Shutter down: a ribbed steel blind, and the bay goes quiet.
      const shutter = material(0x878b8f, 0.54, 0.64);
      box(chunk, [FRONT_X - 0.32, 1.3, z], [0.09, 2.6, BAY - 0.1], shutter);
      for (let r = 0; r < 7; r++) {
        box(chunk, [FRONT_X - 0.27, 0.3 + r * 0.34, z], [0.03, 0.05, BAY - 0.14], material(0x697075, 0.5, 0.6), false);
      }
      // Stock is stored under the shutter, as it always is.
      box(chunk, [FRONT_X - 0.72, 0.24, z], [0.56, 0.46, BAY - 0.5], material(0x7a6248, 0.94, 0.02), false);
    }
    solids.push(rect(x, z, 2.0, BAY));
  }

  // ---------------------------------------------------------------------------
  // CÔ BA'S STALL (A3) — the one bay the mission's writing actually points at.
  //
  // Chosen at z = -130: close enough to the bus that the walk is short, far enough that the player
  // passes three other stalls first, which is how a market is entered.
  // ---------------------------------------------------------------------------
  const cobaZ = -130;
  const cobaX = FRONT_X - 1.55;
  // Half-lowered shutter: she is open, but tidying. The gap is at chest height, not at the floor.
  box(chunk, [FRONT_X - 0.32, 2.06, cobaZ], [0.09, 0.6, BAY - 0.1], material(0x878b8f, 0.54, 0.64));
  const caseFrame = material(0x64696d, 0.42, 0.7);
  const caseGlass = new T.MeshStandardMaterial({
    color: 0xbcd6dd,
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
  });
  box(chunk, [cobaX, 0.9, cobaZ], [1.35, 0.06, 1.9], caseFrame);
  box(chunk, [cobaX, 1.16, cobaZ], [1.28, 0.46, 1.84], caseGlass, false);
  for (const sx of [-0.62, 0.62]) {
    for (const sz of [-0.9, 0.9]) {
      box(chunk, [cobaX + sx, 0.45, cobaZ + sz], [0.05, 0.9, 0.05], caseFrame, false);
    }
  }
  // THE RECEIPT STRING (D2): bills on a nail at eye height, beside the shutter. This is the one prop
  // the dialogue points at, so it sits where someone standing at the counter must look at it.
  const nailX = FRONT_X - 0.62;
  const nailZ = cobaZ + 1.28;
  rod(chunk, [nailX - 0.04, 1.64, nailZ], [nailX + 0.05, 1.64, nailZ], 0.011, caseFrame, 0.011, 5);
  // The string of bills — the only prop the mission's dialogue actually points at (A3).
  //
  // The first version hung eleven slips 0.10-0.16 m tall at 0.026 m intervals, so they occupied the
  // same 0.29 m of height as one slip and rendered as a single white smear. A spike of receipts is
  // not a stack; it is a rosette. Each slip is impaled at one point and hangs outward under its own
  // weight, so the fan is what tells the eye "eleven bills", and the fan is also why a shopkeeper can
  // read any one of them without taking the others off.
  //
  // Golden-angle spacing puts the bills around the nail without clumping, which is what actually
  // happens when they are threaded on in a hurry over a morning.
  const paperA = material(0xe8e1d2, 0.95, 0.01);
  const paperB = material(0xd8cfbc, 0.95, 0.01);
  const GOLDEN = 2.3999632297286535;
  for (let b = 0; b < 11; b++) {
    const angle = b * GOLDEN;
    const hang = 0.13 + rand() * 0.09;
    const reach = 0.012 + b * 0.0042; // later bills splay further out
    const slip = box(
      chunk,
      [
        nailX + 0.02 + Math.cos(angle) * reach,
        // Top of every slip is at the nail; the body drops from there.
        1.6 - hang / 2 - b * 0.0016,
        nailZ + Math.sin(angle) * reach,
      ],
      [0.006, hang, 0.062 + rand() * 0.026],
      b % 3 === 0 ? paperB : paperA,
      false,
    );
    // Every slip pivots about the nail, so the whole fan is one readable object from any side.
    slip.rotation.y = angle;
    slip.rotation.x = (rand() - 0.5) * 0.18;
    slip.rotation.z = (rand() - 0.5) * 0.22;
  }
  // Her stool behind the counter, and the crate she keeps under it.
  const herStool = new T.Mesh(new T.CylinderGeometry(0.2, 0.18, 0.05, 12), plasticRed());
  herStool.position.set(cobaX - 0.55, CURB_HEIGHT + 0.42, cobaZ - 0.55);
  chunk.add(herStool);
  box(chunk, [cobaX - 0.7, 0.19, cobaZ + 0.52], [0.42, 0.38, 0.58], material(0x6a573f, 0.94, 0.02), false);
  contact(chunk, cobaX, 0.014, cobaZ, 1.75, 2.2, contactMaterial(0.5));

  // ---------------------------------------------------------------------------
  // SERVICE ALLEY — a way in and out, so the block is a place and not a façade.
  //
  // It crosses the block toward the truck lane, which is what every market in this district has and
  // what makes carts, porters and the whole economy of the place legible.
  // ---------------------------------------------------------------------------
  plane(chunk, [FRONT_X - DEPTH / 2, 0.028, ALLEY_Z], [DEPTH + 1.6, ALLEY_W], marketFloor, 0, -Math.PI / 2);
  const alleyWall = createWorldFacadePBR("grey_plaster_02", "#a8a094", 3.0, 1.1, 0.94);
  for (const sz of [-1, 1]) {
    box(
      chunk,
      [FRONT_X - DEPTH / 2, 2.7, ALLEY_Z + sz * (ALLEY_W / 2 + 0.11)],
      [DEPTH + 1.4, 5.4, 0.22],
      alleyWall,
    );
  }
  // Above the alley: a bridge of shophouse, so the block is continuous over the passage.
  box(chunk, [FRONT_X - DEPTH / 2, 5.9, ALLEY_Z], [DEPTH + 1.4, 1.5, ALLEY_W + 0.6], stuccoWarm);
  // One bare bulb on a bracket: an alley with no light is a texture, not a place.
  rod(chunk, [FRONT_X - 2.6, 3.5, ALLEY_Z + 1.1], [FRONT_X - 2.6, 3.12, ALLEY_Z + 0.42], 0.012, frameMat(), 0.012, 5);
  const bulb = new T.Mesh(new T.SphereGeometry(0.062, 8, 6), new T.MeshBasicMaterial({ color: 0xffe0a8 }));
  bulb.position.set(FRONT_X - 2.6, 3.07, ALLEY_Z + 0.42);
  chunk.add(bulb);
  lightSpecsLocal.push({ x: FRONT_X - 2.6, y: 2.95, z: ALLEY_Z + 0.42, color: 0xffca86, intensity: 3.6, distance: 7.5, decay: 2 });

  // ---------------------------------------------------------------------------
  // BUS SHELTERS (A4, A5) — there were none anywhere in the world.
  // ---------------------------------------------------------------------------
  const shelterRoof = material(0x4a5157, 0.5, 0.62);
  const shelterPost = material(0x3d4247, 0.46, 0.68);
  const plateMat = material(0xeee8d6, 0.82, 0.02);
  const buildShelter = (x: number, z: number, yaw: number) => {
    const g = new T.Group();
    g.position.set(x, CURB_HEIGHT, z);
    g.rotation.y = yaw;
    chunk.add(g);
    const r = box(g, [0, 2.44, 0], [1.52, 0.09, 3.44], shelterRoof, true);
    r.rotation.z = 0.045;
    box(g, [0.72, 2.36, 0], [0.05, 0.13, 3.44], shelterPost, false);
    box(g, [-0.72, 2.36, 0], [0.05, 0.13, 3.44], shelterPost, false);
    for (const px of [-0.66, 0.66]) {
      for (const pz of [-1.62, 1.62]) {
        box(g, [px, 1.2, pz], [0.08, 2.4, 0.08], shelterPost, true);
      }
    }
    box(g, [-0.42, 0.44, 0], [0.34, 0.06, 2.5], material(0x948975, 0.88, 0.02), false);
    for (const pz of [-1.05, 0, 1.05]) {
      box(g, [-0.42, 0.22, pz], [0.3, 0.44, 0.06], shelterPost, false);
    }
    box(g, [0.72, 1.72, -1.66], [0.05, 0.46, 0.72], plateMat, false);
    // Local +z becomes world -x after the quarter-turn yaw, i.e. toward the road. At +1.74 the bin
    // landed at x = -0.26 — on the asphalt. It sits on the terrace side instead.
    const bin = new T.Mesh(new T.CylinderGeometry(0.21, 0.18, 0.62, 10), material(0x2f5a3a, 0.82, 0.06));
    bin.position.set(0.5, 0.31, -1.52);
    g.add(bin);
    lightSpecsLocal.push({ x, y: 2.3, z, color: 0xf2ead6, intensity: 2.6, distance: 6.2, decay: 2 });
    solids.push(rect(x, z, 1.5, 3.5));
  };
  // WHERE THE DOORS ACTUALLY ARE, read from the boarding code rather than guessed twice.
  //
  // `boarding.ts:66` accepts a passenger only at `local.x > 0.82 && local.x < 1.42` — the bus doors
  // are on its +X side. Bus 06 drives at `ROUTE.curbX = -1.54`, so the doorway lands at x ≈ -0.7,
  // opening onto the FAR pavement, not the market side. The shelter goes there, at that kerb, and
  // the market stays across the road: you get off, you cross, you walk under the fabric.
  // ON THE REAL EAST PAVEMENT, between the kerb at x = ROAD_MAX and the terrace frontage at 3.4,
  // where the bus doors open (+X side of the bus, `boarding.ts:66`).
  //
  // The pavement is 3.64 m wide and the shelter's roof is 1.52 x 3.44; yawed a quarter turn, the
  // 3.44 half-extent runs along the pavement and the 1.52 across it, so the half-width that matters
  // is 0.76 plus the 0.045 tilt. Centred at ROAD_MAX + 1.72 the roof spans -0.24..3.2: the kerb line
  // exactly, and never a millimetre of asphalt. Audits at +1.05 and +1.55 both caught overhang.
  buildShelter(ROAD_MAX + 1.72, CHO_LON_Z + 1.5, -Math.PI / 2);
  // Lý Thái Tổ, where the player boards: on the far pavement at the origin end, at the kerb, facing
  // the road. It was at x = 3.1, which is in the middle of the carriageway this round added — the
  // kind of placement error that is invisible until a road exists to be standing in.
  buildShelter(FAR_MIN + 1.72, 9.4, -Math.PI / 2);

  // ---------------------------------------------------------------------------
  // THE ATM (D3) — the rider offers to stop at one, so one has to exist.
  // ---------------------------------------------------------------------------
  const atmX = ROAD_MAX + 1.1;
  const atmZ = -121.5;
  box(chunk, [atmX, 1.05, atmZ], [0.72, 2.1, 1.15], material(0x37424c, 0.42, 0.58));
  const atmScreen = new T.MeshStandardMaterial({
    color: 0x0d1a24,
    emissive: new T.Color(0x7fd4ff),
    emissiveIntensity: 0.5,
    roughness: 0.24,
  });
  plane(chunk, [atmX - 0.37, 1.42, atmZ], [0.86, 0.6], atmScreen, -Math.PI / 2);
  const atmFascia = new T.MeshStandardMaterial({
    color: 0x123a5e,
    emissive: new T.Color(0x4aa8ff),
    emissiveIntensity: 0.7,
    roughness: 0.5,
  });
  plane(chunk, [atmX - 0.375, 1.96, atmZ], [1.06, 0.26], atmFascia, -Math.PI / 2);
  box(chunk, [atmX - 0.28, 2.28, atmZ], [0.9, 0.06, 1.5], shelterRoof, false);
  solids.push(rect(atmX, atmZ, 0.9, 1.3));

  // ---------------------------------------------------------------------------
  // SIGNAGE — half-real / half-fake (§7.1), in the house style already shipped for GS36.
  //
  // Hand-painted market signage in this district is Vietnamese with Chinese characters above it.
  // The fascia is geometry, not a texture, so the courier's brand (B1/B2 in the brief) can be
  // swapped in later without touching the block.
  // ---------------------------------------------------------------------------
  const marketSign = new T.MeshStandardMaterial({
    color: 0x6b2a24,
    emissive: new T.Color(0xd8a05a),
    emissiveIntensity: 0.18,
    roughness: 0.8,
  });
  for (const [z0, z1] of [
    [Z1 + 0.4, ALLEY_Z - ALLEY_W / 2 - 0.2],
    [ALLEY_Z + ALLEY_W / 2 + 0.2, Z0 - 0.4],
  ] as const) {
    box(chunk, [FRONT_X + 0.04, 2.98, (z0 + z1) / 2], [0.09, 0.58, z1 - z0], marketSign, false);
  }

  // ---------------------------------------------------------------------------
  // THE TRUCK LANE BEHIND THE MARKET — one parked wagon, a stack of pallets, a wheelie bin.
  // This is what makes the block have a back, which is what makes it a building.
  // ---------------------------------------------------------------------------
  const pallet = material(0x8a7351, 0.94, 0.01);
  for (let i = 0; i < 6; i++) {
    const pz = Z1 + 8 + rand() * (spanZ - 16);
    const px = LANE_X + (rand() - 0.5) * 1.6;
    const stackH = 0.13 * (1 + Math.floor(rand() * 3));
    box(chunk, [px, stackH / 2, pz], [1.1, stackH, 0.8], pallet, false);
  }
  const wagon = new T.Group();
  wagon.position.set(LANE_X + 0.2, 0, -113.5);
  wagon.rotation.y = 0.06;
  chunk.add(wagon);
  box(wagon, [0, 0.62, 0], [1.62, 0.9, 3.9], material(0xd6d2c8, 0.62, 0.14));
  box(wagon, [0, 1.24, 0.55], [1.5, 0.62, 1.5], material(0xcfcbc0, 0.62, 0.14), false);
  box(wagon, [0, 0.72, -1.86], [1.58, 0.42, 0.1], material(0x3a3f42, 0.6, 0.4), false);
  for (const wx of [-0.78, 0.78]) {
    for (const wz of [-1.32, 1.24]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.31, 0.31, 0.2, 12), material(0x1d1f20, 0.9, 0.02));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.31, wz);
      wagon.add(wheel);
    }
  }
  solids.push(rect(LANE_X + 0.2, -113.5, 1.9, 4.1));

  // ---------------------------------------------------------------------------
  // THE THINGS THAT MAKE A PAVEMENT USED — added after looking at the first renders.
  //
  // The block read as a building next to an empty road: every object that says "people work here
  // every morning" was missing. These are all cheap boxes and cylinders, and they are the ones a
  // player actually walks past.
  // ---------------------------------------------------------------------------

  // 1. Overhead cables. Every street in this district is webbed with them; they are the single most
  //    recognisable silhouette in a photograph of Chợ Lớn after the canopies.
  const cable = material(0x24262a, 0.9, 0.1);
  for (let c = 0; c < 5; c++) {
    const cy = 4.55 + c * 0.19;
    const zA = Z1 + 6 + c * 9.5;
    const sag = 0.42 + c * 0.05;
    const pts: [number, number, number][] = [];
    for (let t = 0; t <= 7; t++) {
      const f = t / 7;
      const zz = zA + f * 26;
      const xx = FRONT_X + 0.2 + f * (LANE_X - FRONT_X) * 0.1 - 1.4;
      pts.push([xx, cy - Math.sin(f * Math.PI) * sag, zz]);
    }
    tube(chunk, pts, 0.016, cable, 8);
  }
  // Drop wires from the cables down to the shopfronts: the district's signature mess.
  for (let d = 0; d < 6; d++) {
    const dz = Z1 + 9 + d * 7.3;
    rod(chunk, [FRONT_X - 2.2, 5.1, dz], [FRONT_X - 0.1, 3.7, dz + 0.3], 0.009, cable, 0.009, 4);
  }

  // 2. Goods on the pavement: stacked baskets, a sack of rice, a polystyrene box. Vendors put their
  //    stock out the front and the front line of a market is never a clean kerb.
  const basket = material(0x7d6142, 0.94, 0.01);
  for (let i = 0; i < 14; i++) {
    const z = Z1 + 4 + rand() * (spanZ - 8);
    const x = FRONT_X + 0.55 + rand() * 0.55;
    const kind = i % 4;
    if (kind === 0) {
      // A stack of plastic baskets, slightly rotated, as they always are.
      for (let b = 0; b < 4; b++) {
        const bb = box(chunk, [x, 0.06 + b * 0.115, z], [0.52, 0.11, 0.42], basket, false);
        bb.rotation.y = (rand() - 0.5) * 0.2;
      }
    } else if (kind === 1) {
      // A rice sack, slumped.
      const sack = box(chunk, [x, 0.22, z], [0.5, 0.44, 0.72], material(0xd8d4c4, 0.96, 0.01), false);
      sack.rotation.z = (rand() - 0.5) * 0.12;
    } else if (kind === 2) {
      // Polystyrene fish box, lid slightly off.
      box(chunk, [x, 0.13, z], [0.62, 0.26, 0.44], material(0xe6e8e4, 0.9, 0.01), false);
      box(chunk, [x + 0.06, 0.28, z + 0.04], [0.6, 0.04, 0.42], material(0xdfe2de, 0.9, 0.01), false);
    } else {
      // A pyramid of drink crates against the stall.
      for (let r = 0; r < 3; r++) {
        box(chunk, [x, 0.11 + r * 0.22, z], [0.42, 0.21, 0.6], material(0xa83b2c, 0.88, 0.03), false);
      }
    }
  }

  // 3. A parked scooter, half on the pavement, which is where scooters are parked.
  //
  // It used to be five primitives: a box for the body, a box for the seat, a rod for the bars and
  // two cylinders for the wheels. A Honda PCX is 19 306 triangles across five materials with five
  // scanned textures, and the repository already loads it — so the market parks the real thing, and
  // falls back to the primitives only when the model is unavailable.
  const parkedX = FRONT_X + 0.95;
  if (hasProp("bike-pcx")) {
    queueWorldProp("bike-pcx", parkedX, 0, -136.5, 0.38, 1);
    const bz = propSize("bike-pcx")!;
    solids.push(rect(parkedX, -136.5, Math.max(0.5, bz.x), Math.max(1.2, bz.z)));
  } else {
    const scooter = new T.Group();
    // On the market's own approach strip, not inside the street's west shop row: FRONT_X + 4.7 put
    // the parked scooter at x = -15.9, which is 2.1 m inside a stranger's front room.
    scooter.position.set(parkedX, 0, -136.5);
    scooter.rotation.y = 0.38;
    chunk.add(scooter);
    box(scooter, [0, 0.58, 0], [0.36, 0.3, 1.24], material(0x1f2a33, 0.4, 0.45));
    box(scooter, [0, 0.86, 0.34], [0.3, 0.18, 0.5], material(0x1a222a, 0.5, 0.4), false);
    rod(scooter, [0, 0.78, 0.62], [0, 1.06, 0.5], 0.03, frameMat(), 0.03, 6);
    for (const wz of [-0.56, 0.6]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.1, 12), material(0x181a1b, 0.92, 0.02));
      w.rotation.z = Math.PI / 2;
      w.position.set(0, 0.26, wz);
      scooter.add(w);
    }
    solids.push(rect(parkedX, -136.5, 1.0, 1.5));
  }

  // 4. A hand-pulled cart parked in the service alley: the block's back door is where the goods
  //    actually come in, and it gives the alley a reason to exist.
  const cart = new T.Group();
  cart.position.set(FRONT_X - 3.4, 0, ALLEY_Z + 0.7);
  cart.rotation.y = 0.9;
  chunk.add(cart);
  box(cart, [0, 0.62, 0], [1.0, 0.14, 1.9], material(0x8b7a5f, 0.94, 0.01));
  for (const sx of [-0.42, 0.42]) {
    box(cart, [sx, 0.32, 0], [0.07, 0.42, 1.8], material(0x6b5c46, 0.94, 0.01), false);
  }
  for (const wz of [-0.6, 0.6]) {
    const w = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.08, 10), material(0x222526, 0.9, 0.02));
    w.rotation.z = Math.PI / 2;
    w.position.set(-0.5, 0.22, wz);
    cart.add(w);
  }
  box(cart, [0.1, 0.86, 0.2], [0.7, 0.34, 0.9], basket, false);

  streamer.register({
    id: "cho-lon-market",
    name: "Chợ Lớn · Quận 5",
    district: "Quận 5",
    cx: FRONT_X - DEPTH / 2,
    cz: midZ,
    near: chunk,
    nearDist: 190,
    lodDist: 420,
  });

  lightSpecs.push(...lightSpecsLocal);

  return {
    root: chunk,
    solids,
    lightSpecs: lightSpecsLocal,
    // The customer stands on the pavement outside the frontage line, facing the counter.
    cobaStall: { x: FRONT_X + 1.15, z: cobaZ, yaw: -Math.PI / 2 },
    receiptNail: { x: nailX, y: 1.6, z: nailZ },
    busStops: [
      // Must match `buildShelter` calls above. Chợ Lớn sits on the far kerb because that is where
      // the bus doors open (+X side of the bus); Lý Thái Tổ is the same side at the origin end.
      { x: ROAD_MAX + 1.72, z: CHO_LON_Z + 1.5, yaw: -Math.PI / 2 },
      { x: FAR_MIN + 1.72, z: 9.4, yaw: -Math.PI / 2 },
    ],
  };
}
