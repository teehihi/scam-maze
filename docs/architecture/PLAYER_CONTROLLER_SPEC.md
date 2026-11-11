# Unified First-Person Player Controller Specification

> **Canonical Standard** for all 3D first-person maps and scenes in SCAMMAZE (Street Scene, `/UEH` Campus, `/testmove`, `/hue`).
> Maintained to ensure consistent player locomotion, camera perspective, viewmodel arm scale, and animation gestures across the entire product.

---

## 1. Camera & Perspective Parameters

| Property | Value | Rationale |
|---|---|---|
| **Field of View (FOV)** | `70°` | Human peripheral comfort in browser 3D without fisheye distortion. Prevents viewmodel clipping and excessive telephoto magnification. |
| **Near Clip Plane** | `0.05m` (5 cm) | Prevents clipping into first-person arms and nearby doorframes/walls. |
| **Far Clip Plane** | `1800m` | Encloses procedural sky domes (radius 1300m) and mountain horizons while high-poly monuments are distance-streamed at 280–340m. |
| **Eye Height (Ground)** | `1.85m` | Standard adult standing eye level (ground + 1.85m). |
| **Pitch Clamp** | `±85°` (`1.483 rad`) | Prevents gimbal lock flipping when looking directly at zenith or nadir. |
| **Mouse Sensitivity** | `0.0022` rad/pixel | Silky smooth exponential damping (`1 - exp(-25 * dt)`). |

---

## 2. First-Person Arms Viewmodel Specifications

Asset source: `/assets/3d/characters/first_person_animations.glb`

| Attribute | Canonical Value | Description |
|---|---|---|
| **Scale** | `[0.72, 0.72, 0.72]` | Crucial: 72% scale matches adult forearm proportions at 70° FOV. Do NOT render at 1.0 (causes giant oversized hands). |
| **Rotation** | `[-0.05, Math.PI, 0]` | Slight pitch angle facing forward toward camera target. |
| **Base Position (X, Z)** | `X: 0.0`, `Z: 0.06` | Centered along the optical axis, pushed 6cm in front of camera sensor. |
| **Depth & Render Order** | `depthTest: true`, `depthWrite: true`, `renderOrder: 999` | Renders on top of geometry without z-fighting; casts shadows onto world. |
| **Material Roughness** | `0.55`, `metalness: 0.0` | Natural skin lighting with sRGB color space albedo. |

### Viewmodel Vertical (Y) States

| State | Target Y | Speed | Animation Clip | Description |
|---|---|---|---|---|
| **Stowed / Unequipped** | `-1.55m` | Lerp 9 | `rig|Unequip` | Idle standing or normal walk. Arms slide naturally below viewport so player explores the world unobstructed. |
| **Sprint Locomotion** | `-1.10m` | Lerp 22 | `rig|Sprint_Type_1` (`timeScale: 1.25`) | Shift + WASD: Athletic arm pumping stride. |
| **Melee Punch Strike** | `-1.08m` | Instant raise, Lerp 15 drop | `rig|Punch_Cross_R` / `rig|Punch_Cross_L` | Left-Click or `F`: 1-2 boxing combo with brisk 120ms readiness window for rapid follow-ups before quickly stowing down. |
| **Defensive Guard (Block)** | `-0.98m` | Lerp 22 | `rig|Block_Start` $\rightarrow$ `rig|Block_Loop` | Right-Click hold: Raised forearm shield against threats. |
| **Inspect Hands** | `-1.08m` | Lerp 22 | `rig|Inspect` (`timeScale: 1.35`) | Keys `T` or `I`: Raised inspecting palms and fingers. |
| **Physical Interaction** | `-1.08m` | Lerp 22 | `rig|Take_Start` $\rightarrow$ `rig|Take_Stop` | Key `E`: Forward reach gesture to grab, open, or ring objects. |

---

## 3. Locomotion & Physics Constants

| Parameter | Value | Formula / Details |
|---|---|---|
| **Walk Speed** | `4.2 m/s` (~15 km/h) | Default movement pace with WASD. |
| **Sprint Speed** | `8.2 m/s` (~30 km/h) | Activated with `Shift` while moving forward (`moveZ > 0`). |
| **Block Speed** | `2.0 m/s` (~7 km/h) | Defensive crawl while holding Right-Click guard. |
| **Ground Acceleration** | `18.0 m/s²` | Rapid responsive start. |
| **Ground Friction** | `12.0 m/s²` | Snappy deceleration on key release. |
| **Air Control Accel** | `4.0 m/s²` | Realistic aerial momentum preservation. |
| **Jump Force** | `7.0 m/s` | Single impulse jump with `Space` when grounded. |
| **Gravity** | `-22.0 m/s²` | Crisp parabolic jump arc without floaty feel. |

---

## 4. Distance Streaming & Level of Detail (LOD) Rules

1. **Monuments & Compounds:** Never render full geometry of distant compounds that are beyond view or hidden behind hills. Use a 260m streaming threshold.
2. **Point Lights:** Disable point light calculation (`intensity = 0` or `visible = false`) when distance to camera $> 70\text{m}$.
3. **Instanced Flora:** Restrict instanced grass to near-field ($< 35\text{m}$ radius around player), and cap total instanced count to under 10,000 instances.
4. **Shader Overhead:** Keep fragment shaders pure PBR. Never run multi-octave procedural FBM noise loops per pixel in runtime fragment shaders.
