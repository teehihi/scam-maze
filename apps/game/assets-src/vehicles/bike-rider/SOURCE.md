# Scooter with rider

| File | Origin | License |
|---|---|---|
| `bike_rider_animated.glb` | Owner-supplied (`Asset3D/human/bike_rider_animated.glb`): a photogrammetry scooter with rider, auto-rigged by the owner's tool in `Asset3D/human/filecuachayxe/` | Not provided. Confirm before a public release. |

- Source: 1 skinned mesh, 300,000 triangles, ~7,500 loose scan shells, 4 joints (Chassis, FrontWheel,
  RearWheel, Head). Every vertex follows exactly one joint, so the mesh is 4 rigid parts.
  6 clips (LookAround, DriveStraight, LookLeft, LookRight, Accelerate, IdleStop). 16.4 MB.
- The game does not load this file. It loads `public/assets/3d/optimized/bike-rider.optimized.glb`,
  written by `node apps/game/scripts/optimize-bike-rider.cjs` (run from the workspace root).

## Optimized output (2026-11-14)

| Level | Triangles | Parts | Used from |
|---|---|---|---|
| `BikeRider_LOD0` | 127,080 | Chassis, Head, FrontWheel, RearWheel | 0 m |
| `BikeRider_LOD1` | 32,043 | same | 6 m |
| `BikeRider_LOD2` | 22,011 | one merged `Body` | 16 m (hidden past 60 m) |

- Size: 16.42 MB → 2.95 MB. Skin, weights and clips removed; wheels and head are turned in code
  (`src/features/khupho/world/bikeRider.ts`). Textures kept as authored (3 JPEG, 471 KB).
- Simplifier: Meshopt `simplifyWithAttributes` (normals and UVs weighted), error caps 0.004 / 0.02 / 0.08
  of the part size; LOD2 may drop tiny loose shells (`Prune`). The LOD2 count is limited by the
  number of loose scan shells, not by the target.
- The source bike is ~0.97 m long; the game scales it by 1.9.
