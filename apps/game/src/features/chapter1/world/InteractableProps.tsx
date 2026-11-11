/**
 * Procedural meshes for the five Chapter 1 Interactables (Requirements 2.5, 3.1).
 *
 * Every geometry and material is declared in JSX, so React Three Fiber disposes them when the
 * component unmounts. No textures or GLB files are loaded.
 *
 * Each prop is a group standing on the ground (`PROP_GROUND_Y`) at the X/Z of its focus sphere in
 * `INTERACTABLE_LAYOUT`, turned by its `yaw`. Local +Z is the front of the prop. When a prop is
 * focused, all of its materials glow with the Lavender brand color. The glow is never the only
 * signal: the page also shows a text prompt (Requirement 3.3).
 */

import React from "react";
import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import { INTERACTABLE_IDS } from "../../../game/narrative/chapter1/ids";
import { INTERACTABLE_LAYOUT, PROP_GROUND_Y } from "./propLayout";
import type { PropPlacement } from "./propLayout";

/** Lavender brand color used for the focus highlight. */
export const FOCUS_HIGHLIGHT_COLOR = "#B9A5F5";
const FOCUS_EMISSIVE_INTENSITY = 0.55;
const NO_EMISSIVE = "#000000";

interface PropMaterialProps {
  color: string;
  focused: boolean;
  roughness?: number;
  metalness?: number;
}

const PropMaterial: React.FC<PropMaterialProps> = ({
  color,
  focused,
  roughness = 0.8,
  metalness = 0,
}) => (
  <meshStandardMaterial
    color={color}
    roughness={roughness}
    metalness={metalness}
    emissive={focused ? FOCUS_HIGHLIGHT_COLOR : NO_EMISSIVE}
    emissiveIntensity={focused ? FOCUS_EMISSIVE_INTENSITY : 0}
  />
);

interface PropShapeProps {
  focused: boolean;
}

/** Café table with a wallet and the bank card showing at its edge. Table top at 0.76 m. */
const WalletProp: React.FC<PropShapeProps> = ({ focused }) => (
  <group>
    <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.28, 0.28, 0.02, 24]} />
      <PropMaterial color="#3b3b40" focused={focused} metalness={0.4} />
    </mesh>
    <mesh position={[0, 0.37, 0]} castShadow>
      <cylinderGeometry args={[0.035, 0.035, 0.72, 12]} />
      <PropMaterial color="#3b3b40" focused={focused} metalness={0.4} />
    </mesh>
    <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.42, 0.42, 0.04, 32]} />
      <PropMaterial color="#c9b79c" focused={focused} />
    </mesh>
    {/* Wallet */}
    <mesh position={[0.05, 0.775, 0.08]} rotation={[0, 0.3, 0]} castShadow>
      <boxGeometry args={[0.19, 0.03, 0.11]} />
      <PropMaterial color="#5a3a22" focused={focused} roughness={0.6} />
    </mesh>
    {/* Bank card partly out of the wallet */}
    <mesh position={[0.1, 0.792, 0.15]} rotation={[0, 0.3, 0]}>
      <boxGeometry args={[0.085, 0.003, 0.054]} />
      <PropMaterial color="#2a4f8f" focused={focused} roughness={0.4} />
    </mesh>
  </group>
);

/** Mailbox on a post, with a letter in the slot. Box centre at 1.05 m. */
const MailboxProp: React.FC<PropShapeProps> = ({ focused }) => (
  <group>
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[0.08, 0.9, 0.08]} />
      <PropMaterial color="#4a4a4f" focused={focused} metalness={0.3} />
    </mesh>
    <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.42, 0.3, 0.5]} />
      <PropMaterial color="#2f5d50" focused={focused} metalness={0.3} roughness={0.5} />
    </mesh>
    {/* Letter sticking out of the front slot */}
    <mesh position={[0, 1.13, 0.27]} rotation={[-0.25, 0, 0]}>
      <boxGeometry args={[0.24, 0.12, 0.005]} />
      <PropMaterial color="#f2efe6" focused={focused} />
    </mesh>
  </group>
);

/** Shop window with the bank notice behind the glass. Notice centre at 1.5 m. */
const ShopPosterProp: React.FC<PropShapeProps> = ({ focused }) => (
  <group>
    {/* Window frame and glass */}
    <mesh position={[0, 1.4, 0]} receiveShadow>
      <boxGeometry args={[1.6, 1.4, 0.06]} />
      <PropMaterial color="#1f2a33" focused={focused} roughness={0.2} metalness={0.2} />
    </mesh>
    {/* Notice paper */}
    <mesh position={[0, 1.48, 0.035]}>
      <boxGeometry args={[0.6, 0.8, 0.01]} />
      <PropMaterial color="#f4f0e4" focused={focused} />
    </mesh>
    {/* Header band of the notice */}
    <mesh position={[0, 1.8, 0.042]}>
      <boxGeometry args={[0.6, 0.14, 0.005]} />
      <PropMaterial color="#24407a" focused={focused} />
    </mesh>
  </group>
);

