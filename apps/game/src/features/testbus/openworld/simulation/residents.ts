import {warmSkin} from "./drive-look";
import { streetClips } from "./streetClips";
import { actorDetail } from "./detail";
import type { Solid } from "./boarding";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  disposeScene,
  contact,
  contactMaterial,
  rounded,
  material,
  tube,
} from "./scene-kit";
import { type BusRouteController } from "./transit";
import type { SaigonTrafficManager, SmartPedestrianAgent } from "../traffic";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const names = [
  "npc-alice",
  "npc-alan",
  "npc-sofia",
  "npc-nguoigia",
  "manvn",
  "juno3",
  "rowan",
  "banhmi-vendor",
  "npc-arthur",
  "npc-freya",
  "npc-linmei",
  "npc-napole",
  "npc-yoshida",
  "npc-archetype",
  "npc-blackguy",
];
const places = [
  [2.7, -2.9],
  [2.7, 2.9],
  [1.3, -1.3],
  [3.44, 0.27],
  [1, -15],
  [-14, -4],
  [2.5, 15],
  [4.2, -17],
  [-13, 9],
  [2, -33],
  [2.7, -129],
  [1.1, -134],
  [-13, -111],
  [-13.2, -44],
  [1.35, -140],
];
export function castStreet(
  scene: T.Scene,
  bus: T.Group,
  route: BusRouteController,
  onChange: () => void,
  onCore: () => void,
  solids: Solid[],
  trafficMgr?: SaigonTrafficManager,
) {
  let disposed = false;
  const details: Awaited<ReturnType<typeof actorDetail>>[] = [];
  const others: T.Group[] = [];
  const shadow = contactMaterial(0.53);
  const actors: ((dt: number, t: number, cam: T.Vector3) => void)[] = [];
  async function load(file: string, height: number, parent: T.Object3D) {
    const data = await loader
      .loadAsync(`/assets/testbus/ow/models/${file}.glb`)
      .catch((error) => {
        console.warn(`Skipping unavailable street asset ${file}`, error);
        return null;
      });
    if (!data) return;
    if (disposed) {
      disposeScene(data.scene);
      return;
    }
    const clips = await streetClips(file, data.scene, data.animations);
    if (disposed) {
      disposeScene(data.scene);
      return;
    }
    const root = new T.Group(),
      obj = data.scene;
    const bounds = new T.Box3().setFromObject(obj, true);
    const scale = height / (bounds.max.y - bounds.min.y);
    obj.scale.multiplyScalar(scale);
    obj.position.set(
      (-(bounds.max.x + bounds.min.x) * scale) / 2,
      -bounds.min.y * scale,
      (-(bounds.max.z + bounds.min.z) * scale) / 2,
    );
    root.add(obj);
    parent.add(root);
    root.updateMatrixWorld(true);
    obj.traverse((n) => {
      if (n instanceof T.Mesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        if(n.name==='HumanBody')for(const m of Array.isArray(n.material)?n.material:[n.material])if(m instanceof T.MeshStandardMaterial)warmSkin(m);
      }
    });
    onChange();
    return { root, obj, data, clips, height };
  }
  function aim(obj: T.Object3D, a: string, b: string, to: T.Vector3) {
    const bone = obj.getObjectByName(a),
      child = obj.getObjectByName(b);
    if (!bone || !child || !bone.parent) return;
    const q = bone.parent.getWorldQuaternion(new T.Quaternion()).invert(),
      dir = child
        .getWorldPosition(new T.Vector3())
        .sub(bone.getWorldPosition(new T.Vector3()))
        .normalize()
        .applyQuaternion(q);
    bone.quaternion.premultiply(
      new T.Quaternion().setFromUnitVectors(
        dir,
        to.normalize().applyQuaternion(q),
      ),
    );
    bone.updateMatrixWorld(true);
  }
  const task = async () => {
    const driver = await load("taixe", 1.6, bus);
    if (driver) {
      driver.root.rotation.y = Math.PI;
      const hip = driver.obj.getObjectByName("Hips"),
        head = driver.obj.getObjectByName("Neck"),
        arm = driver.obj.getObjectByName("Elbow1");
      driver.obj.scale.setScalar(1.39);
      driver.root.updateWorldMatrix(true, true);
      if (hip) {
        const local = bus.worldToLocal(hip.getWorldPosition(new T.Vector3()));
        driver.root.position.set(-0.65, 1.105, -4.61).sub(local);
      }
      const rest = arm?.rotation.x ?? 0;
      actors.push((_dt, t) => {
        if (head)
          head.rotation.y =
            0.15 * Math.sin(t * 0.51) + (route.doors.front.target ? 0.27 : 0);
        if (arm) arm.rotation.x = rest + 0.1 * Math.sin(t * 0.72);
      });
    }
    for (let i = 0; i < names.length && !disposed; i++) {
      const actor = await load(
        names[i] + ".optimized",
        1.62 + (i % 4) * 0.045,
        scene,
      );
      if (!actor) {
        if (i === 3) onCore();
        continue;
      }
      const { root, obj, data, clips: streetSet, height: actorHeight } = actor;
      const [x, z] = places[i],
        crosswalkWalker = Boolean(trafficMgr) && (i === 12 || i === 14),
        walker = i === 4 || i === 5 || i === 6 || crosswalkWalker,
        seated = i === 3,
        queue = i === 0 || i === 2;
      for (const [side, s] of [
        ["l", 1],
        ["r", -1],
      ] as const) {
        aim(
          obj,
          "upperarm_" + side,
          "lowerarm_" + side,
          new T.Vector3(s * 0.17, -1, 0.03),
        );
        aim(
          obj,
          "lowerarm_" + side,
          "hand_" + side,
          new T.Vector3(-s * 0.12, -0.9, 0.38),
        );
        if (seated) {
          aim(
            obj,
            "thigh_" + side,
            "calf_" + side,
            new T.Vector3(s * 0.1, -0.13, 0.98),
          );
          aim(obj, "calf_" + side, "foot_" + side, new T.Vector3(0, -1, -0.14));
        }
      }
      const held = i === 3 || i === 2 ? new T.Group() : null,
        hand = obj.getObjectByName("hand_r"),
        handPos = new T.Vector3();
      if (held) {
        root.add(held);
        if (seated) {
          aim(obj, "lowerarm_r", "hand_r", new T.Vector3(-0.29, 0.35, 0.9));
          rounded(
            held,
            [0, 0, 0],
            [0.077, 0.14, 0.014],
            0.008,
            material(0x232931),
          );
          rounded(
            held,
            [0, 0, 0.009],
            [0.068, 0.123, 0.002],
            0.003,
            material(0x6c9095),
          );
          held.rotation.x = -0.33;
        } else {
          rounded(
            held,
            [0, -0.25, 0],
            [0.22, 0.27, 0.095],
            0.021,
            material(0x96532d),
          );
          tube(
            held,
            [
              [-0.07, -0.12, 0],
              [-0.06, -0.045, 0],
              [0, -0.018, 0],
              [0.06, -0.045, 0],
              [0.07, -0.12, 0],
            ],
            0.008,
            material(0x584435),
            9,
          );
        }
      }
      const feetShadow = contact(
        root,
        0,
        seated ? 0.398 : 0.01,
        0,
        0.72,
        0.5,
        shadow,
      );
      feetShadow.renderOrder = 1;
      root.position.set(x, seated ? -0.23 : 0.16, z);
      root.rotation.y = seated ? -Math.PI / 2 : -1.8 + (i % 3) * 0.34;
      const detail = await actorDetail(obj);
      if (disposed) {
        detail.dispose();
        return;
      }
      details.push(detail);
      others.push(root);
      let walkZ = z,
        walkSide = 1;
      const thigh = ["thigh_l", "thigh_r"].map((k) => obj.getObjectByName(k)),
        neutral = thigh.map((b) => b?.rotation.x ?? 0);
      let mixer: T.AnimationMixer | undefined;
      let walkAction: T.AnimationAction | undefined;
      const walkClipSpeed = streetSet.walkSpeedAt(actorHeight);
      // Walkers borrow a retargeted walk when their file has none; everyone else keeps their own pose / idle.
      const clip = walker ? streetSet.walk : data.animations.find((a) => /idle/i.test(a.name));
      if (clip) {
        mixer = new T.AnimationMixer(obj);
        const action = mixer.clipAction(clip);
        walkAction = action;
        if (walker) action.timeScale = 0.72 / walkClipSpeed;
        action.play();
        action.time = clip.duration * ((i * 0.618) % 1);
      }
      // Register walkers with the unified Social Force + Crosswalk PedestrianBrain!
      let smartPed: SmartPedestrianAgent | null = null;
      if (walker && trafficMgr) {
        const patrolZMin = i === 12 ? -104 : i === 14 ? -152 : z - 7;
        const patrolZMax = i === 12 ? -88 : i === 14 ? -138 : z + 7;
        smartPed = trafficMgr.pedestrians.registerSidewalkWalker({
          id: `LTT_PED_${i}`,
          x,
          z: i === 12 ? -95.2 : i === 14 ? -145.5 : z,
          patrolZMin,
          patrolZMax,
          baseSpeed: crosswalkWalker ? 1.05 : 0.78,
          canCross: crosswalkWalker,
          seed: i + 1,
        });
      }
      const head = obj.getObjectByName("head"),
        chest = obj.getObjectByName("spine_03");
      const q = head?.quaternion.clone(),
        rest = chest?.quaternion.clone(),
        rot = new T.Quaternion(),
        axis = new T.Vector3(0, 1, 0);
      let approach = 0;
      if (i === 3) onCore();
      actors.push((dt, t, cam) => {
        if (queue && route.phase === "approaching") approach = 0;
        if (queue) {
          const active =
            route.phase === "boarding" && route.doors.front.passable;
          approach = T.MathUtils.clamp(
            approach + ((active ? 1 : 0) * dt) / (i === 0 ? 8 : 12),
            0,
            1,
          );
          const f = T.MathUtils.smoothstep(approach, 0, 1);
          root.position.x = T.MathUtils.lerp(x, -0.63, f);
          root.position.z = T.MathUtils.lerp(z, -4.44, Math.min(1, f * 2));
          root.position.y = 0.16 + 0.46 * Math.max(0, (f - 0.8) * 5);
          if (approach >= 1) {
            root.position.set(route.x + 0.11, 0.62, route.z - 3.12 + i * 0.48);
            root.rotation.y = Math.PI;
          } else if (active) {
            root.rotation.y = -Math.PI / 2;
            thigh.forEach((bone, j) => {
              if (bone)
                bone.rotation.x =
                  neutral[j] + 0.22 * Math.sin(t * 5 + j * Math.PI);
            });
          }
        }
        if (walker) {
          if (smartPed) {
            root.position.x = smartPed.x;
            root.position.z = smartPed.z;
            // Smooth curb step-down when crossing asphalt roadway (x ∈ [-12.6, -0.2]) vs sidewalk (0.16)
            const onRoad = smartPed.x > -12.6 && smartPed.x < -0.2;
            const targetY = onRoad ? 0.0 : 0.16;
            root.position.y += (targetY - root.position.y) * Math.min(1, dt * 10);
            root.rotation.y = smartPed.yaw;
            if (walkAction) {
              // Feet stay planted: freeze stride when waiting at red light curb, hurry up on flashing green!
              walkAction.timeScale = smartPed.speed > 0.08 ? smartPed.speed / walkClipSpeed : 0.0;
            }
          } else {
            const next = walkZ + walkSide * 0.72 * dt;
            if (Math.abs(next - z) > 7) walkSide *= -1;
            let lane = x;
            for (const r of solids) {
              if (
                next > r.z0 - 0.5 &&
                next < r.z1 + 0.5 &&
                lane > r.x0 - 0.33 &&
                lane < r.x1 + 0.33
              )
                lane =
                  Math.abs(lane - r.x0) < Math.abs(lane - r.x1)
                    ? r.x0 - 0.48
                    : r.x1 + 0.48;
            }
            for (const n of others) {
              if (
                n !== root &&
                Math.abs(n.position.z - next) < 0.9 &&
                Math.abs(n.position.x - lane) < 0.49
              )
                lane += n.position.x > lane ? -0.48 : 0.48;
            }
            root.position.x = T.MathUtils.damp(root.position.x, lane, 5, dt);
            walkZ += walkSide * 0.72 * dt;
            root.position.z = walkZ;
            root.rotation.y = walkSide > 0 ? 0 : Math.PI;
          }
        }
        const distance = root.position.distanceTo(cam);
        root.visible = distance < 52;
        detail.update(distance);
        if (!root.visible) return;
        mixer?.update(dt);
        if (held && hand) {
          root.worldToLocal(hand.getWorldPosition(handPos));
          held.position.copy(handPos);
        }
        if (head && q)
          head.quaternion
            .copy(q)
            .multiply(
              rot.setFromAxisAngle(axis, 0.16 * Math.sin(t * 0.59 + i * 1.31)),
            );
        if (chest && rest)
          chest.quaternion
            .copy(rest)
            .multiply(
              rot.setFromAxisAngle(axis, 0.025 * Math.sin(t * 0.87 + i)),
            );
      });
    }
    for (const [name, h, x, z] of [
      ["bike-pcx", 1.12, 4.4, -9],
      ["bike-supercub", 1.02, 4.0, 8],
      ["table-set", 0.72, 4.4, -19],
    ] as const) {
      const prop = await load(name + ".optimized", h, scene);
      if (prop) {
        prop.root.position.set(x, 0.16, z);
        prop.root.rotation.y = -0.95;
      }
    }
  };
  task().catch((e) => {
    console.error("Street cast:", e);
    onCore();
  });
  return {
    update(dt: number, t: number, cam: T.Vector3) {
      actors.forEach((f) => f(dt, t, cam));
    },
    dispose() {
      disposed = true;
      details.forEach((d) => d.dispose());
      actors.length = 0;
    },
  };
}
