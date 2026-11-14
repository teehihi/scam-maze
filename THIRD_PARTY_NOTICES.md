# THIRD PARTY NOTICES & OPEN ASSET LICENSES

This document records the third-party assets, 3D models, fonts, and external creative works used in **SCAMMAZE**.

---

## 1. 3D World & Environment Models

### Sky Dome
- **Title:** Sky
- **Source File:** `Kiroween/Asset3D/sky.glb`
- **Production Asset Path:** `apps/game/public/assets/3d/environments/sky.glb`
- **File Format & Size:** Binary glTF (`.glb`), 2.4 MB (hemisphere sky dome with self-illuminated painted cloud texture map).
- **Optimization / Changes:** Extracted `Sphere_8` skydome geometry with `THREE.BackSide` and sRGB self-emissive cloud texture mapping. Animated with subtle dynamic cloud drift across the city skyline.
- **Used In:** 360-degree panoramic atmospheric sky dome above the 3D main menu city scene.

### Low Poly City Game-Ready
- **Title:** Low Poly City Game-Ready
- **Creator / Author:** costoWRLD ([https://sketchfab.com/costoWRLD](https://sketchfab.com/costoWRLD))
- **Source URL:** [https://sketchfab.com/3d-models/low-poly-city-game-ready-e39be33fa0f443bca4162e084323b7e7](https://sketchfab.com/3d-models/low-poly-city-game-ready-e39be33fa0f443bca4162e084323b7e7)
- **License:** Creative Commons Attribution 4.0 International ([CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/))
- **Local Source Directory:** `Kiroween/Asset3D/low_poly_city_game-ready.glb`
- **Production Asset Path:** `apps/game/public/assets/3d/environments/low_poly_city_game-ready.glb`
- **File Format & Size:** Binary glTF (`.glb`), 44.2 MB (970 meshes, 37 materials, 10 embedded textures).
- **Optimization / Changes:** Self-contained 1:1 metric scale game-ready environment with emissive neon motel signage, high-rise apartment towers, retro diner, post office, commercial storefronts, wide avenues, pedestrian crosswalks, and street trees.
- **Used In:** Main menu first-person 3D city avenue environment.

### Low Poly City Asset Pack
- **Title:** Low Poly City Asset Pack
- **Creator / Author:** Calipo ([https://sketchfab.com/ImJester](https://sketchfab.com/ImJester))
- **Source URL:** [https://sketchfab.com/3d-models/low-poly-city-asset-pack-decdce23606842988a8b4cbd09008584](https://sketchfab.com/3d-models/low-poly-city-asset-pack-decdce23606842988a8b4cbd09008584)
- **License:** Creative Commons Attribution 4.0 International ([CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/))
- **Local Source Directory:** `Kiroween/Asset3D/low_poly_city_asset_pack.glb`
- **Production Asset Path:** `apps/game/public/assets/3d/environments/low_poly_city_asset_pack.glb`
- **File Format & Size:** Binary glTF (`.glb`), 895 KB (66 meshes, 34 materials, 0 external image textures).
- **Optimization / Changes:** Self-contained glTF 2.0 binary with material roughness adjustments (0.85 roughness, 0.1 metalness) applied in Three.js shader pipeline.
- **Used In:** Main menu first-person street scene (buildings B1–B5, corner facade, storefront, hospital facade, road section, benches, streetlights).

### Neighborhood surface textures (Poly Haven)
- **Title:** 13 scanned PBR texture sets (plaster x2, concrete, asphalt, pavers, floor tile, brick, roof tile, stone cladding, wood planks, wood veneer, linen, soil)
- **Creator / Author:** Poly Haven ([https://polyhaven.com/textures](https://polyhaven.com/textures))
- **License:** CC0 1.0 (public domain)
- **Local Source:** fetched by `Asset3D/khupho/tools/fetch_polyhaven.py` (1K sets, albedo normalized for brightness and saturation); recovered from the owner's single-file build `Asset3D/khupho/evidence/stable_v1/hue_textured_v1.html`.
- **Production Asset Path:** `apps/game/src/features/khupho/assets/tex/*.jpg` (39 files, 5.6 MB; `_d` albedo, `_n` normal, `_r` roughness).
- **Used In:** Neighborhood world (`/khupho` and the new-game prologue).
---

## 2. 3D Vehicle & Street Props

### Low Poly Cars Pack
- **Title:** Low Poly cars pack
- **Creator / Author:** matisosanimation ([https://sketchfab.com/matisosanimation](https://sketchfab.com/matisosanimation))
- **Source URL:** [https://sketchfab.com/3d-models/low-poly-cars-pack-1d942e1a2f564690a5d703fdc08657b3](https://sketchfab.com/3d-models/low-poly-cars-pack-1d942e1a2f564690a5d703fdc08657b3)
- **License:** Creative Commons Attribution 4.0 International ([CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/))
- **Local Source Directory:** `Kiroween/Asset3D/low_poly_cars_pack.glb`
- **Production Asset Path:** `apps/game/public/assets/3d/vehicles/low_poly_cars_pack.glb`
- **File Format & Size:** Binary glTF (`.glb`), 19.0 MB (57 vehicle meshes, 55 materials, 46 embedded texture maps).
- **Optimization / Changes:** Selective node extraction of sedans, utility vans, and compact cars (`Object_4`, `Object_7`, `Object_9`, `Object_12`, `Object_14`). Geometry centered at local origin dynamically with vertex normals recomputed.
- **Used In:** Parked cars positioned along curbs in the first-person 3D street scene.

---

### 2023 Mercedes-Benz A45 S AMG 4Matic
- **Title:** 2023 Mercedes-Benz A45 S AMG 4Matic
- **Creator / Author:** Ddiaz Design ([https://sketchfab.com/ddiaz-design](https://sketchfab.com/ddiaz-design))
- **Source URL:** [https://sketchfab.com/3d-models/2023-mercedes-benz-a45-s-amg-4matic-7dcef373c52c44ffb0bfbd85a1da1ed2](https://sketchfab.com/3d-models/2023-mercedes-benz-a45-s-amg-4matic-7dcef373c52c44ffb0bfbd85a1da1ed2)
- **License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International ([CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)). **No commercial use.** The modified GLB is shared under the same license and is **not** covered by the repository's MIT License.
- **Credit line:** This work is based on "2023 Mercedes-Benz A45 S AMG 4Matic" by Ddiaz Design, licensed under CC BY-NC-SA 4.0.
- **Production Asset Path:** `apps/game/public/assets/3d/vehicles/merc-a45.glb` (license copy: `merc-a45.LICENSE.txt`)
- **Changes:** Converted from the Sketchfab glTF (27 MB) to one GLB (7.1 MB): Meshopt geometry compression, quantization, WebP textures (max 2048 px), scaled from the 1:100 export to metres. Geometry (540k triangles) and materials unchanged.
- **Used In:** Drivable car on the Huế map (`/hue`).

---

## 3. Music

Both songs are works of **Lê Quốc Khánh (Men Le)**, a SCAMMAZE contributor, and are used in the
game with his permission. They are **not** covered by the repository's MIT License: all rights
remain with the author. Do not reuse, redistribute or re-upload them outside SCAMMAZE without the
author's permission.

| Title | Author | Production asset | Notes |
|---|---|---|---|
| **Mùa Hạ Thứ 18** | Lê Quốc Khánh (Men Le) | `apps/game/public/reality/mua-ha-thu-18.mp3` (MP3 VBR ~172 kbps, 6.1 MB, encoded from the author's WAV) | UEH courtyard, summer rain theme |
| **Nếu ngày mai** | Lê Quốc Khánh (Men Le), performed with Hồ Đá Chà Gươm | `apps/game/public/reality/neu-ngay-mai.mp3` | UEH courtyard, flame tree blossom theme. Published on [Spotify](https://open.spotify.com/track/2AkPSNohBGtrZMGeTtwV12) |

---

## 4. Typography & Fonts

| Font Family | Author / Foundry | License | Distribution |
|---|---|---|---|
| **Bricolage Grotesque** | Mathieu Triay | SIL Open Font License (OFL-1.1) | `@fontsource-variable/bricolage-grotesque` |
| **Inter** | Rasmus Andersson | SIL Open Font License (OFL-1.1) | `@fontsource-variable/inter` |
| **JetBrains Mono** | JetBrains | SIL Open Font License (OFL-1.1) | `@fontsource-variable/jetbrains-mono` |
| **Shojumaru** | Astigmatic | SIL Open Font License (OFL-1.1) | Google Fonts CDN |
| **Nanum Pen Script** | Sandoll Communications | SIL Open Font License (OFL-1.1) | Google Fonts CDN |
| **Stylish** | Woowahan Brothers | SIL Open Font License (OFL-1.1) | Google Fonts CDN |

---

## 5. UI Icons & Software Libraries

| Library | License | Usage |
|---|---|---|
| **lucide-react** | ISC License | System and menu icons |
| **three** | MIT License | 3D WebGL rendering engine |
| **@react-three/fiber** | MIT License | Declarative React Three.js renderer |
| **@react-three/drei** | MIT License | Asset loaders (`useGLTF`) & 3D helpers |
| **n8ao** | ISC License | Ambient-occlusion pass for the Mekong Delta world (`/mientay`) |
| **postprocessing** | Zlib License | Required peer dependency of `n8ao` |
| **react / react-dom** | MIT License | UI component runtime |
| **tailwindcss** | MIT License | Styling engine |
| **vite** | MIT License | Build tool & local dev server |
