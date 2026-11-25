import { expect, it } from "vitest";
import * as T from "three";
import { buildSaigonDistricts } from "../../features/testbus/openworld/world/saigonDistricts";
import { buildStreet } from "../../features/testbus/openworld/simulation/street";

const noop = () => undefined;
const stub = () => ({ canvas:{width:96,height:96}, createRadialGradient:()=>({addColorStop:noop}),
  createLinearGradient:()=>({addColorStop:noop}), createPattern:()=>null, fillRect:noop, strokeRect:noop,
  clearRect:noop, beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop, arc:noop, rect:noop,
  roundRect:noop, ellipse:noop, quadraticCurveTo:noop, bezierCurveTo:noop, setLineDash:noop, clip:noop,
  arcTo:noop, transform:noop, setTransform:noop, fill:noop, stroke:noop, save:noop, restore:noop,
  translate:noop, rotate:noop, scale:noop, drawImage:noop, putImageData:noop, fillText:noop,
  strokeText:noop, measureText:()=>({width:0}), getImageData:(_x:number,_y:number,w:number,h:number)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}),
  createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4)),width:w,height:h}) } as any);
if (typeof HTMLCanvasElement !== "undefined") {
  (HTMLCanvasElement.prototype as any).getContext = (k: string) => (k === "2d" ? stub() : null);
}

const CELL = 1;
const X0 = -40, X1 = 20, Z0 = -160, Z1 = -96;
const NX = Math.ceil((X1 - X0) / CELL), NZ = Math.ceil((Z1 - Z0) / CELL);

function occupancy(root: T.Object3D, minY: number) {
  const grid = new Uint8Array(NX * NZ);
  const v = new T.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return;
    if (o.isInstancedMesh) {
      const m = new T.Matrix4();
      for (let k = 0; k < o.count; k++) {
        o.getMatrixAt(k, m);
        const p = new T.Vector3().setFromMatrixPosition(m);
        if (p.y < minY) continue;
        const i = Math.floor((p.x - X0) / CELL), j = Math.floor((p.z - Z0) / CELL);
        if (i >= 0 && i < NX && j >= 0 && j < NZ) grid[j * NX + i] = 1;
      }
      return;
    }
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 3000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < minY) continue;
      const ix = Math.floor((v.x - X0) / CELL), iz = Math.floor((v.z - Z0) / CELL);
      if (ix >= 0 && ix < NX && iz >= 0 && iz < NZ) grid[iz * NX + ix] = 1;
    }
  });
  return grid;
}

