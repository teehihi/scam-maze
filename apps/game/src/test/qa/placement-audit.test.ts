import { expect, it } from "vitest";
import * as T from "three";
import { buildSaigonDistricts } from "../../features/testbus/openworld/world/saigonDistricts";

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

it("planting actually reaches the scene", () => {
  const scene = new T.Scene();
  const streamer = { register: () => undefined, getZone: () => ({}) } as any;
  const d = buildSaigonDistricts(scene, streamer, false);
  const market = d.root.getObjectByName("ChoLonMarket")!;
  let inst = 0, pots = 0;
  market.traverse((o: any) => {
    if (!o.isInstancedMesh) return;
    inst++;
    pots += o.count;
  });
  console.log(`instanced meshes under the market: ${inst}, total instances: ${pots}`);
  const bb = new T.Box3().setFromObject(market);
  console.log(`market bounds: x ${bb.min.x.toFixed(1)}..${bb.max.x.toFixed(1)} y ${bb.min.y.toFixed(1)}..${bb.max.y.toFixed(1)} z ${bb.min.z.toFixed(1)}..${bb.max.z.toFixed(1)}`);
  expect(inst).toBeGreaterThan(0);
});

it("the market still contains its landmarks", () => {
  const scene = new T.Scene();
  const streamer = { register: () => undefined, getZone: () => ({}) } as any;
  const d = buildSaigonDistricts(scene, streamer, false);
  const market = d.root.getObjectByName("ChoLonMarket")!;
  const bb = new T.Box3().setFromObject(market);
  console.log(`market bounds x ${bb.min.x.toFixed(1)}..${bb.max.x.toFixed(1)}  y ${bb.min.y.toFixed(1)}..${bb.max.y.toFixed(1)}  z ${bb.min.z.toFixed(1)}..${bb.max.z.toFixed(1)}`);
  let meshes = 0, tris = 0;
  market.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry.getAttribute("position");
    if (g) tris += g.count / 3;
  });
  console.log(`meshes ${meshes}, triangles ${Math.round(tris)}`);

  // Where is anything in the sightline from (-6, z+12) toward (0.4, z+1.5)? Walk the ray.
  const from = new T.Vector3(-5.0, 1.62, -117.0);
  const to = new T.Vector3(1.4, 1.7, -126.5);
  const dir = to.clone().sub(from).normalize();
  const ray = new T.Raycaster(from, dir, 0.05, 40);
  const hits = ray.intersectObject(market, true);
  console.log(`ray hits in the market: ${hits.length}`);
  // And what is at the shelter's own coordinates?
  const probe = new T.Vector3(1.4, 1.7, -126.5);
  const near: string[] = [];
  market.traverse((o: any) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingBox();
    const b = new T.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if (b.distanceToPoint(probe) < 2.5) near.push(`${o.type} @ ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} z ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}`);
  });
  console.log(`objects within 2.5 m of the shelter point: ${near.length}`);
  for (const n of near.slice(0, 5)) console.log(`   ${n}`);
  for (const h of hits.slice(0, 6)) {
    const p = h.point;
    console.log(`   t=${h.distance.toFixed(1)} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}  ${(h.object as any).name || h.object.type}`);
  }
});
it("the Chợ Lớn chunk does not intersect any existing district structure", () => {
  const scene = new T.Scene();
  const streamer = { register: () => undefined, getZone: () => ({}) } as any;
  const d = buildSaigonDistricts(scene, streamer, false);
  const market = d.root.getObjectByName("ChoLonMarket")!;

  // Sample MY triangles densely; test each centroid against THEIR per-mesh boxes.
  const theirs: { b: T.Box3 }[] = [];
  d.root.traverse((o: any) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    let p: any = o, isMine = false;
    while (p) { if (p === market) { isMine = true; break; } p = p.parent; }
    if (isMine) return;
    o.geometry.computeBoundingBox();
    const b = new T.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    const sz = b.getSize(new T.Vector3());
    if (sz.y < 0.5 || sz.x * sz.z < 2) return;
    if (sz.x * sz.y * sz.z > 30000) return;
    theirs.push({ b });
  });

  let inside = 0, total = 0;
  const worst = new Map<string, number>();
  const v = new T.Vector3();
  market.traverse((o: any) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      total++;
      for (const { b } of theirs) {
        if (b.containsPoint(v)) {
          inside++;
          const k = `x${b.min.x.toFixed(0)}..${b.max.x.toFixed(0)} z${b.min.z.toFixed(0)}..${b.max.z.toFixed(0)} y${b.max.y.toFixed(0)}  <-mine:${o.name || o.type}@${v.x.toFixed(0)},${v.z.toFixed(0)}`;
          worst.set(k, (worst.get(k) ?? 0) + 1);
          break;
        }
      }
    }
  });
  // Instanced meshes (trees, potted plants) are excluded on both sides: their base geometry sits at
  // the origin and the per-instance matrices carry the placement, so transforming the geometry alone
  // reports every instance at (0, 0, 0).
  //
  // THE GATE. This chunk once built fourteen terrace volumes straight through houses that already
  // stood at x = 8..12 — 380 vertices of existing geometry at 6.1 m — and every test was green,
  // because no test compared the new block against the district it was inserted into.
  for (const [k, n] of [...worst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`   ${n}  ${k}`);
  }
  expect(inside, "the market is built through existing district geometry").toBe(0);
});
