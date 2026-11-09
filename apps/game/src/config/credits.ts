export interface CreditItem {
  name: string;
  creator: string;
  sourceUrl: string;
  license: string;
  notes: string;
}

export interface CreditGroup {
  category: string;
  items: CreditItem[];
}

export const GAME_CREDITS: CreditGroup[] = [
  {
    category: "3D World Environments & Architecture",
    items: [
      {
        name: "Low Poly City Asset Pack",
        creator: "Calipo (https://sketchfab.com/ImJester)",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-city-asset-pack-decdce23606842988a8b4cbd09008584",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Modular city buildings, storefronts, hospital, road sections, street lights, and street furniture.",
      },
    ],
  },
  {
    category: "3D Vehicles & Street Props",
    items: [
      {
        name: "Low Poly Cars Pack",
        creator: "matisosanimation (https://sketchfab.com/matisosanimation)",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-cars-pack-1d942e1a2f564690a5d703fdc08657b3",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Low-poly vehicles, sedans, utility vans, and neighborhood parked cars.",
      },
    ],
  },
  {
    category: "Game Design, Narrative & Engineering",
    items: [
      {
        name: "SCAMMAZE Core Architecture",
        creator: "SCAMMAZE Team & Contributors",
        sourceUrl: "https://github.com/teehihi/scam-maze",
        license: "MIT License",
        notes: "First-person 3D scam investigation simulation built for Kiroween 2026.",
      },
    ],
  },
];
