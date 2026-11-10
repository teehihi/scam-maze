# First-Person Arms & Animation System

> **Status:** `IMPLEMENTED` (Core locomotion, 1-2 punch combos, equip, inspect) / `PLANNED` (Block guard, item pickup)  
> **Source Model:** `Fists (2025) | First Person Animations` by 1Matzh (CC-BY 4.0 via Sketchfab)  
> **Asset Path:** `apps/game/public/assets/3d/characters/first_person_animations.glb`

---

## 1. Overview & Architectural Design

The first-person arm viewmodel represents the player's physical embodiment in the 3D world.
Unlike detached floating cameras or quiz-based interfaces, SCAMMAZE embeds digital interactions (phone, notifications, scam messages) within a tangible physical persona.

### Key Visual & Transform Calibration
- **Scale:** `[0.72, 0.72, 0.72]` (proportional to Saigon street pedestrians, vehicles, and scooters).
- **Position relative to camera:** `[0, -1.10, 0.05]`.
- **Rotation:** `[-0.05, Math.PI, 0]`.
- **Frustum & Framing:** Hands rest in the lower-center field of view ($Y_{ndc} \approx -0.55$), wrists enter from the bottom corners, and shoulder cuts remain behind the camera near plane ($Z_{cam} > 0$), preventing any severed mesh geometry from appearing in the view.

---

## 2. Complete Animation State Catalog

The GLB asset contains **16 authored animation clips**. Below is the complete specification, timing, and integration map:

| # | Clip Name | Duration | Type | In-Engine State / Role | Controls |
|---|---|---|---|---|---|
| 1 | `Static Pose` | 0.03s | Static | Rest/bind pose | Internal |
| 2 | `rig|Equip` | 0.73s | One-shot | **Map entry intro / Arm raise.** Arms rise smoothly from below screen into guard. | Triggered on scene entry |
| 3 | `rig|Idle` | 5.00s | Loop | **Resting idle breathing.** Relaxed hands held low in central view. | Default when standing |
| 4 | `rig|Idle_Fidget` | 2.00s | One-shot | **Idle variation.** Subtle knuckle flex & finger stretch during prolonged inactivity. | Auto-timer (idle > 15s) |
| 5 | `rig|Walk` | 2.67s | Loop | **Walking locomotion.** Natural rhythmic arm swing. | `W`, `A`, `S`, `D` |
| 6 | `rig|Sprint_Type_1` | 1.33s | Loop | **Sprint / Run.** High-energy forward-pumping arm stride. | `Shift` + `WASD` |
| 7 | `rig|Sprint_Type_2` | 1.33s | Loop | **Alternative sprint stride.** Higher arm cadence variation. | Available variation |
| 8 | `rig|Punch_R` | 1.00s | One-shot | **Right Cross.** Fast punch thrust reaching peak extension at 180ms (`timeScale = 1.85`). | Left Click / `F` / `E` |
| 9 | `rig|Punch_L` | 1.00s | One-shot | **Left Jab.** Fast punch thrust reaching peak extension at 180ms (`timeScale = 1.85`). | Alternates with Right |
| 10 | `rig|Block_Start` | 0.40s | Transition | **Raise Guard.** Hands raise up to protect head/torso. | Right Click (`Hold`) |
| 11 | `rig|Block_Loop` | 1.00s | Loop | **Hold Defensive Guard.** Absorbs physical impact. | Right Click (`Hold`) |
| 12 | `rig|Block_Stop` | 0.40s | Transition | **Lower Guard.** Returns fists back to idle rest stance. | Right Click (`Release`) |
| 13 | `rig|Inspect` | 6.00s | One-shot | **Inspect hands.** Detailed palm, knuckle, and wrist turning examination. | `T` / `I` |
| 14 | `rig|Take_Start` | 0.47s | Transition | **Reach out.** Hand extends to grab a physical item (phone, envelope, evidence). | Interaction `E` |
| 15 | `rig|Take_Loop` | 1.00s | Loop | **Hold item.** Hand holds physical object in foreground view. | Active item hold |
| 16 | `rig|Take_Stop` | 0.47s | Transition | **Put away item.** Pockets item and returns hand to default rest. | Put away / stow |
| 17 | `rig|Unequip` | 0.73s | One-shot | **Lower hands.** Smoothly lowers arms out of view when opening full phone screen. | Phone full-screen |

---

## 3. Combat & Responsiveness Mechanics

### Zero-Latency Strike
- Click strike triggers with `fadeIn(0.01)` and `timeScale = 1.85`.
- Fist reaches maximum extension in **~180ms**.
- Audio and $2.2\text{m}$ crosshair raycasting trigger on frame 0 of the strike:
  - `hit_punch.mp3` (23 KB): Plays when intersecting any 3D world geometry within reach.
  - `miss_punch.mp3` (18 KB): Plays when swinging into empty air.

### Continuous 1-2 Combo Engine
- When the player **holds down** the attack button (left mouse click or `F`/`E`), the engine initiates a continuous combo sequence at the **380ms combo window** (70% through retraction).
- Hands alternate seamlessly: **Right Cross $\leftrightarrow$ Left Jab**, delivering ~2.6 punches/second without any jarring pop or bone twisting.
- Every individual punch in the combo evaluates its own raycast and plays its own impact/whoosh sound.
- Releasing the attack button at any moment allows the active punch to complete naturally before smoothly returning to locomotion.

---

## 4. Pending / Next Phase Tasks

1. **Scene Entry Equip Integration (`rig|Equip`):**
   - Ensure every map entry (Chapter 1, apartment, street) starts with arms off-screen and smoothly executes `rig|Equip` (duration: 0.73s) before transitioning to `rig|Idle`.
2. **Defensive Blocking (`rig|Block_Start` $\rightarrow$ `rig|Block_Loop` $\rightarrow$ `rig|Block_Stop`):**
   - Wire Right-Click to raise defensive guard.
3. **Item Interaction Hand-off (`rig|Take_*`):**
   - Wire interaction key `E` when picking up physical evidence (SIM card, fake bank letter) to transition through `rig|Take_Start` $\rightarrow$ `Take_Loop`.
