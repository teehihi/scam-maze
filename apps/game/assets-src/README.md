# Source assets (not shipped)

Original, unoptimized files. Vite only copies `public/`, so nothing here is part of the
game build or downloaded by players. `.glb` files are stored in Git LFS.

| File | Used for |
|---|---|
| `environments/MenuBG.glb` | Input of `scripts/optimize-environment.cjs`, which writes `public/assets/3d/optimized/MenuBG.optimized.glb` |
| `props/phone/iphone-17-pro.glb` | Input of `scripts/optimize-call-phone.cjs`, which writes `public/assets/3d/optimized/call-phone.optimized.glb` (see `props/phone/SOURCE.md`) |
| `props/phone/phone-17-pro-max.glb` | Alternative phone model, not used by the game |
| `vehicles/merc-a45-gltf/` (git-ignored, local only) | Original Sketchfab glTF of the Mercedes A45; source of `public/assets/3d/vehicles/merc-a45.glb` |
| `low_poly_city*.glb`, `low_poly_cars_pack.glb` (kept in `Asset3D/`, or in `assets-src/city/`) | Input of `scripts/optimize-city-packs.cjs`, which writes `public/assets/3d/optimized/city-district.optimized.glb` and `city-cars.optimized.glb` |
