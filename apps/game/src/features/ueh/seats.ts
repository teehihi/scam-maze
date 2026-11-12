import { EXHIBITS } from './layout'
import { yawFacing, type Seat } from '../player/seating'
import type { BoxCollider } from '../vehicle/types'

// Sittable seats on the UEH courtyard, computed from the same constants as the geometry in
// worlds/UEH.tsx (CourtyardGround stone benches, StudentCorner picnic tables). Keep in sync.

/** Stone benches around the central flame tree: angle on a 6 m ring, seat top at 0.485 m. */
const STONE_BENCH_ANGLES = [0.4, 3.5, 5.1] // 1.9 holds the guitar: E there strums it
const STONE_BENCH_RING = 6.0
const STONE_SEAT_Y = 0.485
const STONE_SEAT_OFFSETS = [-0.5, 0.5]

/** Student Corner: two picnic tables (local x ±2.2), benches at local z ±0.82, seat top 0.47 m. */
const PICNIC_TABLE_X = [-2.2, 2.2]
const PICNIC_BENCH_Z = [-0.82, 0.82]
const PICNIC_SEAT_OFFSETS = [-0.6, 0.6]
const PICNIC_SEAT_Y = 0.47
const CORNER_ROT = -0.45

function rotateY(lx: number, lz: number, ry: number): [number, number] {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return [lx * c + lz * s, -lx * s + lz * c]
}

function buildSeats(): Seat[] {
  const seats: Seat[] = []

  for (const a of STONE_BENCH_ANGLES) {
    const cx = Math.cos(a) * STONE_BENCH_RING
    const cz = Math.sin(a) * STONE_BENCH_RING
    const ry = -a + Math.PI * 0.5
    const [fx, fz] = rotateY(0, 1, ry) // sitter faces the bench's local +Z (away from the tree)
    for (const off of STONE_SEAT_OFFSETS) {
      const [ox, oz] = rotateY(off, 0, ry)
      seats.push({ id: `stone-${a}-${off}`, position: [cx + ox, STONE_SEAT_Y, cz + oz], facingYaw: yawFacing(fx, fz) })
    }
  }

  const e = EXHIBITS.products
  for (const tx of PICNIC_TABLE_X) {
    for (const bz of PICNIC_BENCH_Z) {
      const [fx, fz] = rotateY(0, -Math.sign(bz), CORNER_ROT) // face the table
      for (const off of PICNIC_SEAT_OFFSETS) {
        const [wx, wz] = rotateY(tx + off, bz, CORNER_ROT)
        // No backrest: step back off the bench instead of into the table.
        seats.push({
          id: `picnic-${tx}-${bz}-${off}`,
          position: [e.x + wx, PICNIC_SEAT_Y, e.z + wz],
          facingYaw: yawFacing(fx, fz),
          standUp: 'back',
        })
      }
    }
  }

  return seats
}

export const UEH_SEATS: readonly Seat[] = buildSeats()

/** All four stone benches, including the guitar bench (not sittable, but still solid). */
const ALL_STONE_BENCH_ANGLES = [0.4, 1.9, 3.5, 5.1]
/** Stone bench footprint: seat 2.2 × 0.54 m, backrest reaching 0.26 m behind the centre. */
const STONE_HALF_WIDTH = 1.1
const STONE_HALF_DEPTH = 0.3
/** Picnic table + both benches: table 2.6 m long, benches out to 0.82 + 0.18 m from the centre. */
const PICNIC_HALF_WIDTH = 1.3
const PICNIC_HALF_DEPTH = 1.0

/**
 * BoxCollider.yaw rotates local +X towards +Z (math convention), the opposite of a Three.js
 * Y rotation, hence `-ry` below.
 */
function buildFurnitureColliders(): BoxCollider[] {
  const boxes: BoxCollider[] = []
  for (const a of ALL_STONE_BENCH_ANGLES) {
    const ry = -a + Math.PI * 0.5
    boxes.push({
      x: Math.cos(a) * STONE_BENCH_RING,
      z: Math.sin(a) * STONE_BENCH_RING,
      halfWidth: STONE_HALF_WIDTH,
      halfLength: STONE_HALF_DEPTH,
      yaw: -ry,
    })
  }
  const e = EXHIBITS.products
  for (const tx of PICNIC_TABLE_X) {
    const [wx, wz] = rotateY(tx, 0, CORNER_ROT)
    boxes.push({ x: e.x + wx, z: e.z + wz, halfWidth: PICNIC_HALF_WIDTH, halfLength: PICNIC_HALF_DEPTH, yaw: -CORNER_ROT })
  }
  return boxes
}

/** Solid UEH furniture the player walks around (passed to FirstPersonPlayer as `obstacles`). */
export const UEH_FURNITURE_COLLIDERS: readonly BoxCollider[] = buildFurnitureColliders()
