# Source assets (not shipped)

Original, unoptimized files. Vite only copies `public/`, so nothing here is part of the
game build or downloaded by players. `.glb` files are stored in Git LFS.

| File | Used for |
|---|---|
| `environments/MenuBG.glb` | Input of `scripts/optimize-environment.cjs`, which writes `public/assets/3d/optimized/MenuBG.optimized.glb` |
| `props/phone/iphone-17-pro.glb` | Input of `scripts/optimize-call-phone.cjs`, which writes `public/assets/3d/optimized/call-phone.optimized.glb` (see `props/phone/SOURCE.md`) |
| `props/phone/phone-17-pro-max.glb` | Alternative phone model, not used by the game |
| `characters/<id>/*.glb` (banhmi-vendor, manvn, juno3, rowan) | Input of `scripts/optimize-characters.cjs`, which writes `public/assets/3d/optimized/characters/<id>.optimized.glb` (see `characters/SOURCE.md`) |
| `props/furniture/*.glb`, `vehicles/parked/*.glb` (`honda-cg-125.glb` local only, git-ignored) | Input of `scripts/optimize-street-props.cjs`, which writes `public/assets/3d/optimized/props/*.optimized.glb` (see the `SOURCE.md` files) |
| `dengiaothong.glb` | Owner-supplied mast-arm traffic signal with one mesh per part (1.7M triangles). Input of `scripts/optimize-traffic-signal.cjs`, which writes `public/assets/3d/optimized/props/traffic-signal.optimized.glb` |
| `vehicles/bike-rider/bike_rider_animated.glb` | Input of `scripts/optimize-bike-rider.cjs`, which writes `public/assets/3d/optimized/bike-rider.optimized.glb` (see `vehicles/bike-rider/SOURCE.md`) |
| `vehicles/merc-a45-gltf/` (git-ignored, local only) | Original Sketchfab glTF of the Mercedes A45; source of `public/assets/3d/vehicles/merc-a45.glb` |
| `low_poly_city*.glb`, `low_poly_cars_pack.glb` (kept in `Asset3D/`, or in `assets-src/city/`) | Input of `scripts/optimize-city-packs.cjs`, which writes `public/assets/3d/optimized/city-district.optimized.glb` and `city-cars.optimized.glb` |
| `characters/typing/Typing.fbx` (local only, not committed: raw Mixamo file) | Mixamo "Typing" animation. Input of `scripts/retarget-typing-hands.mjs`, which writes `public/assets/3d/characters/typing-hands.glb` |
| `audio/keyboard/799122__sadiquecat__*.wav` (local only, not committed: 3.6 MB raw recording) | Freesound recording 799122. Multi-take keyboard recording. Input of `scripts/extract-keyboard-sfx.py`, which writes `public/assets/audio/keyboard/*.wav` |
