# Phone models
| File | Creator (from glTF metadata) | License |
|---|---|---|
| `iphone-17-pro.glb` | Not stated in the file | Owner statement (2026-11-12): free to use |
| `phone-17-pro-max.glb` | Ranguel | Owner statement (2026-11-12): free to use |
- Added by the project owner from an external download (Blender glTF exporter, textures embedded).
  The original source URL and license text were not provided.
- The game must not load these source files. They live in `assets-src/` and are not shipped in the build. The 3D phone call uses only the optimized copy described below (credits entry: `callPhone` in `apps/game/src/config/credits.ts`). `phone-17-pro-max.glb` is not used.
- The models depict a real-world phone product. In-game, do not show real brand names or logos.

## Call phone (spec `game-3d-phone-call-ui`)

| Item | Value |
|---|---|
| Selected candidate | `iphone-17-pro.glb` (this folder, never modified) |
| Output file | `apps/game/public/assets/3d/optimized/call-phone.optimized.glb` |
| Script | `apps/game/scripts/optimize-call-phone.cjs` |
| Command | `node apps/game/scripts/optimize-call-phone.cjs` (run from the workspace root) |
| Size before | 25,657,660 bytes (24.47 MB) |
| Size after | 2,108,832 bytes (2.01 MB), below the 5,242,880-byte limit |

### Settings

- Textures: longest side at most 1024 px (`sharp`, `fit: "inside"`); WebP quality 90 for normal
  maps and 85 for color textures, `effort: 4`; `EXT_texture_webp` marked as required.
- Transforms, in order: `prune()`, `dedup()`, `weld({ tolerance: 0.0001 })`, `quantize()`
  (default settings), `reorder()` with the Meshopt encoder, `meshopt({ level: "medium" })`.
- No decimation (about 51,000 triangles for one close-up prop).
- Size gate: the script exits with code 1 if the output is above 5,242,880 bytes.
- Checks before writing: no texture named `wallpaper` remains, and no node, mesh or scene name
  matches `iphone`, `17 pro` or `apple` (case-insensitive).
- Tools: `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`,
  `meshoptimizer`, `sharp` (existing workspace devDependencies).

### Inspection of the candidate

Inspected with `@gltf-transform/core` 4.5.1.

| Item | Finding |
|---|---|
| Generator | `glTF-Transform v4.5.1`; no `copyright` or author field (creator: not stated) |
| Extensions used | `KHR_materials_emissive_strength`, `KHR_texture_transform` |
| Nodes | 2 nodes at the scene root, both rotated +90° about X (quaternion `[0.7071, 0, 0, 0.7071]`): `iPhone 17 Pro` (body, 14 primitives, 49,019 triangles) and `iPhone 17 Pro.001` (front, mesh `iPhone 17 Pro.004`, 5 primitives, 2,216 triangles) |
| Scene bounds (m) | x ±0.03655, y ±0.07500, z −0.00438 to +0.00892 (73 × 150 × 13 mm; the camera bump is at +z) |
| Screen mesh | Primitive with material `OLED` in mesh `iPhone 17 Pro.004`. Flat; after the node rotation a 0.0668 × 0.1449 m rectangle centered at (0, 0) in the plane z = −0.00343, facing −Z. Corner radius about 0.0117 m. UVs cover 0–1. |
| Screen materials | `OLED` (base color and emissive texture `wallpaper`, JPEG 1280×2781, emissive strength 10), `OLED off` (small black area at the top center: the camera cut-out), `Glass` (black, alpha 0.78, in front of the OLED) |
| Wallpaper | Abstract light-line artwork, no text or logo found. It looks like stock product wallpaper art, so it is removed. |
| Other textures | Normal maps `Anodized aluminum normal` (2048², 13.5 MB PNG), `Keyboard normal` (2048², 6.2 MB), `Concentrico`, `LED normal`, `mesh normal` (1024²) and base color `mesh color` (1024², a diamond lattice for the speaker grille). Previews show grain, noise or the lattice only; no text, brand name or logo. |
| Logo mesh | No primitive or material is named for a logo, and no texture contains one. The back panel is covered by `Frosted glass` (591 triangles) and `Glass tint` (379 triangles); an embossed logo cannot be ruled out from data alone. |
| Names | Node and mesh names contain the product name. They are not visible in the game but are renamed in the optimized file. |

### Branding changes

1. `OLED` material: the `wallpaper` base color and emissive textures are removed. Base color is
   set to the linear `BRAND.navy` (`#1D1B2B`) factor `[0.0123, 0.011, 0.025, 1]` and emissive to
   `[0, 0, 0]`. During a call the in-game screen UI covers this area.
2. Node `iPhone 17 Pro` and its mesh are renamed to `CallPhoneBody`. Node `iPhone 17 Pro.001` and
   its mesh `iPhone 17 Pro.004` are renamed to `CallPhoneFront`. Material names are generic
   (`Glass`, `Display Frame`, and so on) and are kept.
3. No logo texture and no logo mesh were found, so no geometry was removed.
4. In the game the phone always faces the camera and only moves by translation, so the back is
   not shown.

### `REMOVE_PRIMITIVES` result

The list in the script is empty: 0 entries, 0 primitives removed. No logo primitive was found in
the data.

### Pending manual check

Not done yet: render the optimized model from the back and the sides once in a local dev build
and confirm that no logo or product name is visible. If a logo primitive is found, add it to
`REMOVE_PRIMITIVES` (new mesh name + material name), run the script again, and update the sizes
and this section with the result and the date.
