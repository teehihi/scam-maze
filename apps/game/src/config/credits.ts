/** Stable IDs used for translation keys (`credits:groups.<id>.category`). */
export type CreditGroupId = "environments" | "vehicles" | "music" | "audio" | "project";

/** Stable IDs used for translation keys (`credits:items.<id>.notes`). */
export type CreditItemId =
  | "menuStreetScene"
  | "lowPolyCity"
  | "lowPolyCityGameReady"
  | "lowPolyCityAssetPack"
  | "lowPolyCarsPack"
  | "mercedesA45"
  | "muaHaThu18"
  | "neuNgayMai"
  | "callPhone"
  | "plasticChairs"
  | "plasticTableSet"
  | "superCub"
  | "fatBoyCruiser"
  | "hondaCg125"
  | "parkedBikesUnattributed"
  | "chapter1Voices"
  | "coreArchitecture";

/**
 * One credited asset. `name`, `creator`, `sourceUrl` and `license` are shown unchanged in every
 * language. An empty `sourceUrl` shows no source line. `notes` is the English source; the UI reads `credits:items.<id>.notes`.
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
        id: "mercedesA45",
        name: "2023 Mercedes-Benz A45 S AMG 4Matic",
        creator: "Ddiaz Design (https://sketchfab.com/ddiaz-design)",
        sourceUrl: "https://sketchfab.com/3d-models/2023-mercedes-benz-a45-s-amg-4matic-7dcef373c52c44ffb0bfbd85a1da1ed2",
        license: "Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA 4.0)",
        notes: "Drivable car on the Huế map. Converted to a single Meshopt + WebP GLB and scaled to metres; shared under the same license.",
      },
      {
        id: "callPhone",
        name: "call-phone.optimized.glb",
        creator: "not stated",
        sourceUrl: "", // No source line is shown for this item.
        license: "Free to use (owner statement, 2026-11-12)",
        notes: "Handheld phone model used for phone calls. Optimized copy with the wallpaper removed and no visible brand marks.",
      },
      {
        id: "plasticChairs",
        name: "Vietnamese Plastic Chair (low stool and tall chair)",
        creator: "Kiisaku (https://sketchfab.com/kiisaku)",
        sourceUrl: "https://sketchfab.com/3d-models/vietnamese-plastic-chair-25c585737c014827bfa3b56c2b680581",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Low stools and the tall chair on the neighborhood street. Simplified and converted to Meshopt + WebP. Tall chair: https://sketchfab.com/3d-models/vietnamese-plastic-chair-efa69b6b78cc48248f758aec21369447",
      },
      {
        id: "plasticTableSet",
        name: "table chair plastic - bàn ghế nhựa Việt Nam",
        creator: "minchou19 (https://sketchfab.com/minchou19)",
        sourceUrl: "https://sketchfab.com/3d-models/table-chair-plastic-ban-ghe-nhua-viet-nam-8216465bc93142f89f7cd38446be6432",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Table-and-stools sets in front of the neighborhood cafes and pho shops. Simplified and converted to Meshopt.",
      },
      {
        id: "superCub",
        name: "Honda Super cub",
        creator: "Aleksandr Sagidullin (https://sketchfab.com/jintrim3)",
        sourceUrl: "https://sketchfab.com/3d-models/honda-super-cub-9ce554228fc746c89f6d02b995f43c41",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Parked bike on the neighborhood street. Simplified and converted to Meshopt + WebP.",
      },
      {
        id: "fatBoyCruiser",
        name: "Motorcycle (Harley Davidson Fat Boy inspired)",
        creator: "christianchristian (https://sketchfab.com/chriisjvr)",
        sourceUrl: "https://sketchfab.com/3d-models/motorcycle-harley-davidson-fat-boy-inspired-4e7dc9622b3b457793fadeed4b5b2ff0",
        license: "Creative Commons Attribution (CC-BY 4.0)",
        notes: "Parked bike on the neighborhood street. Simplified and converted to Meshopt + WebP.",
      },
      {
        id: "hondaCg125",
        name: "Motorbike - Honda CG 125",
        creator: "LazyAstronaut3D (https://sketchfab.com/LazyAstronaut)",
        sourceUrl: "https://sketchfab.com/3d-models/motorbike-honda-cg-125-88a3e4989054480f9485cc658419de47",
        license: "Sketchfab Standard License",
        notes: "Parked bike on the neighborhood street. Simplified and converted to Meshopt + WebP; the source file is not redistributed.",
      },
      {
        id: "parkedBikesUnattributed",
        name: "Scooter and custom bobber (parked bikes)",
        creator: "not stated",
        sourceUrl: "",
        license: "Not stated (owner-supplied, to be confirmed)",
        notes: "Two parked bike models supplied without author or license information. The scooter's brand logo and license plate were removed.",
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
    id: "audio",
    category: "Voice & Audio",
    items: [
      {
        id: "chapter1Voices",
        name: "Chapter 1 voice clips",
        creator: "Windows built-in speech voices (Microsoft David, Microsoft Mark, Microsoft Zira, Microsoft An), generated locally by the SCAMMAZE Team",
        sourceUrl: "apps/game/scripts/generate-chapter1-voice.mjs",
        license: "Terms of use not verified",
        notes: "Synthetic voices for Chapter 1 dialogue: Microsoft David, Mark and Zira (en-US) and Microsoft An (vi-VN). No real person's voice was cloned. Redistribution terms for the generated audio have not been verified.",
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
