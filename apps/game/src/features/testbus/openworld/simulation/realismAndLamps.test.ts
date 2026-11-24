import * as T from "three";
import { describe, expect, it, vi } from "vitest";
import { createHumanPresenceSystem } from "./humanPresence";
import { softClamp, upgradeHumanMaterials } from "./humanRealism";
import { attachDynamicLamps, markLampParts } from "./vehicleLights";

describe("GTA-6 human realism & model-bonded vehicle lights", () => {
  it("softClamp stays linear inside softStart and asymptotically bounded below limit", () => {
    expect(softClamp(0.4, 1.0, 0.7)).toBeCloseTo(0.4, 6);
    expect(softClamp(0.85, 1.0, 0.7)).toBeLessThan(1.0);
    expect(softClamp(5.0, 1.0, 0.7)).toBeLessThan(1.0);
    expect(softClamp(-5.0, 1.0, 0.7)).toBeGreaterThan(-1.0);
  });

  it("upgradeHumanMaterials removes metallic=1 statue bug on baked human meshes", () => {
    const group = new T.Group();
    const bakedMat = new T.MeshStandardMaterial({ name: "baked", roughness: 1.0, metalness: 1.0 });
    const skinMat = new T.MeshStandardMaterial({ name: "HumanBody", roughness: 0.25, metalness: 0.4 });
    const m1 = new T.Mesh(new T.BoxGeometry(0.4, 1.7, 0.3), bakedMat);
    const m2 = new T.Mesh(new T.BoxGeometry(0.4, 1.7, 0.3), skinMat);
    m2.name = "HumanBody";
    group.add(m1, m2);

    upgradeHumanMaterials(group);

    expect(bakedMat.metalness).toBeLessThan(0.1);
    expect(skinMat.metalness).toBe(0);
    expect(skinMat.roughness).toBeGreaterThanOrEqual(0.5);
  });

  it("markLampParts splits native GLB lamp meshes into head, tail, and left/right signals with zero detached boxes", () => {
    const host = new T.Group();
    const car = new T.Group();
    host.add(car);

    const body = new T.Mesh(new T.BoxGeometry(1.8, 1.2, 4.2), new T.MeshStandardMaterial({ name: "Paint" }));
    body.position.set(0, 0.8, 0);
    car.add(body);

    // Native GLB Signal mesh (like mula_van.glb `Signal`) spanning both left (+X) and right (-X) corners.
    const signalMesh = new T.Mesh(
      new T.BoxGeometry(1.5, 0.12, 0.08),
      new T.MeshStandardMaterial({ name: "Signal" }),
    );
    signalMesh.position.set(0, 0.65, 2.08);
    car.add(signalMesh);

    const stopMesh = new T.Mesh(
      new T.BoxGeometry(1.4, 0.16, 0.08),
      new T.MeshStandardMaterial({ name: "Stop" }),
    );
    stopMesh.position.set(0, 0.85, -2.08);
    car.add(stopMesh);

    const headMesh = new T.Mesh(
      new T.BoxGeometry(1.4, 0.16, 0.08),
      new T.MeshStandardMaterial({ name: "Lights" }),
    );
    headMesh.position.set(0, 0.85, 2.08);
    car.add(headMesh);

    const result = markLampParts(host, car, new T.Vector3(0, 0, 1));
    expect(result.head).toBe(true);

    const beforeCount = host.children.length;
    const dyn = attachDynamicLamps(host, 0.9, 2.1, false);
    // Zero detached fallback boxes added because native Signal & Stop meshes already exist on the model!
    expect(host.children.length).toBe(beforeCount);

    dyn.setBrake(1);
    dyn.setBlinker(-1, true);
    let foundLeftSignalLit = false;
    host.traverse((o) => {
      if (o instanceof T.Mesh && o.material instanceof T.MeshStandardMaterial) {
        if (o.material.name.endsWith("_lamp_signal_left") && o.material.emissiveIntensity > 3) {
          foundLeftSignalLit = true;
        }
      }
    });
    expect(foundLeftSignalLit).toBe(true);
  });

  it("attachDynamicLamps snaps flush lenses onto real bodywork surfaces for single-atlas motorbikes", () => {
    const chassis = new T.Group();
    const fairing = new T.Mesh(
      new T.BoxGeometry(0.56, 0.72, 1.8),
      new T.MeshStandardMaterial({ name: "PaletteMaterial001" }),
    );
    fairing.position.set(0, 0.78, 0);
    chassis.add(fairing);

    const dyn = attachDynamicLamps(chassis, 0.44, 1.04, true);
    dyn.setBrake(0.8);
    dyn.setBlinker(1, true);

    const flushLamps: T.Mesh[] = [];
    chassis.traverse((o) => {
      if (o instanceof T.Mesh && o.name.startsWith("Flush")) flushLamps.push(o);
    });
    expect(flushLamps.length).toBeGreaterThanOrEqual(4);
    // Every flush lamp must sit ON the real fairing bounds (|x| <= 0.32, |z| <= 0.94), NOT floating out at ±1.04!
    for (const lamp of flushLamps) {
      expect(Math.abs(lamp.position.x)).toBeLessThanOrEqual(0.32);
      expect(Math.abs(lamp.position.z)).toBeLessThanOrEqual(0.94);
    }
  });

  it("blocks player from walking through any human and triggers shoulder-bump recoil & street reaction", () => {
    const presence = createHumanPresenceSystem();
    const npcObj = new T.Group();
    npcObj.position.set(4.0, 0.16, -10.0);
    npcObj.updateMatrixWorld(true);

    const onBump = vi.fn();
    const onPersonalSpace = vi.fn();
    presence.register({
      id: "resident_0",
      label: { en: "Passerby", vi: "Người đi bộ" },
      object: npcObj,
      radius: 0.34,
      onBump,
      onPersonalSpace,
    });

    // Attempt to walk straight into the NPC's chest (dist = 0.20m < 0.26 + 0.34 = 0.60m)
    const col = presence.resolvePlayerCollision(4.0, -9.8, 0.16, 0.26, 4.2, 5.0, 0.016);
    expect(col.hitHuman).toBe(true);
    expect(col.bumped).toBe(true);
    // Player is cleanly pushed outside the solid 0.60m combined radius!
    expect(Math.hypot(col.x - 4.0, col.z + 10.0)).toBeGreaterThanOrEqual(0.6);
    expect(onBump).toHaveBeenCalledTimes(1);
    expect(col.reaction?.kind).toBe("bump");
    expect(col.reaction?.text.vi.length).toBeGreaterThan(5);

    // Standing awkwardly close (0.9m) for >2.4s triggers personal-space awareness & reaction!
    for (let step = 0; step < 30; step++) {
      presence.resolvePlayerCollision(4.0, -9.1, 0.16, 0.26, 0, 10 + step * 0.1, 0.1);
    }
    expect(onPersonalSpace).toHaveBeenCalled();
    expect(presence.getActiveReaction(13.5)?.kind).toBe("personal_space");
  });
});
