import * as THREE from 'three';
import type { House } from './house';

/**
 * Size- and distance-based culling for the neighborhood's many small meshes.
 *
 * - A mesh is not drawn when it would be smaller than about 2-3 pixels on screen
 *   (`radius * sizeFactor < distance`): eyes beyond ~5 m, light switches beyond ~20 m.
 * - Small fittings inside a house (switches, curtain rings, knobs) are not drawn while the camera
 *   is outside that house and more than a few meters away; through a window they are invisible.
 * - Pieces under 10 m cast sun shadows only within a reach that grows with their size.
 *
 * Culled meshes move to a camera layer that is never rendered, so this never fights the code that
 * shows and hides people and devices with `visible`. Interaction raycasts are unaffected.
 */
const CULLED_LAYER = 5;

/** Above this radius (m) a mesh is never culled. */
const MAX_CULL_RADIUS = 1.2;
/** Meshes under this radius never cast sun shadows (a texel or less in the shadow map). */
const TINY_SHADOW_RADIUS = 0.12;
/** Larger pieces keep their sun shadow always. */
const SHADOW_CULL_RADIUS = 10;
/** Interior fittings under this radius are hidden from outside the house. */
const FITTING_RADIUS = 0.3;
/** ... once the camera is farther than this from them (m). */
const FITTING_DISTANCE = 6;
/** Seconds between the starts of two sweeps. */
const INTERVAL = 0.15;
/** A sweep is spread over this many frames, so no single frame pays for the whole list. */
const SWEEP_FRAMES = 4;

interface Entry {
  mesh: THREE.Object3D;
  center: THREE.Vector3;
  radius: number;
  /** Whether the mesh casts a shadow when it is near. */
  caster: boolean;
  /** House whose interior this mesh belongs to, if any. */
  house: House | null;
  /** Merged small interior parts (staticMerge.mergeDevices): hidden from outside the house like single fittings. */
  fitting: boolean;
}

export class DistanceCuller {
  private entries: Entry[] = [];
  private timer = 0;
  private readonly world = new THREE.Vector3();
  private readonly seen = new Set<THREE.Object3D>();
  private houses: readonly House[] = [];
  /** Next entry of the running sweep, or -1 when no sweep is running. */
  private cursor = -1;
  /** House the camera was in when the running sweep started. */
  private sweepInside: House | null = null;
  /** A mesh is culled beyond `radius * sizeFactor` meters. */
  sizeFactor = 420;
  /** Pieces cast sun shadows within at most this distance (m), plus their own size. */
  shadowDistance = 26;

  /** Collects the meshes under `root`. Safe to call again after more content was added. */
  collect(root: THREE.Object3D, houses: readonly House[] = []): void {
    root.updateMatrixWorld(true);
    if (houses.length) this.houses = houses;
    const houseOf = new Map<THREE.Object3D, House>();
    houses.forEach((h) => houseOf.set(h.group, h));
    const scale = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const visit = (o: THREE.Object3D, house: House | null) => {
      const h = houseOf.get(o) ?? house;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !this.seen.has(mesh)) {
        const material = mesh.material as THREE.Material | THREE.Material[];
        const geometry = mesh.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        const sphere = geometry.boundingSphere;
        if (sphere && (Array.isArray(material) || material.visible !== false)) {
          mesh.matrixWorld.decompose(this.world, q, scale);
          const radius = sphere.radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
          if (radius < TINY_SHADOW_RADIUS) mesh.castShadow = false;
          if (radius < SHADOW_CULL_RADIUS || mesh.userData.interiorFitting) {
            this.seen.add(mesh);
            this.entries.push({ mesh, center: sphere.center.clone(), radius, caster: mesh.castShadow, house: h, fitting: !!mesh.userData.interiorFitting });
          }
        }
      }
      for (const c of o.children) visit(c, h);
    };
    visit(root, null);
  }

  get count(): number {
    return this.entries.length;
  }

  /**
   * Starts a sweep every `INTERVAL` seconds and spreads it over `SWEEP_FRAMES` frames (a quarter
   * of the list per frame). `force` runs a whole sweep at once (warm-up, teleports).
   */
  update(dt: number, eye: THREE.Vector3, force = false): void {
    this.timer -= dt;
    if (force) {
      this.startSweep(eye);
      this.sweep(eye, this.entries.length);
      return;
    }
    if (this.cursor < 0) {
      if (this.timer > 0) return;
      this.startSweep(eye);
    }
    this.sweep(eye, Math.ceil(this.entries.length / SWEEP_FRAMES));
  }

  private startSweep(eye: THREE.Vector3): void {
    this.timer = INTERVAL;
    this.cursor = 0;
    this.sweepInside = null;
    for (const h of this.houses) if (h.contains(eye.x, eye.z)) { this.sweepInside = h; break; }
  }

  /** Processes up to `count` entries of the running sweep (same rules as a full pass). */
  private sweep(eye: THREE.Vector3, count: number): void {
    const inside = this.sweepInside;
    const end = Math.min(this.entries.length, this.cursor + count);
    for (let i = this.cursor; i < end; i++) {
      const entry = this.entries[i];
      this.world.copy(entry.center).applyMatrix4(entry.mesh.matrixWorld);
      const d = this.world.distanceTo(eye);
      if (entry.caster) entry.mesh.castShadow = d <= Math.min(this.shadowDistance, 8 + entry.radius * 40) + entry.radius;
      let culled = false;
      if (entry.fitting) {
        // Distance to the nearest part of the merged mesh, so nothing that a single fitting would show is hidden.
        culled = !!entry.house && entry.house !== inside && d - entry.radius > FITTING_DISTANCE;
      } else if (entry.radius < MAX_CULL_RADIUS) {
        culled = entry.radius * this.sizeFactor < d;
        if (!culled && entry.house && entry.house !== inside && entry.radius < FITTING_RADIUS && d > FITTING_DISTANCE) culled = true;
      }
      const isCulled = entry.mesh.layers.isEnabled(CULLED_LAYER);
      if (culled && !isCulled) entry.mesh.layers.set(CULLED_LAYER);
      else if (!culled && isCulled) entry.mesh.layers.set(0);
    }
    this.cursor = end >= this.entries.length ? -1 : end;
  }

  /** Shows everything again (used by the warm-up frame that uploads every mesh). */
  reset(): void {
    for (const entry of this.entries) {
      entry.mesh.layers.set(0);
      entry.mesh.castShadow = entry.caster;
    }
    this.timer = 0;
    this.cursor = -1;
  }
}
