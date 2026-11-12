/** Stable IDs used for translation keys (`credits:groups.<id>.category`). */
export type CreditGroupId = "environments" | "vehicles" | "music" | "project";

/** Stable IDs used for translation keys (`credits:items.<id>.notes`). */
export type CreditItemId =
  | "menuStreetScene"
  | "lowPolyCity"
  | "lowPolyCityGameReady"
  | "lowPolyCityAssetPack"
  | "lowPolyCarsPack"
  | "muaHaThu18"
  | "neuNgayMai"
  | "callPhone"
  | "coreArchitecture";

/**
 * One credited asset. `name`, `creator`, `sourceUrl` and `license` are shown unchanged in every
 * language. `notes` is the English source; the UI reads `credits:items.<id>.notes`.
 */
export interface CreditItem {
  id: CreditItemId;
  name: string;
  creator: string;
  sourceUrl: string;
  license: string;
  notes: string;
}

/** `category` is the English source; the UI reads `credits:groups.<id>.category`. */
export interface CreditGroup {
  id: CreditGroupId;
  category: string;
  items: CreditItem[];
}

export const GAME_CREDITS: CreditGroup[] = [
  {
    id: "environments",
    category: "3D World Environments & Architecture",
    items: [
      {
        id: "menuStreetScene",
        name: "Unity-Authored Vietnamese Urban Street Scene (MenuBG.glb)",
        creator: "SCAMMAZE Team & Unity 2022.3 Scene Authors",
        sourceUrl: "Local Authoring / Kiroween Asset3D",
        license: "Proprietary Project Asset / CC-BY Attribution Mix",
        notes: "Detailed 3D Vietnamese neighborhood street with shophouses ('nhà phố'), Saigon skyline (Landmark 81, Bitexco), Bánh Mì street carts, electric vehicles, and local pedestrians.",
      },
      {
        id: "lowPolyCity",
        name: "Low Poly City",
        creator: "Sketchfab Community",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-city",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Complete low poly city environment featuring street intersections, storefronts, mosque, windmills, vehicles and urban props.",
      },
      {
        id: "lowPolyCityGameReady",
        name: "Low Poly City Game-Ready",
        creator: "costoWRLD (Sketchfab)",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-city-game-ready-e39be33fa0f443bca4162e084323b7e7",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Full neighborhood city environment with high-rise apartments, motel, diner, shops, multi-lane avenues, sidewalks, and street trees.",
      },
      {
        id: "lowPolyCityAssetPack",
        name: "Low Poly City Asset Pack",
        creator: "Calipo (https://sketchfab.com/ImJester)",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-city-asset-pack-decdce23606842988a8b4cbd09008584",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Modular city buildings, storefronts, hospital, road sections, and street furniture.",
      },
    ],
  },
  {
    id: "vehicles",
    category: "3D Vehicles & Street Props",
    items: [
      {
        id: "lowPolyCarsPack",
        name: "Low Poly Cars Pack",
        creator: "matisosanimation (https://sketchfab.com/matisosanimation)",
        sourceUrl: "https://sketchfab.com/3d-models/low-poly-cars-pack-1d942e1a2f564690a5d703fdc08657b3",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Low-poly vehicles, sedans, utility vans, and neighborhood parked cars.",
      },
      {
        id: "callPhone",
        name: "call-phone.optimized.glb",
        creator: "not stated",
        sourceUrl: "Owner-provided file iphone-17-pro.glb (source URL not provided)",
        license: "Free to use (owner statement, 2026-11-12)",
        notes: "Handheld phone model used for phone calls. Optimized copy with the wallpaper removed and no visible brand marks.",
      },
    ],
  },
  {
    id: "music",
    category: "Music",
    items: [
      {
        id: "muaHaThu18",
        name: "Mùa Hạ Thứ 18",
        creator: "Lê Quốc Khánh (Men Le), SCAMMAZE contributor",
        sourceUrl: "Recording provided by the author (not published online)",
        license: "All rights reserved. Used in SCAMMAZE with the author's permission",
        notes: "Song played in the UEH courtyard (summer rain theme). Not covered by the project's MIT License.",
      },
      {
        id: "neuNgayMai",
        name: "Nếu ngày mai",
        creator: "Lê Quốc Khánh (Men Le), SCAMMAZE contributor",
        sourceUrl: "https://open.spotify.com/track/2AkPSNohBGtrZMGeTtwV12",
        license: "All rights reserved. Used in SCAMMAZE with the author's permission",
        notes: "Song played in the UEH courtyard (flame tree blossom theme), performed with Hồ Đá Chà Gươm. Not covered by the project's MIT License.",
      },
    ],
  },
  {
    id: "project",
    category: "Game Design, Narrative & Engineering",
    items: [
      {
        id: "coreArchitecture",
        name: "SCAMMAZE Core Architecture",
        creator: "SCAMMAZE Team & Contributors",
        sourceUrl: "https://github.com/teehihi/scam-maze",
        license: "MIT License",
        notes: "First-person 3D scam investigation simulation built for Kiroween 2026.",
      },
    ],
  },
];
