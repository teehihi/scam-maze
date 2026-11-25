import { describe, expect, it } from "vitest";
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

describe("the market versus the carriageway that was already there", () => {
  it("measures the real asphalt", () => {
    const scene = new T.Scene();
    buildStreet(scene, false);
    // The carriageway is the largest horizontal plane in the street, at y = 0.
    let best: { minX: number; maxX: number; minZ: number; maxZ: number; area: number } | null = null;
    const v = new T.Vector3();
    scene.traverse((o: any) => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      const b = new T.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      const sz = b.getSize(new T.Vector3());
      if (Math.abs(sz.y) > 0.05) return;
      const area = sz.x * sz.z;
      if (!best || area > best.area) best = { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z, area };
      void v;
    });
    console.log("LARGEST HORIZONTAL PLANE IN THE STREET (the carriageway):");
    console.log(`  x ${best!.minX.toFixed(2)} .. ${best!.maxX.toFixed(2)}`);
    console.log(`  z ${best!.minZ.toFixed(2)} .. ${best!.maxZ.toFixed(2)}`);
    console.log(`  area ${best!.area.toFixed(0)} m2`);
    expect(best).not.toBeNull();
  });

  it("shows what a camera at the shelter actually sees", () => {
    // Render the same frame the sightline test renders, but dump the triangle count that reached
    // the rasteriser. If it is near zero, the geometry is not where the camera is looking.
    const scene = new T.Scene();
    const streamer = { register: () => undefined, getZone: () => ({}) } as any;
    const d = buildSaigonDistricts(scene, streamer, false);
    const market = d.root.getObjectByName("ChoLonMarket")!;
    let n = 0;
    const v = new T.Vector3();
    market.traverse((o: any) => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      const step = 3;
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.x > -1 && v.x < 4 && v.z > -130 && v.z < -123) n++;
      }
    });
    console.log(`market vertices in the box x -1..4, z -130..-123: ${n}`);
  });

  it("reports what fraction of the market stands on it", () => {
    const street = new T.Scene();
    buildStreet(street, false);
    let road: T.Box3 | null = null;
    street.traverse((o: any) => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox();
      const b = new T.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      const sz = b.getSize(new T.Vector3());
      if (Math.abs(sz.y) > 0.05) return;
      if (!road || sz.x * sz.z > road.getSize(new T.Vector3()).x * road.getSize(new T.Vector3()).z) road = b.clone();
    });

    const scene = new T.Scene();
    const streamer = { register: () => undefined, getZone: () => ({}) } as any;
    const d = buildSaigonDistricts(scene, streamer, false);
    const market = d.root.getObjectByName("ChoLonMarket")!;

    let on = 0, total = 0;
    const v = new T.Vector3();
    market.traverse((o: any) => {
      if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i += 2) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v.y < 0.35) continue;
        total++;
        // 2D test: the carriageway is a plane with no thickness, so a 3D containment test can never
        // succeed. What matters is whether the footprint is over the asphalt.
        if (v.x > road!.min.x && v.x < road!.max.x && v.z > road!.min.z && v.z < road!.max.z) on++;
      }
    });
    // THE GATE. `simulation/street.ts` draws Lý Thái Tổ at x -12.56..-0.24. Anything of this chunk
    // standing on that span is the market built in the road, which is exactly what it was doing for
    // three rounds: 53%, then 38.6%, 29.3%, 0.8%, 0.1% — each step found by this audit, not by eye.
    console.log(`market geometry ABOVE THE GROUND and over the carriageway: ${on} of ${total} (${((on / total) * 100).toFixed(1)}%)`);

    // Where exactly, so the answer is a place and not a percentage.
    const cols = new Map<number, number>();
    const v2 = new T.Vector3();
    market.traverse((o: any) => {
      if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i += 2) {
        v2.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v2.y < 0.35) continue;
        if (!(v2.x > road!.min.x && v2.x < road!.max.x && v2.z > road!.min.z && v2.z < road!.max.z)) continue;
        const k = Math.round(v2.x);
        cols.set(k, (cols.get(k) ?? 0) + 1);
      }
    });
    // POSITIVE CONTROL: a point I know is on the road must register. If this prints 0, the test is
    // broken, not the world.
    const probe = new T.Vector3(-6.4, 1.0, -128);
    const probeOnRoad = probe.x > road!.min.x && probe.x < road!.max.x && probe.z > road!.min.z && probe.z < road!.max.z;
    // WHO owns the offending vertices? Name the object, not just the column.
    const owners = new Map<string, number>();
    const v3 = new T.Vector3();
    market.traverse((o: any) => {
      if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
      const pos = o.geometry.getAttribute("position");
      if (!pos) return;
      for (let i = 0; i < pos.count; i += 2) {
        v3.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (v3.y < 0.35) continue;
        if (!(v3.x > road!.min.x && v3.x < road!.max.x && v3.z > road!.min.z && v3.z < road!.max.z)) continue;
        const k = `${o.name || o.type} y${v3.y.toFixed(1)} z${v3.z.toFixed(0)}`;
        owners.set(k, (owners.get(k) ?? 0) + 1);
      }
    });
    console.log("on the asphalt, by object and height:");
    for (const [k, n] of [...owners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${n}  ${k}`);
    console.log("hits by x column:");
    for (const x of [...cols.keys()].sort((a, b) => a - b)) console.log(`  x=${x}  n=${cols.get(x)}`);
    console.log(`control point over the asphalt: ${probeOnRoad}`);
    expect(probeOnRoad, "the control point must register, or this audit is measuring nothing").toBe(true);
    expect(total).toBeGreaterThan(0);
    expect(on, "the market is standing in the carriageway").toBe(0);
  });
});
