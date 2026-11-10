# THIRD PARTY NOTICES & OPEN ASSET LICENSES

This document records the third-party assets, 3D models, fonts, and external creative works used in **SCAMMAZE**.

---

## 1. 3D World & Environment Models

### Ho Chi Minh City 2025 - Thành Phố Hồ Chí Minh
- **Title:** Ho Chi Minh City 2025 - Thành Phố Hồ Chí Minh
- **Creator / Author:** Saigon 3D City ([https://sketchfab.com/saigon3dcity](https://sketchfab.com/saigon3dcity))
- **Source URL:** [https://sketchfab.com/3d-models/ho-chi-minh-city-2025-thanh-pho-ho-chi-minh-10e6d7c014a141b4a4adec54729d0968](https://sketchfab.com/3d-models/ho-chi-minh-city-2025-thanh-pho-ho-chi-minh-10e6d7c014a141b4a4adec54729d0968)
- **License:** Creative Commons Attribution 4.0 International ([CC-BY 4.0](http://creativecommons.org/licenses/by/4.0/))
- **Production Asset Path:** `apps/game/public/assets/3d/environments/hochiminh.glb`
- **File Format & Size:** Binary glTF (`.glb`), 19.6 MB (53 meshes, 493,715 vertices).
- **Optimization / Changes:** Geometry centered at origin. Dynamic procedural vertex coloring engine applied for architectural height, surface normals, Saigon river water surface, low-rise terracotta roofs, colonial ochre facades, and high-rise curtain glass with multi-theme rendering (Daylight, Cyberpunk, Sunset, Tech Blueprint).
- **Used In:** Dedicated 3D map explorer route (`/hochiminh`).

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

## 3. Typography & Fonts

| Font Family | Author / Foundry | License | Distribution |
|---|---|---|---|
| **Bricolage Grotesque** | Mathieu Triay | SIL Open Font License (OFL-1.1) | `@fontsource-variable/bricolage-grotesque` |
| **Inter** | Rasmus Andersson | SIL Open Font License (OFL-1.1) | `@fontsource-variable/inter` |
| **JetBrains Mono** | JetBrains | SIL Open Font License (OFL-1.1) | `@fontsource-variable/jetbrains-mono` |
| **Shojumaru** | Astigmatic | SIL Open Font License (OFL-1.1) | Google Fonts CDN |
| **Nanum Pen Script** | Sandoll Communications | SIL Open Font License (OFL-1.1) | Google Fonts CDN |
| **Stylish** | Woowahan Brothers | SIL Open Font License (OFL-1.1) | Google Fonts CDN |

---

## 4. UI Icons & Software Libraries

| Library | License | Usage |
|---|---|---|
| **lucide-react** | ISC License | System and menu icons |
| **three** | MIT License | 3D WebGL rendering engine |
| **@react-three/fiber** | MIT License | Declarative React Three.js renderer |
| **@react-three/drei** | MIT License | Asset loaders (`useGLTF`) & 3D helpers |
| **react / react-dom** | MIT License | UI component runtime |
| **tailwindcss** | MIT License | Styling engine |
| **vite** | MIT License | Build tool & local dev server |
