# First-Person Arms & Animation System

> **Status:** `IMPLEMENTED` (Map entry equip, natural walk cadence, sprint, 1-2 punch combos, defensive block guard, inspect, E interaction)  
> **Source Model:** `Fists (2025) | First Person Animations` by 1Matzh (CC-BY 4.0 via Sketchfab)  
> **Asset Path:** `apps/game/public/assets/3d/characters/first_person_animations.glb`

---

## 1. Overview & Architectural Design

The first-person arm viewmodel represents the player's physical embodiment in the 3D world.
Following standard immersive narrative design:
- **Standing Idle & Normal Walking:** Hands automatically play `rig|Unequip` and tuck away off-screen ($Y \le -1.55\text{m}$), providing a clean, natural, unobstructed panoramic view of the world without arms awkwardly hovering in mid-air.
- **Sprinting (`Shift` + `WASD`):** Arms raise up dynamically to $-1.10\text{m}$ into view and pump with high-energy athletic stride (`rig|Sprint_Type_1`).
- **Combat & Interactions (Attack / Block / Interact / Inspect):** Arms instantaneously raise up to execute strikes, defensive guard, or reach gestures, then smoothly tuck away when disengaged.

### Key Visual & Transform Calibration
- **Scale:** `[0.72, 0.72, 0.72]`.
- **Stowed / Hidden Position:** `[0, -1.55, 0.06]`.
- **Active Sprint Position:** `[0, -1.10, 0.06]`.
- **Combat / Interaction Position:** `[0, -1.08, 0.06]` (Block: `[0, -0.98, 0.06]`).
- **Rotation:** `[-0.05, Math.PI, 0]`.

---

## 2. Complete Animation State Catalog

The GLB asset contains **16 authored animation clips**. Below is the complete specification, timing, and integration map:

| # | Clip Name | Duration | Type | In-Engine State / Role | Controls |
|---|---|---|---|---|---|
| 1 | `Static Pose` | 0.03s | Static | Rest/bind pose | Internal |
| 2 | `rig|Equip` | 0.73s | One-shot | **Map entry intro / Arm raise.** Arms rise smoothly from below screen into ready idle stance. | Triggered on map/scene entry |
| 3 | `rig|Idle` | 5.00s | Loop | **Resting idle breathing.** Relaxed hands held low in central view. | Default when standing |
| 4 | `rig|Idle_Fidget` | 2.00s | One-shot | **Idle variation.** Subtle knuckle flex & finger stretch during prolonged inactivity (>14s). | Auto-timer (idle > 14s) |
| 5 | `rig|Walk` | 2.67s | Loop | **Walking locomotion.** Natural human arm cadence (`timeScale = 1.75`, cycle ~1.5s). | `W`, `A`, `S`, `D` / Arrow keys |
| 6 | `rig|Sprint_Type_1` | 1.33s | Loop | **Sprint / Run.** High-energy forward-pumping arm stride (`timeScale = 1.25`). | `Shift` + `WASD` |
| 7 | `rig|Sprint_Type_2` | 1.33s | Loop | **Alternative sprint stride.** Higher arm cadence variation. | Available variation |
| 8 | `rig|Punch_R` | 1.00s | One-shot | **Right Cross.** Fast punch thrust reaching peak extension at 180ms (`timeScale = 1.85`). | Left Click / `F` |
| 9 | `rig|Punch_L` | 1.00s | One-shot | **Left Jab.** Fast punch thrust reaching peak extension at 180ms (`timeScale = 1.85`). | Alternates with Right (Combo) |
| 10 | `rig|Block_Start` | 0.40s | Transition | **Raise Guard.** Hands raise up to protect head/torso. | Right Click (`Hold`) |
| 11 | `rig|Block_Loop` | 1.00s | Loop | **Hold Defensive Guard.** Absorbs physical impact. | Right Click (`Hold`) |
| 12 | `rig|Block_Stop` | 0.40s | Transition | **Lower Guard.** Returns fists back to idle rest stance. | Right Click (`Release`) |
| 13 | `rig|Inspect` | 6.00s | One-shot | **Inspect hands.** Detailed palm, knuckle, and wrist turning examination. | `T` / `I` |
| 14 | `rig|Take_Start` | 0.47s | Transition | **Reach out.** Hand extends to grab a physical item (acoustic guitar, evidence, phone). | Interaction `E` |
| 15 | `rig|Take_Loop` | 1.00s | Loop | **Hold item.** Hand holds physical object in foreground view. | Active item hold |
| 16 | `rig|Take_Stop` | 0.47s | Transition | **Put away item.** Pockets item and returns hand to default rest. | Put away / stow |
| 17 | `rig|Unequip` | 0.73s | One-shot | **Lower hands.** Smoothly lowers arms out of view when opening full phone screen. | Phone full-screen |

---

## 3. Combat & Responsiveness Mechanics

### Zero-Latency Strike
- Click strike triggers with `fadeIn(0.01)` and `timeScale = 1.85`.
- Fist reaches maximum extension in **~180ms**.
- Audio and $2.4\text{m}$ crosshair raycasting trigger on frame 0 of the strike:
  - `hit_punch.mp3` (23 KB): Plays when intersecting any 3D world geometry within reach.
  - `miss_punch.mp3` (18 KB): Plays when swinging into empty air.

### Continuous 1-2 Combo Engine
- When the player **holds down** the attack button (left mouse click or `F`), the engine initiates a continuous combo sequence at the **380ms combo window** (70% through retraction).
- Hands alternate seamlessly: **Right Cross $\leftrightarrow$ Left Jab**, delivering ~2.6 punches/second without any jarring pop or bone twisting.
- Key `E` is strictly reserved for physical item interactions (e.g. guitar strumming on bench).

---

## 4. Multi-Map Unified Architecture

All player locomotion, input processing, and animated arm viewmodels are packaged in `apps/game/src/features/player/`:
- `FirstPersonPlayer`: Handles 60 FPS velocity integration, collision bounds, camera orientation.
- `FirstPersonArms`: Controls the 16-animation viewmodel state machine, transitions, and audio sync.
- `usePlayerControls`: Handles pointer lock, WASD + Telex IME input, mouse clicks, and trigger consumption.
Used seamlessly across `/ueh` (courtyard campus) and `/testmove` (Saigon District 4 street).
