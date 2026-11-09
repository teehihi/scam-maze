/**
 * SCAMMAZE Main Menu Scene Layout & Composition
 * Defines street layout coordinates, lighting fixtures, props, and camera viewpoints.
 */

export interface StreetLightPoint {
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
  scale: number;
}

export const STREET_CONFIG = {
  // Road surface reference
  roadY: 0.35,

  // Camera settings (First person viewpoint on the sidewalk looking down the avenue)
  camera: {
    // Sidewalk viewpoint looking down the street avenue towards the vanishing point
    defaultPosition: [32, 2.05, 14] as [number, number, number],
    targetPosition: [-25, 2.3, 0] as [number, number, number],
    fov: 72,
    near: 0.1,
    far: 250,
  },

  // Street lighting fixtures (warm lantern glow placed along sidewalks)
  streetLights: [
    { position: [-22.1, 7.2, 3.5], color: "#ffc870", intensity: 2.8, distance: 16 },
    { position: [-19.1, 6.2, 1.3], color: "#ffc870", intensity: 2.5, distance: 14 },
    { position: [0.5, 6.5, 4.5], color: "#ffc870", intensity: 2.8, distance: 16 },
    { position: [18.5, 6.5, 4.5], color: "#ffc870", intensity: 2.8, distance: 16 },
    { position: [34.0, 5.5, 3.5], color: "#ffc870", intensity: 2.5, distance: 14 },
    // Opposite sidewalk lights
    { position: [-10.0, 6.5, 15.0], color: "#ffa850", intensity: 2.2, distance: 15 },
    { position: [10.0, 6.5, 15.0], color: "#ffa850", intensity: 2.2, distance: 15 },
  ] as StreetLightPoint[],

  // Stylized low-poly trees along the sidewalks
  trees: [
    { position: [42, 0.35, 7.5], scale: [1.2, 1.5, 1.2], rotationY: 0.2, type: "dodeca", color: "#3e704b" },
    { position: [26, 0.35, 7.5], scale: [1.1, 1.4, 1.1], rotationY: 1.1, type: "sphere", color: "#477c55" },
    { position: [8, 0.35, 7.5], scale: [1.3, 1.6, 1.3], rotationY: 2.3, type: "cone", color: "#376241" },
    { position: [-6, 0.35, 7.5], scale: [1.1, 1.3, 1.1], rotationY: 0.8, type: "dodeca", color: "#42754f" },
    { position: [-28, 0.35, 7.5], scale: [1.4, 1.7, 1.4], rotationY: 1.7, type: "sphere", color: "#3b6946" },
    // Opposite sidewalk trees
    { position: [22, 0.35, 16.5], scale: [1.3, 1.5, 1.3], rotationY: 0.5, type: "cone", color: "#4a7e58" },
    { position: [4, 0.35, 16.5], scale: [1.2, 1.4, 1.2], rotationY: 2.1, type: "dodeca", color: "#3d6b47" },
    { position: [-14, 0.35, 16.5], scale: [1.3, 1.6, 1.3], rotationY: 1.4, type: "sphere", color: "#437851" },
  ] as TreeInstance[],

  // Parked cars positions along curbs
  parkedCars: [
    { position: [14.0, 0.35, 8.5], rotationY: 0, scale: 0.75 },
    { position: [-2.0, 0.35, 8.5], rotationY: 0, scale: 0.75 },
    { position: [28.0, 0.35, 13.5], rotationY: Math.PI, scale: 0.75 },
    { position: [-12.0, 0.35, 13.5], rotationY: Math.PI, scale: 0.75 },
  ] as ParkedCarSlot[],
};
