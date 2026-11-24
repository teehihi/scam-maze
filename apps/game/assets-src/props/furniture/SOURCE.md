# Street furniture

| File | Title, author | License | In git |
|---|---|---|---|
| `ghelun.glb` | Vietnamese Plastic Chair (low stool), Kiisaku — https://sketchfab.com/3d-models/vietnamese-plastic-chair-25c585737c014827bfa3b56c2b680581 | CC-BY 4.0 | yes (LFS) |
| `ghecao.glb` | Vietnamese Plastic Chair (tall chair with backrest), Kiisaku — https://sketchfab.com/3d-models/vietnamese-plastic-chair-efa69b6b78cc48248f758aec21369447 | CC-BY 4.0 | yes (LFS, 67 MB) |
| `set_table_chair.glb` | table chair plastic - bàn ghế nhựa Việt Nam, minchou19 — https://sketchfab.com/3d-models/table-chair-plastic-ban-ghe-nhua-viet-nam-8216465bc93142f89f7cd38446be6432 | CC-BY 4.0 | yes (LFS) |
| `bienhieu1.glb` | A-board shop sign on a base (1.01 m, one printed face, 1M-triangle scan with 4096 px textures), owner-supplied, added 2026-11-24 | Not provided | yes (LFS, 65 MB) |

Optimized by `node apps/game/scripts/optimize-street-props.cjs` into
`public/assets/3d/optimized/props/{stool-low,stool-high,table-set,bienhieu1}.optimized.glb` (the Sketchfab ones credited in
`src/config/credits.ts`). The furniture is drawn instanced by `src/features/khupho/world/streetFurniture.ts`. `bienhieu1` (20,000 triangles,
0.6 MB) stands on the east sidewalk of the Saigon street (`src/features/testbus/openworld/simulation/sidewalkSigns.ts`), only on spots
with no collider. The printed face is AI-generated artwork with garbled text; the digits on it are not a real number.