/** Shop counter with Sam, the shopkeeper, standing behind it. Focus centre at 1.4 m. */
const ShopkeeperProp: React.FC<PropShapeProps> = ({ focused }) => (
  <group>
    {/* Counter */}
    <mesh position={[0, 0.5, 0.15]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 1.0, 0.6]} />
      <PropMaterial color="#7a5a3c" focused={focused} />
    </mesh>
    <mesh position={[0, 1.02, 0.15]} castShadow receiveShadow>
      <boxGeometry args={[1.7, 0.04, 0.7]} />
      <PropMaterial color="#d8cdb8" focused={focused} />
    </mesh>
    {/* Sam: body, head and arms resting on the counter */}
    <mesh position={[0, 1.3, -0.45]} castShadow>
      <cylinderGeometry args={[0.2, 0.23, 0.75, 16]} />
      <PropMaterial color="#3d6b8c" focused={focused} />
    </mesh>
    <mesh position={[0, 1.82, -0.45]} castShadow>
      <sphereGeometry args={[0.14, 20, 16]} />
      <PropMaterial color="#c99a78" focused={focused} />
    </mesh>
    <mesh position={[-0.25, 1.12, -0.2]} rotation={[Math.PI / 2.6, 0, 0]} castShadow>
      <capsuleGeometry args={[0.05, 0.38, 4, 8]} />
      <PropMaterial color="#3d6b8c" focused={focused} />
    </mesh>
    <mesh position={[0.25, 1.12, -0.2]} rotation={[Math.PI / 2.6, 0, 0]} castShadow>
      <capsuleGeometry args={[0.05, 0.38, 4, 8]} />
      <PropMaterial color="#3d6b8c" focused={focused} />
    </mesh>
  </group>
);

/** Community notice board on two posts, with pinned sheets. Board centre at 1.3 m. */
const NoticeBoardProp: React.FC<PropShapeProps> = ({ focused }) => (
  <group>
    <mesh position={[-0.62, 0.9, 0]} castShadow>
      <boxGeometry args={[0.06, 1.8, 0.06]} />
      <PropMaterial color="#5b4632" focused={focused} />
    </mesh>
    <mesh position={[0.62, 0.9, 0]} castShadow>
      <boxGeometry args={[0.06, 1.8, 0.06]} />
      <PropMaterial color="#5b4632" focused={focused} />
    </mesh>
    <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.2, 0.8, 0.05]} />
      <PropMaterial color="#a8794f" focused={focused} />
    </mesh>
    {/* Pinned sheets; the larger one in the middle is the neighbourhood alert */}
    <mesh position={[-0.36, 1.42, 0.03]} rotation={[0, 0, 0.06]}>
      <boxGeometry args={[0.24, 0.3, 0.004]} />
      <PropMaterial color="#efe9d8" focused={focused} />
    </mesh>
    <mesh position={[0.02, 1.3, 0.03]}>
      <boxGeometry args={[0.34, 0.46, 0.004]} />
      <PropMaterial color="#fbf7ea" focused={focused} />
    </mesh>
    <mesh position={[0.38, 1.18, 0.03]} rotation={[0, 0, -0.05]}>
      <boxGeometry args={[0.22, 0.26, 0.004]} />
      <PropMaterial color="#e3ecf2" focused={focused} />
    </mesh>
  </group>
);

const PROP_SHAPES: Record<InteractableId, React.FC<PropShapeProps>> = {
  "obj.wallet": WalletProp,
  "obj.mailbox": MailboxProp,
  "obj.shop-poster": ShopPosterProp,
  "obj.shopkeeper": ShopkeeperProp,
  "obj.notice-board": NoticeBoardProp,
};

export interface InteractablePropsProps {
  /** The currently focused Interactable, or `null`. */
  focusedId: InteractableId | null;
  /** Placement override, mainly for calibration. Defaults to `INTERACTABLE_LAYOUT`. */
  layout?: Readonly<Record<InteractableId, PropPlacement>>;
  /** Ground height the props stand on. Defaults to `PROP_GROUND_Y`. */
  groundY?: number;
}

export const InteractableProps: React.FC<InteractablePropsProps> = ({
  focusedId,
  layout = INTERACTABLE_LAYOUT,
  groundY = PROP_GROUND_Y,
}) => (
  <group name="chapter1-interactable-props">
    {INTERACTABLE_IDS.map((id) => {
      const Shape = PROP_SHAPES[id];
      const { position, yaw } = layout[id];
      return (
        <group
          key={id}
          name={id}
          position={[position[0], groundY, position[2]]}
          rotation={[0, yaw, 0]}
        >
          <Shape focused={focusedId === id} />
        </group>
      );
    })}
  </group>
);