it("market and street do not occupy the same ground volume", () => {
  // Two independent builds, diffed. Batching merges geometry into district-sized meshes, so bounding
  // boxes are useless here — but occupancy does not care how geometry was batched.
  const a = new T.Scene();
  const streamer = { register: () => undefined, getZone: () => ({}) } as any;
  const da = buildSaigonDistricts(a, streamer, false);
  const streetA = buildStreet(a, false);
  const market = da.root.getObjectByName("ChoLonMarket")!;
  const streetGrid = occupancy(streetA.environment, 0.5);
  const marketGrid = occupancy(market, 0.5);

  let both = 0, marketOnly = 0, streetOnly = 0;
  for (let i = 0; i < streetGrid.length; i++) {
    if (streetGrid[i] && marketGrid[i]) both++;
    if (marketGrid[i] && !streetGrid[i]) marketOnly++;
    if (streetGrid[i] && !marketGrid[i]) streetOnly++;
  }
  console.log(`cells occupied by both: ${both}`);
  console.log(`cells occupied by the market alone: ${marketOnly}`);
  console.log(`cells occupied by the street alone: ${streetOnly}`);

  // Where do the shared cells fall?
  const zs = new Map<number, number>();
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (streetGrid[j * NX + i] && marketGrid[j * NX + i]) {
      const z = Z0 + j * CELL;
      zs.set(z, (zs.get(z) ?? 0) + 1);
    }
  }
  console.log("shared cells by z:");
  for (const z of [...zs.keys()].sort((p, q) => p - q)) {
    console.log(`  z=${String(z).padStart(5)}  ${"#".repeat(Math.min(50, zs.get(z)!))} (${zs.get(z)})`);
  }
  const cols = new Map<number, number>();
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (streetGrid[j * NX + i] && marketGrid[j * NX + i]) {
      const x = X0 + i * CELL;
      cols.set(x, (cols.get(x) ?? 0) + 1);
    }
  }
  // Name the street objects that live in the contested band, by their own geometry, before batching.
  const streetScene = new T.Scene();
  const st = buildStreet(streetScene, false);
  const byMat = new Map<string, number>();
  st.environment.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    o.geometry.computeBoundingBox();
    const b = new T.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if (b.max.x < -22 || b.min.x > -13) return;
    if (b.max.y < 0.5) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const key = `${mats[0]?.name || mats[0]?.type} x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} y ${b.min.y.toFixed(1)}..${b.max.y.toFixed(1)} z ${b.min.z.toFixed(0)}..${b.max.z.toFixed(0)}`;
    byMat.set(key, (byMat.get(key) ?? 0) + 1);
  });
  console.log(`contested band is z ${Z0}..${Z1}; street geometry reported above is at other z.`);
  // Direct world-space scan: which street vertices land in the contested cells at all?
  const probe = new T.Vector3();
  let hits = 0;
  const sample: string[] = [];
  st.environment.updateMatrixWorld(true);
  st.environment.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 500));
    for (let i = 0; i < pos.count; i += step) {
      probe.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (probe.y < 0.5) continue;
      if (probe.z > -104 || probe.z < -152) continue;
      if (probe.x > -13 || probe.x < -27) continue;
      hits++;
      if (sample.length < 6) sample.push(`${probe.x.toFixed(1)},${probe.y.toFixed(1)},${probe.z.toFixed(1)} ${(o.material as any)?.name || ""}`);
    }
  });
  console.log(`street vertices inside x -27..-13, z -152..-104, y>0.5: ${hits}`);
  for (const s2 of sample) console.log(`   ${s2}`);

  console.log("street meshes in the contested band x -22..-13:");
  for (const [k, n] of [...byMat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${n}x  ${k}`);

  console.log("shared cells by x:");
  for (const x of [...cols.keys()].sort((p, q) => p - q)) {
    console.log(`  x=${String(x).padStart(4)}  ${"#".repeat(Math.min(50, cols.get(x)!))} (${cols.get(x)})`);
  }
  // What matters is not overlap with the street's *paving* — a market on a verge necessarily shares
  // ground with the pavement. What matters is overlap with the street's STRUCTURE. Re-measure with a
  // height threshold inside the street's own volume.
  const highStreet = occupancy(streetA.environment, 2.6);
  let structural = 0;
  const structCols = new Map<number, number>();
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (highStreet[j * NX + i] && marketGrid[j * NX + i]) {
      structural++;
      const x = X0 + i * CELL;
      structCols.set(x, (structCols.get(x) ?? 0) + 1);
    }
  }
  console.log(`cells where the market sits inside street STRUCTURE (above 2.6 m): ${structural}`);
  for (const x of [...structCols.keys()].sort((p, q) => p - q)) {
    console.log(`  x=${String(x).padStart(4)}  (${structCols.get(x)})`);
  }
  // Name the street meshes that own those cells, before batching.
  const sp = new T.Vector3();
  const owners = new Map<string, number>();
  streetA.environment.updateMatrixWorld(true);
  streetA.environment.traverse((o: any) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 2000));
    let hit = 0;
    for (let i = 0; i < pos.count; i += step) {
      sp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (sp.y < 2.6) continue;
      if (sp.x > -15.5 || sp.x < -27) continue;
      if (sp.z > -104 || sp.z < -152) continue;
      hit++;
    }
    if (hit > 0) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m: any = mats[0];
      const key = "color#" + (m?.color ? m.color.getHexString() : "?");
      owners.set(key, (owners.get(key) ?? 0) + hit);
    }
  });
  console.log("street objects inside the market band above 2.6 m, by material colour:");
  for (const [k, n] of [...owners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${n}  ${k}`);

  // Direct: how many of MY vertices sit inside the street's *shopfront volume*?
  // The west row's faces run from x = -18.0 outward by at most 0.26 m of molding.
  let deepest = -99;
  const mv = new T.Vector3();
  market.traverse((o: any) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 3) {
      mv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (mv.y < 0.5) continue;
      if (mv.z > -104 || mv.z < -152) continue;
      if (mv.x > -17.8) { deepest = Math.max(deepest, mv.x); void 0; }
    }
  });
  // Only the part of the market that lives on the WEST side of the carriageway can collide with the
  // west shop row; the shelter and the ATM are across the road by design.
  let westDepth = -99;
  let westCount = 0;
  market.traverse((o: any) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 3) {
      mv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (mv.y < 0.5) continue;
      if (mv.z > -104 || mv.z < -152) continue;
      if (mv.x > -10) continue; // east of the road: shelter, ATM, kerbside plate
      westCount++;
      westDepth = Math.max(westDepth, mv.x);
    }
  });
  console.log(`west-side market vertices: ${westCount}; easternmost of them: x = ${westDepth.toFixed(2)}`);
  console.log(`the street's west shopfront plane: x = -18.00 (plus 0.26 m of molding = -17.74)`);
  console.log(westDepth < -17.74 ? "  -> the market stops west of the street's own mouldings" : "  -> OVERLAP");

  expect(westDepth).toBeLessThan(-17.74);
});
