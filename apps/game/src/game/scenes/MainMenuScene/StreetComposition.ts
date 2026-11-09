/**
 * SCAMMAZE Main Menu Scene Layout & Composition
 * Calibrated for true world scale (City pack scale x100, Units = Meters).
 * Road runs along X-axis from X = +48m to X = -48m.
 * Road surface is at Y = 0.35m.
 * Human eye-level camera height is Y = 2.05m.
 */

export interface StreetLightFixture {
  position: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
}

export interface TreeInstance {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY: number;
  type: "cone" | "sphere" | "dodeca";
  color: string;
}

export interface ParkedCarSlot {
  position: [number, number, number];
  rotationY: number;
  carIndex: number; // Index of car model (0 = sedan, 1 = van, 2 = compact, 3 = taxi)
}

export const STREET_CONFIG = {
  // Road & eye level reference
  groundY: 0.35,
  eyeHeightY: 2.05,

  // Camera settings (First person viewpoint on the street looking down the avenue)
  camera: {
    defaultPosition: [24.0, 2.05, 0.0] as [number, number, number],
    targetPosition: [-45.0, 2.4, 2.0] as [number, number, number],
    fov: 72,
    near: 0.1,
    far: 250,
  },

  // Street lighting fixtures (warm lantern glow placed along sidewalks)
  streetLights: [
    // Built-in pack lights (North sidewalk)
    { position: [6.2, 6.8, -11.3], color: "#ffc266", intensity: 3.2, distance: 20 },
    { position: [8.3, 6.8, -11.4], color: "#ffc266", intensity: 3.2, distance: 20 },
    // Additional lamps along North sidewalk
    { position: [-12.0, 6.8, -8.0], color: "#ffc266", intensity: 3.0, distance: 18 },
    { position: [-28.0, 6.8, -8.0], color: "#ffc266", intensity: 3.0, distance: 18 },
    { position: [24.0, 6.8, -8.0], color: "#ffc266", intensity: 3.0, distance: 18 },
    // Lamps along South sidewalk
    { position: [-20.0, 6.8, 14.0], color: "#ffbe5c", intensity: 3.0, distance: 18 },
    { position: [0.0, 6.8, 14.0], color: "#ffbe5c", intensity: 3.0, distance: 18 },
    { position: [18.0, 6.8, 14.0], color: "#ffbe5c", intensity: 3.0, distance: 18 },
  ] as StreetLightFixture[],

  // Stylized low-poly trees planted along sidewalks
  trees: [
    // North sidewalk line
    { position: [-38, 0.35, -5.5], scale: [1.2, 1.4, 1.2], rotationY: 0.3, type: "dodeca", color: "#3d7049" },
    { position: [-22, 0.35, -5.5], scale: [1.3, 1.6, 1.3], rotationY: 1.2, type: "sphere", color: "#477c55" },
    { position: [-4, 0.35, -5.5], scale: [1.1, 1.3, 1.1], rotationY: 2.1, type: "cone", color: "#36603f" },
    { position: [14, 0.35, -5.5], scale: [1.3, 1.5, 1.3], rotationY: 0.8, type: "dodeca", color: "#40734c" },
    { position: [30, 0.35, -5.5], scale: [1.2, 1.4, 1.2], rotationY: 1.7, type: "sphere", color: "#3a6844" },
    // South sidewalk line
    { position: [-30, 0.35, 13.0], scale: [1.3, 1.5, 1.3], rotationY: 0.5, type: "cone", color: "#457952" },
    { position: [-12, 0.35, 13.0], scale: [1.2, 1.4, 1.2], rotationY: 2.4, type: "dodeca", color: "#3b6946" },
    { position: [6, 0.35, 13.0], scale: [1.4, 1.7, 1.4], rotationY: 1.5, type: "sphere", color: "#42764f" },
    { position: [22, 0.35, 13.0], scale: [1.3, 1.5, 1.3], rotationY: 0.9, type: "cone", color: "#497d57" },
  ] as TreeInstance[],

  // Parked cars along both curbs
  parkedCars: [
    // North curb (curb at Z ≈ -2.2m, facing left towards X-)
    { position: [18.0, 0.35, -2.0], rotationY: Math.PI, carIndex: 0 },
    { position: [0.0, 0.35, -2.0], rotationY: Math.PI, carIndex: 1 },
    { position: [-16.0, 0.35, -2.0], rotationY: Math.PI, carIndex: 2 },
    { position: [-32.0, 0.35, -2.0], rotationY: Math.PI, carIndex: 3 },
    // South curb (curb at Z ≈ +9.0m, facing right towards X+)
    { position: [10.0, 0.35, 9.0], rotationY: 0, carIndex: 3 },
    { position: [-8.0, 0.35, 9.0], rotationY: 0, carIndex: 0 },
    { position: [-24.0, 0.35, 9.0], rotationY: 0, carIndex: 2 },
  ] as ParkedCarSlot[],
};
