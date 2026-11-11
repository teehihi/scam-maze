/**
 * SCAMMAZE — Huế Heritage 3D World Collision & Spatial System
 *
 * Implements a high-performance 2D/3D Spatial Hash Grid with analytical
 * cylinder, AABB, and OBB colliders, continuous wall sliding, step-up height
 * logic, and zero-allocation melee raycasting.
 *
 * Pure TypeScript & Three.js math — zero external physics dependencies (Rapier-free).
 */

import * as THREE from 'three';

export interface BaseCollider {
  id: string;
  minY: number;
  maxY: number;
  tag?: string;
  isTrigger?: boolean;
}

export interface CylinderCollider extends BaseCollider {
  type: 'cylinder';
  cx: number;
  cz: number;
  radius: number;
}

export interface BoxCollider extends BaseCollider {
  type: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface OBBCollider extends BaseCollider {
  type: 'obb';
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotY: number;
}

export type HueCollider = CylinderCollider | BoxCollider | OBBCollider;

export interface CollisionResult {
  newX: number;
  newZ: number;
  collided: boolean;
  hitNormalX: number;
  hitNormalZ: number;
  hitCollider?: HueCollider;
}

export interface RayHit {
  hit: boolean;
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  collider?: HueCollider;
}

export class HueCollisionSystem {
  public static readonly CELL_SIZE = 16.0;
  public static readonly MAX_STEP_HEIGHT = 0.45;

  private colliders: HueCollider[] = [];
  private colliderMap = new Map<string, HueCollider>();
  private grid = new Map<number, HueCollider[]>();

  private readonly _tmpResult: CollisionResult = {
    newX: 0,
    newZ: 0,
    collided: false,
    hitNormalX: 0,
    hitNormalZ: 0,
  };

  // Development wireframe debug visualization
  private debugGroup: THREE.Group | null = null;
  private debugActive = false;

  constructor() {}

  private hashCell(cx: number, cz: number): number {
    return ((cx & 0xffff) << 16) | (cz & 0xffff);
  }

  private getBounds(col: HueCollider): { minX: number; maxX: number; minZ: number; maxZ: number } {
    if (col.type === 'cylinder') {
      return {
        minX: col.cx - col.radius,
        maxX: col.cx + col.radius,
        minZ: col.cz - col.radius,
        maxZ: col.cz + col.radius,
      };
    }
    if (col.type === 'box') {
      return {
        minX: col.minX,
        maxX: col.maxX,
        minZ: col.minZ,
        maxZ: col.maxZ,
      };
    }
    // OBB: compute world-space bounding box
    const cos = Math.abs(Math.cos(col.rotY));
    const sin = Math.abs(Math.sin(col.rotY));
    const extentX = col.halfW * cos + col.halfD * sin;
    const extentZ = col.halfW * sin + col.halfD * cos;
    return {
      minX: col.cx - extentX,
      maxX: col.cx + extentX,
      minZ: col.cz - extentZ,
      maxZ: col.cz + extentZ,
    };
  }

