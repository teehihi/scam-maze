/**
 * SCAMMAZE Main Menu Scene Layout & Composition
 * Built for "Low Poly City Game-Ready" (1:1 Metric World Scale).
 * Main avenue runs along Z-axis from Z = -35m to Z = -150m.
 * Road surface is at Y = 0.05m.
 * Human eye-level camera height is Y = 1.85m.
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
  carIndex: number; // 0 = Red Sedan, 1 = Yellow Taxi, 2 = Blue Hatchback, 3 = White Van, 4 = Yellow Cab Van, 5 = Silver Pickup
}

export const STREET_CONFIG = {
  // Road & eye level reference
  groundY: 0.05,
  eyeHeightY: 1.85,

  // Camera settings (First person viewpoint on the avenue looking past the Motel & Diner towards city towers)
  camera: {
    defaultPosition: [-1.2, 1.85, -38.0] as [number, number, number],
    targetPosition: [-1.0, 7.5, -135.0] as [number, number, number],
    fov: 68,
    near: 0.1,
    far: 450,
  },

  // Street lighting fixtures (warm lantern glow placed along sidewalks)
  streetLights: [
    { position: [-6.8, 5.5, -48.0], color: "#ffc266", intensity: 3.5, distance: 22 },
    { position: [6.8, 5.5, -52.0], color: "#ffc266", intensity: 3.5, distance: 22 },
    { position: [-6.8, 5.5, -72.0], color: "#ffbe5c", intensity: 3.5, distance: 22 },
    { position: [6.8, 5.5, -76.0], color: "#ffbe5c", intensity: 3.5, distance: 22 },
    { position: [-6.8, 5.5, -96.0], color: "#ffbe5c", intensity: 3.5, distance: 22 },
    { position: [6.8, 5.5, -100.0], color: "#ffbe5c", intensity: 3.5, distance: 22 },
  ] as StreetLightFixture[],

  // Parked cars along avenue curbs (West curb at X ≈ -4.8m, East curb at X ≈ +4.8m)
  // Car orientation: front is +X in car local space.
  // To face along -Z (down the street): rotationY = Math.PI / 2
  // To face along +Z (up the street): rotationY = -Math.PI / 2
  parkedCars: [
    // West curb (facing down the avenue towards -Z)
    { position: [-4.75, 0.05, -54.0], rotationY: Math.PI / 2, carIndex: 1 },  // Yellow Taxi
    { position: [-4.75, 0.05, -74.0], rotationY: Math.PI / 2, carIndex: 3 },  // White Delivery Van
    { position: [-4.75, 0.05, -96.0], rotationY: Math.PI / 2, carIndex: 0 },  // Red Sedan
    { position: [-4.75, 0.05, -118.0], rotationY: Math.PI / 2, carIndex: 2 }, // Blue Hatchback

    // East curb (facing up the avenue towards +Z)
    { position: [4.75, 0.05, -50.0], rotationY: -Math.PI / 2, carIndex: 0 },   // Red Sedan
    { position: [4.75, 0.05, -68.0], rotationY: -Math.PI / 2, carIndex: 5 },   // Silver Pickup
    { position: [4.75, 0.05, -90.0], rotationY: -Math.PI / 2, carIndex: 4 },   // Yellow Cab Van
    { position: [4.75, 0.05, -112.0], rotationY: -Math.PI / 2, carIndex: 1 },  // Yellow Taxi
  ] as ParkedCarSlot[],
};
