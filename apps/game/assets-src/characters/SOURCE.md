# Character models

Owner-supplied animated people for the neighborhood (`Asset3D/human/`, added 2026-11-14). The game
does not load these files; it loads the optimized copies in
`public/assets/3d/optimized/characters/`, written by `node apps/game/scripts/optimize-characters.cjs`
(run from the workspace root; pass ids to rebuild only some).

| Id | Source file | Rig and clips | License |
|---|---|---|---|
| `banhmi-vendor` | `banhmi-vendor/banhmi_vendor_animated.glb` | 22 bones; VendorIdle, Welcome, Invite, PrepareBread, ServeBread, ReceivePayment, ThankCustomer, LookForCustomer; a baguette prop on the left hand, shown by the clips | Not provided |
| `manvn` | `manvn/manVN_rigged_animated.glb` | 22 bones (auto-rig, see `Asset3D/human/filecuachayxe/README.md`); Idle, Walk, Run, Jump, Wave, Bow, Clap, Dance, Squat, Cheer, Punch | Not provided |
| `juno3` | `juno3/juno3.glb` (+ `juno3.json`) | Mixamo, 64 bones, 5 face morphs; 18 clips incl. idle, walk, wave | Not provided; the JSON notes the clips are retargeted Mixamo captures (check before commercial use) |
| `rowan` | `rowan/rowan.glb` (+ `rowan.json`) | same as `juno3` | same as `juno3` |
| `longq9` | `canh-3d-chu-long-q9-meet_road.glb` (reference only) | The repo file is a posed mesh exported from the author's site (skeleton and clips dropped, arms down), so it cannot be rigged. The game model is built from the author's animated export `scripts/longq9/source/longq9_anim.glb` (17-joint skin, 7 procedural clips; kept outside `assets-src` because it is not stored in Git LFS) by `scripts/longq9/build-longq9.cjs`, which cuts every clip to a seamless loop and completes the joints a clip leaves out: clips Walk, Ride, Greet_Seated, Crouch_Repair, Wave_Hand, Kneel_Pump (the seated wrench clip is dropped, it plays a squat). The yellow Honda Wave he rides is `scripts/longq9/source/xelongq9.glb`, split into moving parts by `scripts/longq9/build-wave.cjs` into `wave-longq9.optimized.glb`. The one and only "Long Q9" mechanic on the Saigon street; never reuse it as a resident | Not provided. Confirm before a public release. |
| `grab-driver` | `grab_lai_xe_custom.glb` | Honda Wave scooter plus rider on one 21-joint skeleton (`Rider_*`, `Bike_*`); clips Drive_Cruise, Drive_Fast, Drive_Turn, Idle_TrafficLight. Real-world scale, forward +Z | Not provided. Confirm before a public release. |

Confirm every license before a public release.

`longq9` (written there directly by its build script) and `grab-driver` are loaded by the Saigon open world from `public/assets/testbus/ow/models/`
(copy the optimized files there after running the script; no script syncs that folder).

## Optimized output (2026-11-14)

| Id | Size | Triangles | Textures |
|---|---|---|---|
| `banhmi-vendor` | 6.51 MB → 1.19 MB | 102,860 → 53,797 | WebP, color 2048, others 1024 |
| `manvn` | 2.33 MB → 0.83 MB | 20,635 (kept) | WebP 1024 |
| `juno3` | 27.98 MB → 2.10 MB | 67,157 → 40,283 | WebP 1024 |
| `rowan` | 32.48 MB → 2.19 MB | 68,448 → 41,068 | WebP 1024 |

## Street NPCs (`street/`, added 2026-11-14)

Seven owner-supplied people from an online character creator (`Asset3D/human/streetNPC/`, exported
with THREE.GLTFExporter r187): one 53-bone rig (`Root`, `pelvis`, `thigh_l`...), separate meshes
(`HumanBody`, `Asset_eyes_*`, `Asset_teeth_*`, `Asset_tongue_*`, `Asset_eyebrows_*`,
`Asset_eyelashes_*`, `Asset_hair_*`, `Asset_shoes_*`, `Asset_top_*`, `Asset_bottom_*`, sometimes
`Asset_glasses_*`), **no animation clips**. License: not provided.

| Id | Source | Removed (besides teeth, tongue, eye cornea) | Size | Triangles |
|---|---|---|---|---|
| `npc-alan` | `alan_removerHair.glb` | hair (file name) | 2.52 → 0.40 MB | 46,021 → 36,381 |
| `npc-alice` | `alice.glb` | none | 2.42 → 0.41 MB | 40,380 → 31,832 |
| `npc-archetype` | `archetype.glb` | none | 2.53 → 0.43 MB | 43,513 → 34,965 |
| `npc-arthur` | `arthur_RemoveSunglasses.glb` | glasses (file name) | 2.82 → 0.46 MB | 48,632 → 38,672 |
| `npc-linmei` | `lin_mei_removeHair.glb` | hair (file name) | 2.62 → 0.35 MB | 42,388 → 28,864 |
| `npc-napole` | `napole.glb` | 2 unnamed non-triangle meshes (debug lines and points) | 2.46 → 0.40 MB | 38,724 → 30,176 |
| `npc-yoshida` | `yoshida.glb` | none | 2.46 → 0.42 MB | 42,163 → 33,615 |

