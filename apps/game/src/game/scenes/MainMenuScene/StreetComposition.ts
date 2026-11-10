/**
 * SCAMMAZE Main Menu Scene Layout & Composition
 * Unity-Authored Vietnamese Urban Street Scene ("MenuBG.glb").
 *
 * Exact 1:1 camera framing matching Unity Game View:
 * - Camera position: [188.6, -91.3, -88.89]
 * - Camera target: [188.6, -91.3, 50.0] (horizontal forward along +Z)
 * - Highlights:
 *   - Right foreground: Bánh Mì street cart with red signage and spoke wheels
 *   - Center: Gold Lexus GX 550 parked down the street
 *   - Left sidewalk: VinFast VF3, pedestrians, and modern shophouses
 *   - Horizon: Landmark 81 & Bitexco under tropical blue cloud sky
 */

export interface StreetLightFixture {
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}

export const STREET_CONFIG = {
  // Road & eye level reference
  groundY: -94.7,
  eyeHeightY: -91.3,

  // Camera settings: Exactly matches Unity 2022.3 Game View
  camera: {
    defaultPosition: [188.6, -91.3, -88.89] as [number, number, number],
    targetPosition: [188.6, -91.3, 50.0] as [number, number, number],
    fov: 60,
    near: 0.1,
    far: 1200,
  },

  // Street lighting fixtures matching the lamp posts along the sidewalk
  streetLights: [
    { position: [182.92, -90.5, -59.8], color: "#ffc87a", intensity: 2.2, distance: 20 },
    { position: [197.39, -90.5, -59.8], color: "#ffc87a", intensity: 2.2, distance: 20 },
    { position: [198.17, -90.5, -42.85], color: "#ffbe5c", intensity: 2.2, distance: 20 },
  ] as StreetLightFixture[],
};