  public addCollider(col: HueCollider) {
    if (this.colliderMap.has(col.id)) return;
    this.colliderMap.set(col.id, col);
    this.colliders.push(col);

    const bounds = this.getBounds(col);
    const minCellX = Math.floor(bounds.minX / HueCollisionSystem.CELL_SIZE);
    const maxCellX = Math.floor(bounds.maxX / HueCollisionSystem.CELL_SIZE);
    const minCellZ = Math.floor(bounds.minZ / HueCollisionSystem.CELL_SIZE);
    const maxCellZ = Math.floor(bounds.maxZ / HueCollisionSystem.CELL_SIZE);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = this.hashCell(cx, cz);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(col);
      }
    }
  }

  public addCylinder(
    id: string,
    cx: number,
    cz: number,
    radius: number,
    minY: number,
    maxY: number,
    tag?: string,
  ) {
    this.addCollider({
      type: 'cylinder',
      id,
      cx,
      cz,
      radius,
      minY,
      maxY,
      tag,
    });
  }

  public addBox(
    id: string,
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    minY: number,
    maxY: number,
    tag?: string,
  ) {
    this.addCollider({
      type: 'box',
      id,
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      minY,
      maxY,
      tag,
    });
  }

  public addOBB(
    id: string,
    cx: number,
    cz: number,
    halfW: number,
    halfD: number,
    rotY: number,
    minY: number,
    maxY: number,
    tag?: string,
  ) {
    this.addCollider({
      type: 'obb',
      id,
      cx,
      cz,
      halfW,
      halfD,
      rotY,
      minY,
      maxY,
      tag,
    });
  }

  public getCollidersNear(x: number, z: number, radius: number): HueCollider[] {
    const minCellX = Math.floor((x - radius) / HueCollisionSystem.CELL_SIZE);
    const maxCellX = Math.floor((x + radius) / HueCollisionSystem.CELL_SIZE);
    const minCellZ = Math.floor((z - radius) / HueCollisionSystem.CELL_SIZE);
    const maxCellZ = Math.floor((z + radius) / HueCollisionSystem.CELL_SIZE);

    const candidates: HueCollider[] = [];
    const seen = new Set<string>();

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const key = this.hashCell(cx, cz);
        const cell = this.grid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const col = cell[i];
            if (!seen.has(col.id)) {
              seen.add(col.id);
              candidates.push(col);
            }
          }
        }
      }
    }
    return candidates;
  }

  /**
   * Resolves player circle displacement against environment geometry.
   * Performs continuous wall sliding and honors allowable step-ups (<= 0.45m).
   */
  public resolveMovement(
    currX: number,
    currZ: number,
    targetX: number,
    targetZ: number,
    playerFootY: number,
    playerRadius = 0.35,
    playerHeight = 1.85,
  ): CollisionResult {
    let px = targetX;
    let pz = targetZ;
    let hasCollided = false;
    let lastHitNormalX = 0;
    let lastHitNormalZ = 0;
    let lastHitCollider: HueCollider | undefined;

    const nearby = this.getCollidersNear(
      (currX + targetX) * 0.5,
      (currZ + targetZ) * 0.5,
      playerRadius + 4.0,
    );

    // Iterative relaxation passes for smooth corner and wall sliding
    const maxIterations = 3;
    for (let iter = 0; iter < maxIterations; iter++) {
      let iterCollided = false;

      for (let i = 0; i < nearby.length; i++) {
        const col = nearby[i];
        if (col.isTrigger) continue;

        // Vertical overlap check:
        // If collider's top is within MAX_STEP_HEIGHT above player's feet, allow stepping up!
        if (col.maxY <= playerFootY + HueCollisionSystem.MAX_STEP_HEIGHT) {
          continue;
        }
        // If player is completely above collider or completely below:
        if (playerFootY >= col.maxY || playerFootY + playerHeight <= col.minY) {
          continue;
        }

        // Test horizontal penetration:
        if (col.type === 'cylinder') {
          const dx = px - col.cx;
          const dz = pz - col.cz;
          const distSq = dx * dx + dz * dz;
          const minDist = playerRadius + col.radius;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            let nx = 1;
            let nz = 0;
            if (dist > 0.0001) {
              nx = dx / dist;
              nz = dz / dist;
            }
            const pen = minDist - dist;
            px += nx * pen;
            pz += nz * pen;
            hasCollided = true;
            iterCollided = true;
            lastHitNormalX = nx;
            lastHitNormalZ = nz;
            lastHitCollider = col;
          }
        } else if (col.type === 'box') {
          const clampedX = Math.max(col.minX, Math.min(px, col.maxX));
          const clampedZ = Math.max(col.minZ, Math.min(pz, col.maxZ));

          const dx = px - clampedX;
          const dz = pz - clampedZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < playerRadius * playerRadius) {
            let nx = 0;
            let nz = 0;
            let pen = 0;

            if (distSq > 0.000001) {
              const dist = Math.sqrt(distSq);
              nx = dx / dist;
              nz = dz / dist;
              pen = playerRadius - dist;
            } else {
              // Circle center is inside the box: push out based on the side player came from (currX, currZ)
              if (currX >= col.maxX) {
                nx = 1;
                nz = 0;
                pen = col.maxX + playerRadius - px;
              } else if (currX <= col.minX) {
                nx = -1;
                nz = 0;
                pen = px - (col.minX - playerRadius);
              } else if (currZ >= col.maxZ) {
                nx = 0;
                nz = 1;
                pen = col.maxZ + playerRadius - pz;
              } else if (currZ <= col.minZ) {
                nx = 0;
                nz = -1;
                pen = pz - (col.minZ - playerRadius);
              } else {
                // Already started inside: find shortest exit face
                const dLeft = px - col.minX;
                const dRight = col.maxX - px;
                const dBottom = pz - col.minZ;
                const dTop = col.maxZ - pz;
                const minD = Math.min(dLeft, dRight, dBottom, dTop);

                if (minD === dLeft) {
                  nx = -1;
                  nz = 0;
                  pen = dLeft + playerRadius;
                } else if (minD === dRight) {
                  nx = 1;
                  nz = 0;
                  pen = dRight + playerRadius;
                } else if (minD === dBottom) {
                  nx = 0;
                  nz = -1;
                  pen = dBottom + playerRadius;
                } else {
                  nx = 0;
                  nz = 1;
                  pen = dTop + playerRadius;
                }
              }
            }

            px += nx * pen;
            pz += nz * pen;
            hasCollided = true;
            iterCollided = true;
            lastHitNormalX = nx;
            lastHitNormalZ = nz;
            lastHitCollider = col;
          }
        } else if (col.type === 'obb') {
          // Transform circle into OBB local frame
          const rx = px - col.cx;
          const rz = pz - col.cz;
          const cos = Math.cos(-col.rotY);
          const sin = Math.sin(-col.rotY);
          const localX = rx * cos - rz * sin;
          const localZ = rx * sin + rz * cos;

          const clampedX = Math.max(-col.halfW, Math.min(localX, col.halfW));
          const clampedZ = Math.max(-col.halfD, Math.min(localZ, col.halfD));

          const dx = localX - clampedX;
          const dz = localZ - clampedZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < playerRadius * playerRadius) {
            let localNx = 0;
            let localNz = 0;
            let pen = 0;

            if (distSq > 0.000001) {
              const dist = Math.sqrt(distSq);
              localNx = dx / dist;
              localNz = dz / dist;
              pen = playerRadius - dist;
            } else {
              const dLeft = localX - (-col.halfW);
              const dRight = col.halfW - localX;
              const dBottom = localZ - (-col.halfD);
              const dTop = col.halfD - localZ;
              const minD = Math.min(dLeft, dRight, dBottom, dTop);

              if (minD === dLeft) {
                localNx = -1;
                pen = dLeft + playerRadius;
              } else if (minD === dRight) {
                localNx = 1;
                pen = dRight + playerRadius;
              } else if (minD === dBottom) {
                localNz = -1;
                pen = dBottom + playerRadius;
              } else {
                localNz = 1;
                pen = dTop + playerRadius;
              }
            }

            // Transform normal back to world space
            const worldCos = Math.cos(col.rotY);
            const worldSin = Math.sin(col.rotY);
            const worldNx = localNx * worldCos - localNz * worldSin;
            const worldNz = localNx * worldSin + localNz * worldCos;

            px += worldNx * pen;
            pz += worldNz * pen;
            hasCollided = true;
            iterCollided = true;
            lastHitNormalX = worldNx;
            lastHitNormalZ = worldNz;
            lastHitCollider = col;
          }
        }
      }

      if (!iterCollided) break;
    }

    this._tmpResult.newX = px;
    this._tmpResult.newZ = pz;
    this._tmpResult.collided = hasCollided;
    this._tmpResult.hitNormalX = lastHitNormalX;
    this._tmpResult.hitNormalZ = lastHitNormalZ;
    this._tmpResult.hitCollider = lastHitCollider;
    return this._tmpResult;
  }

  /**
   * Fast melee raycast against colliders within maxDist (e.g. 2.5m).
   * Replaces expensive recursive full-scene tree traversals.
   */
  public raycast(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDist = 2.5,
  ): RayHit {
    const candidates = this.getCollidersNear(origin.x, origin.z, maxDist + 2.0);
    let closestDist = maxDist;
    let closestHit: RayHit = {
      hit: false,
      distance: maxDist,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
    };

    const dirX = direction.x;
    const dirZ = direction.z;

    for (let i = 0; i < candidates.length; i++) {
      const col = candidates[i];
      if (col.isTrigger) continue;

      // Quick vertical check against ray origin
      if (origin.y < col.minY - 1.0 || origin.y > col.maxY + 1.0) continue;

      if (col.type === 'cylinder') {
        // Analytical 2D ray-circle intersection
        const ocX = origin.x - col.cx;
        const ocZ = origin.z - col.cz;
        const a = dirX * dirX + dirZ * dirZ;
        if (a < 0.0001) continue;
        const b = 2 * (ocX * dirX + ocZ * dirZ);
        const c = ocX * ocX + ocZ * ocZ - col.radius * col.radius;
        const disc = b * b - 4 * a * c;

        if (disc >= 0) {
          const sqrtDisc = Math.sqrt(disc);
          let t = (-b - sqrtDisc) / (2 * a);
          if (t < 0) t = (-b + sqrtDisc) / (2 * a);

          if (t >= 0 && t < closestDist) {
            const hitY = origin.y + direction.y * t;
            if (hitY >= col.minY && hitY <= col.maxY) {
              closestDist = t;
              closestHit = {
                hit: true,
                distance: t,
                point: new THREE.Vector3(
                  origin.x + direction.x * t,
                  hitY,
                  origin.z + direction.z * t,
                ),
                normal: new THREE.Vector3(
                  (origin.x + dirX * t - col.cx) / col.radius,
                  0,
                  (origin.z + dirZ * t - col.cz) / col.radius,
                ).normalize(),
                collider: col,
              };
            }
          }
        }
      } else if (col.type === 'box') {
        // Slab method 2D ray-AABB test
        let tmin = 0;
        let tmax = closestDist;
        let normX = 0;
        let normZ = 0;

        // X slab
        if (Math.abs(dirX) > 0.0001) {
          let tx1 = (col.minX - origin.x) / dirX;
          let tx2 = (col.maxX - origin.x) / dirX;
          let nx = -1;
          if (tx1 > tx2) {
            const tmp = tx1;
            tx1 = tx2;
            tx2 = tmp;
            nx = 1;
          }
          if (tx1 > tmin) {
            tmin = tx1;
            normX = nx;
            normZ = 0;
          }
          tmax = Math.min(tmax, tx2);
          if (tmin > tmax) continue;
        } else if (origin.x < col.minX || origin.x > col.maxX) {
          continue;
        }

        // Z slab
        if (Math.abs(dirZ) > 0.0001) {
          let tz1 = (col.minZ - origin.z) / dirZ;
          let tz2 = (col.maxZ - origin.z) / dirZ;
          let nz = -1;
          if (tz1 > tz2) {
            const tmp = tz1;
            tz1 = tz2;
            tz2 = tmp;
            nz = 1;
          }
          if (tz1 > tmin) {
            tmin = tz1;
            normX = 0;
            normZ = nz;
          }
          tmax = Math.min(tmax, tz2);
          if (tmin > tmax) continue;
        } else if (origin.z < col.minZ || origin.z > col.maxZ) {
          continue;
        }

        if (tmin >= 0 && tmin < closestDist) {
          const hitY = origin.y + direction.y * tmin;
          if (hitY >= col.minY && hitY <= col.maxY) {
            closestDist = tmin;
            closestHit = {
              hit: true,
              distance: tmin,
              point: new THREE.Vector3(
                origin.x + direction.x * tmin,
                hitY,
                origin.z + direction.z * tmin,
              ),
              normal: new THREE.Vector3(normX, 0, normZ),
              collider: col,
            };
          }
        }
      }
    }

    return closestHit;
  }

  /**
   * Toggles wireframe debug rendering of active colliders.
   * Completely unmounts from scene when deactivated.
   */
  public toggleDebug(scene: THREE.Scene): boolean {
    this.debugActive = !this.debugActive;

    if (!this.debugActive) {
      if (this.debugGroup) {
        scene.remove(this.debugGroup);
        this.debugGroup.traverse((obj) => {
          if ((obj as THREE.LineSegments).geometry) {
            (obj as THREE.LineSegments).geometry.dispose();
          }
          if ((obj as THREE.LineSegments).material) {
            ((obj as THREE.LineSegments).material as THREE.Material).dispose();
          }
        });
        this.debugGroup = null;
      }
      return false;
    }

    // Build wireframe meshes
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'HueCollisionDebugVisualizer';

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      linewidth: 1,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < this.colliders.length; i++) {
      const col = this.colliders[i];
      const h = col.maxY - col.minY;
      const midY = col.minY + h * 0.5;

      if (col.type === 'cylinder') {
        const cylGeo = new THREE.CylinderGeometry(col.radius, col.radius, h, 12, 1, true);
        const wire = new THREE.LineSegments(new THREE.WireframeGeometry(cylGeo), wireMat);
        wire.position.set(col.cx, midY, col.cz);
        this.debugGroup.add(wire);
      } else if (col.type === 'box') {
        const sx = col.maxX - col.minX;
        const sz = col.maxZ - col.minZ;
        const boxGeo = new THREE.BoxGeometry(sx, h, sz);
        const wire = new THREE.LineSegments(new THREE.WireframeGeometry(boxGeo), wireMat);
        wire.position.set(col.minX + sx * 0.5, midY, col.minZ + sz * 0.5);
        this.debugGroup.add(wire);
      } else if (col.type === 'obb') {
        const boxGeo = new THREE.BoxGeometry(col.halfW * 2, h, col.halfD * 2);
        const wire = new THREE.LineSegments(new THREE.WireframeGeometry(boxGeo), wireMat);
        wire.position.set(col.cx, midY, col.cz);
        wire.rotation.y = col.rotY;
        this.debugGroup.add(wire);
      }
    }

    scene.add(this.debugGroup);
    return true;
  }

  public isDebugActive(): boolean {
    return this.debugActive;
  }

  public getColliderCount(): number {
    return this.colliders.length;
  }

  public clear() {
    this.colliders = [];
    this.colliderMap.clear();
    this.grid.clear();
  }
}
