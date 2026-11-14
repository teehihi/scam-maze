import * as THREE from 'three';
import type { Physics } from './physics';

export interface Interactable { obj: THREE.Object3D; label: () => string; act: () => void; dist?: number }

export class Interactions {
  list: Interactable[] = [];
  private roots: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private v = new THREE.Vector3();
  add(i: Interactable) { this.list.push(i); this.roots.push(i.obj); i.obj.userData.interactable = i; }
  pick(cam: THREE.Camera, phys: Physics, maxDist = 2.7): Interactable | null {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), cam);
    this.ray.far = maxDist;
    const cand: THREE.Object3D[] = [];
    cam.getWorldPosition(this.v);
    for (let i = 0; i < this.list.length; i++) {
      const o = this.roots[i]; o.getWorldPosition(_p);
      if (_p.distanceToSquared(this.v) < 36) cand.push(o);
    }
    if (!cand.length) return null;
    const hits = this.ray.intersectObjects(cand, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object, it: Interactable | undefined;
      while (o && !it) { it = o.userData.interactable; o = o.parent; }
      if (!it || h.distance > (it.dist ?? maxDist)) continue;
      const p = h.point, e = this.v;
      const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
      if (phys.blocked(e.x, e.y, e.z, e.x + dx * 0.93, e.y + dy * 0.93, e.z + dz * 0.93)) continue;
      return it;
    }
    return null;
  }
}
const _p = new THREE.Vector3();