| `npc-blackguy` | `blackguy_dontchangecolor_new.glb` | none; keeps its authored clothing colors (`_dontchangecolor`) | 2.43 → 0.38 MB | 36,094 → 27,546 |
| `npc-freya` | `freya_new.glb` | none (full-body tunic counts as the top) | 2.36 → 0.37 MB | 38,062 → 29,514 |
| `npc-nguoigia` | `nguoigia_new.glb` | none (full-body kimono counts as the top) | 2.52 → 0.38 MB | 48,006 → 39,458 |
| `npc-sofia` | `sofia_new.glb` | none | 3.14 → 0.52 MB | 60,806 → 52,258 |

- Sunglasses: the eyes have no iris, so every street NPC wears black sunglasses (owner). The
  `Asset_glasses_acc_round_sun` mesh of `lin_mei_removeHair.glb` is cut out into
  `accessory-sunglasses.optimized.glb` (10 KB, 1,284 triangles) with the source eye center and width,
  and fitted at load onto each NPC's eyes (scaled by eye width, attached to the `head` bone).
- Materials: clearcoat, sheen and ior removed; eyebrows and eyelashes use alpha cutout; top,
  bottom and shoe textures made gray (mean 0.8 linear) with the factor rescaled, so the game can
  set clothing colors directly. Textures WebP, at most 512 px (the sources are 512 px or less).
- Animation: `idle`, `walk` and `wave` are retargeted at load from `juno3`'s Mixamo clips
  (`src/features/khupho/world/retarget.ts`).

## Rigged scans (`linh-model/`, `minhModel/`, added 2026-11-24)

Two owner-supplied T-pose scans (one unskinned mesh each, 4096 px PBR textures, no skeleton, no clips; license: not
provided). `node apps/game/scripts/optimize-characters.cjs npc-linh npc-minh` simplifies each to 45,000 triangles and
rigs it automatically (`scripts/rig-tpose.cjs`) onto the street NPC skeleton names and hierarchy, minus the finger
bones (hands are rigid). Idle, walk, wave and sit then work through the same retargeting as the street NPCs.

| Id | Source | Character | Size | Triangles |
|---|---|---|---|---|
| `npc-linh` | `linh-model/new_VnWomen.glb` | Linh (story cast, M01) | 68.82 -> 0.80 MB | 1,493,784 -> 45,000 |
| `npc-minh` | `minhModel/lqk_new.glb` | Minh (story cast, M01-M05) | 54.21 -> 0.76 MB | 1,000,004 -> 45,000 |
| `npc-coba` | `coba/COBA.glb` | Cô Ba, the market-office interviewer (story cast `interviewee_q5`, M02), added 2026-11-25 | 72.81 -> 0.84 MB | -> 45,000 |
| `npc-driver` | `driver/ongxeom.glb` | The unverified ride driver at the Bus 06 stop (story cast `unverified_driver`, M02), added 2026-11-25 | 73.24 -> 0.85 MB | -> 45,000 |

`npc-coba` and `npc-driver` are loaded by the Saigon open world, so their optimized files are also copied to
`public/assets/testbus/ow/models/`. Their landmarks were measured by hand from the scans (about 1.18 m and 1.16 m
tall before scaling); the game scales them to the heights set in `storyCast.ts`.

- Landmarks (joint positions) are measured per scan in `MODELS` in `rig-tpose.cjs`; a new scan needs its own entry.
- Linh's shoulders are narrowed 1.2 cm per side and her arms slimmed 14% before rigging (`shoulders` in `MODELS`), because the scan's square, thick shoulders read as bulky once the arms hang down.
- Skin weights are computed automatically (distance falloff per bone, smoothed). Check new rigs on a walk and a sit pose.
- Used for Minh and Linh in the story cast (`storyCast.ts`) and in the /khupho resident pools (`npcMinh`, `npcLinh`).

## Adding a character

1. Put the `.glb` in `characters/<id>/` (Git LFS) and add an entry to `CHARACTERS` in the script.
2. Run the script for that id.
3. Register it in `HUMAN_MODELS` (`src/features/khupho/world/humans.ts`): file, standing height and
   the clip names for the roles it supports (`idle` is required; `walk` makes it usable as a walker).
   If the source states the walk clip's ground speed, set `walkSpeed`; otherwise it is measured
   from the planted foot at load.
4. Use it in `people.ts` (for example as the `model` argument of a sidewalk walker).
