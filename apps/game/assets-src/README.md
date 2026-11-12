# Source assets (not shipped)

Original, unoptimized files. Vite only copies `public/`, so nothing here is part of the
game build or downloaded by players. `.glb` files are stored in Git LFS.

| File | Used for |
|---|---|
| `environments/MenuBG.glb` | Input of `scripts/optimize-environment.cjs`, which writes `public/assets/3d/optimized/MenuBG.optimized.glb` |
| `props/phone/*.glb` | Phone models, not used by the game yet (see `props/phone/SOURCE.md`) |
