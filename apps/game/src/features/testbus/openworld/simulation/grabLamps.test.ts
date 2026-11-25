import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as T from "three";
import { describe, expect, it } from "vitest";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, getBounds } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { GRAB_HEADLAMP, GRAB_TAILLAMP } from "./grabDriver";
import { addHeadlightBeam, attachDynamicLamps, mountGrabLamps, mountRoundLamp, setVehicleLightLevel } from "./vehicleLights";

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
    // The mounted original is not in the global night list: only the per-vehicle clone is updated.
    const original = lens.material as T.MeshStandardMaterial;
    const before = original.emissiveIntensity;
    setVehicleLightLevel(1, 0);
    expect(original.emissiveIntensity).toBe(before);
    setVehicleLightLevel(0, 0);
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

  it("mountGrabLamps puts the lenses on the real GLB cowl and rear tip", async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const file = resolve(__dirname, "../../../../../public/assets/testbus/ow/models/grab-driver.optimized.glb");
    const doc = await io.readBinary(new Uint8Array(readFileSync(file)));
    await doc.transform(dequantize());
    const nodes = doc.getRoot().listNodes();
    const steeringNode = nodes.find((n) => n.getName() === GRAB_HEADLAMP.bone)!;
    const chassisNode = nodes.find((n) => n.getName() === GRAB_TAILLAMP.bone)!;
    expect(steeringNode).toBeDefined();
    expect(chassisNode).toBeDefined();

    // Rebuild the two bones with their real world transforms, then run the production wiring on them.
    const root = new T.Group();
    const bone = (name: string, world: number[]) => {
      const b = new T.Bone();
      b.name = name;
      b.matrixAutoUpdate = false;
      b.matrix.fromArray(world);
      root.add(b);
      return b;
    };
    bone(GRAB_HEADLAMP.bone, steeringNode.getWorldMatrix());
    bone(GRAB_TAILLAMP.bone, chassisNode.getWorldMatrix());
    const { head, tail } = mountGrabLamps(root);
    expect(head).not.toBeNull();
    expect(tail).not.toBeNull();
    expect(head!.parent!.name).toBe(GRAB_HEADLAMP.bone);
    expect(tail!.parent!.name).toBe(GRAB_TAILLAMP.bone);
    root.updateMatrixWorld(true);
    const h = head!.getWorldPosition(new T.Vector3());
    const t = tail!.getWorldPosition(new T.Vector3());

    // The cowl is the mesh under the steering bone; the lens must sit inside its box and bulge past its front face.
    const cowl = getBounds(steeringNode);
    expect(h.y).toBeGreaterThan(cowl.min[1]);
    expect(h.y).toBeLessThan(cowl.max[1]);
    expect(h.x).toBeGreaterThan(cowl.min[0]);
    expect(h.x).toBeLessThan(cowl.max[0]);
    expect(h.z).toBeLessThan(cowl.max[2]);
    expect(h.z + GRAB_HEADLAMP.depth).toBeGreaterThan(cowl.max[2]);
    // The rear tip of the whole scooter: the tail lens sits on it and bulges past it.
    const body = getBounds(chassisNode);
    expect(t.z).toBeGreaterThan(body.min[2]);
    expect(t.z - GRAB_TAILLAMP.depth).toBeLessThan(body.min[2]);
    expect(t.y).toBeGreaterThan(body.min[1]);
    expect(t.y).toBeLessThan(body.max[1]);
  });

  it("loadGrabDrivers mounts its lamps through mountGrabLamps", () => {
    const src = readFileSync(resolve(__dirname, "../world/saigonDistricts.ts"), "utf8");
    const loader = src.slice(src.indexOf("const loadGrabDrivers"));
    expect(loader).toMatch(/mountGrabLamps\(obj\)/);
  });
});
