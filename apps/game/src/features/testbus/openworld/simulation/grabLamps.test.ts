import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as T from "three";
import { describe, expect, it } from "vitest";
import { GRAB_HEADLAMP, GRAB_TAILLAMP } from "./grabDriver";
import { addHeadlightBeam, attachDynamicLamps, mountRoundLamp, setVehicleLightLevel } from "./vehicleLights";

/** A body-only stand-in for the Grab scooter: a chassis box and a steering bone, no lamp meshes. */
function grabLikeRig() {
  const obj = new T.Group();
  const chassis = new T.Bone();
  chassis.name = GRAB_TAILLAMP.bone;
  const steering = new T.Bone();
  steering.name = GRAB_HEADLAMP.bone;
  steering.position.set(0, 0.942, 0.335);
  const body = new T.Mesh(new T.BoxGeometry(0.4, 0.8, 1.8), new T.MeshStandardMaterial({ name: "HondaWave_PBR" }));
  body.position.set(0, 0.5, 0);
  obj.add(chassis, steering, body);
  const holder = new T.Group();
  holder.add(obj);
  return { holder, obj, steering, chassis };
}

describe("Grab round lamps", () => {
  it("mounts a non-box lens on the steering bone that follows the night level", () => {
    const { holder, obj, steering } = grabLikeRig();
    const lens = mountRoundLamp(steering, {
      role: "head",
      name: "GrabHeadlamp",
      position: new T.Vector3(...GRAB_HEADLAMP.position),
      radius: GRAB_HEADLAMP.radius,
      depth: GRAB_HEADLAMP.depth,
      facing: new T.Vector3(0, 0, 1),
    });
    expect(lens.parent).toBe(steering);
    expect(lens.geometry).not.toBeInstanceOf(T.BoxGeometry);
    const mat = lens.material as T.MeshStandardMaterial;
    expect(mat.emissiveMap).toBeNull();

    setVehicleLightLevel(0, 0);
    const day = mat.emissiveIntensity;
    setVehicleLightLevel(1, 0);
    expect(mat.emissiveIntensity).toBeGreaterThan(day + 3);
    setVehicleLightLevel(0, 0);

    const dyn = attachDynamicLamps(holder, 0.44, 1.04, true);
    const names: string[] = [];
    holder.traverse((o) => names.push(o.name));
    expect(names).not.toContain("FlushHeadlight");
    expect(typeof dyn.setBrake).toBe("function");

    addHeadlightBeam(holder, obj, new T.Vector3(0, 0, 1), "moto");
    expect(holder.getObjectByName("HeadlightBeam")).toBeTruthy();

    // Turning the handlebar moves the lens in world space.
    holder.updateMatrixWorld(true);
    const before = lens.getWorldPosition(new T.Vector3());
    steering.rotation.y = 0.5;
    holder.updateMatrixWorld(true);
    expect(lens.getWorldPosition(new T.Vector3()).distanceTo(before)).toBeGreaterThan(0.001);
  });

  it("tail lens is driven by the brake light and replaces the flat tail box", () => {
    const { holder, chassis } = grabLikeRig();
    const lens = mountRoundLamp(chassis, {
      role: "tail",
      name: "GrabTaillamp",
      position: new T.Vector3(...GRAB_TAILLAMP.position),
      radius: GRAB_TAILLAMP.radius,
      depth: GRAB_TAILLAMP.depth,
      facing: new T.Vector3(0, 0, -1),
    });
    const dyn = attachDynamicLamps(holder, 0.44, 1.04, true);
    expect(holder.getObjectByName("FlushTailLamp")).toBeUndefined();
    // attachDynamicLamps clones the lens material per vehicle; read the one now on the mesh.
    const bound = lens.material as T.MeshStandardMaterial;
    dyn.setBrake(0);
    const idle = bound.emissiveIntensity;
    dyn.setBrake(1);
    expect(bound.emissiveIntensity).toBeGreaterThan(idle + 3);
    expect(bound.name).toContain("_lamp_tail");
  });

  it("lamp constants lie on the real GLB cowl and rear tip", () => {
    const file = resolve(__dirname, "../../../../../public/assets/testbus/ow/models/grab-driver.optimized.glb");
    const buf = readFileSync(file);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
    const byName = new Map<string, { translation?: number[] }>(json.nodes.map((n: { name: string }) => [n.name, n]));
    expect(byName.has(GRAB_HEADLAMP.bone)).toBe(true);
    expect(byName.has(GRAB_TAILLAMP.bone)).toBe(true);
    // Cowl front face z = 0.093 and y range -0.042..0.063 (measured in the steering frame).
    const [x, y, z] = GRAB_HEADLAMP.position;
    expect(x).toBe(0);
    expect(y).toBeGreaterThan(-0.042);
    expect(y).toBeLessThan(0.063);
    expect(z + GRAB_HEADLAMP.depth).toBeGreaterThan(0.093);
    expect(z).toBeLessThan(0.093);
    // Rear carrier tip z = -0.94, y 0.42..0.56.
    const [, ty, tz] = GRAB_TAILLAMP.position;
    expect(ty).toBeGreaterThan(0.42);
    expect(ty).toBeLessThan(0.56);
    expect(tz).toBeGreaterThan(-0.94);
    expect(tz - GRAB_TAILLAMP.depth).toBeLessThan(-0.94);
  });
});
