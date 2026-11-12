/**
 * English source text for the `credits` namespace.
 * Asset names, creators, license names and source URLs are not keys: they come from
 * `config/credits.ts` and are shown unchanged in every language.
 */
const credits = {
  title: "Project Credits & Verified 3D Assets",
  subtitle: "Acknowledging asset creators, open licenses, and contributors",
  licenseNotice:
    "SCAMMAZE strictly verifies third-party creative licenses. All 3D environment and vehicle assets used in the game street scene are published under {{license}} or permissive open-source licenses with attribution.",
  creatorLabel: "Creator:",
  viewSource: "View source",
  groups: {
    environments: { category: "3D World Environments & Architecture" },
    vehicles: { category: "3D Vehicles & Street Props" },
    music: { category: "Music" },
    project: { category: "Game Design, Narrative & Engineering" },
  },
  items: {
    menuStreetScene: {
      notes:
        "Detailed 3D Vietnamese neighborhood street with shophouses ('nhà phố'), Saigon skyline (Landmark 81, Bitexco), Bánh Mì street carts, electric vehicles, and local pedestrians.",
    },
    lowPolyCity: {
      notes:
        "Complete low poly city environment featuring street intersections, storefronts, mosque, windmills, vehicles and urban props.",
    },
    lowPolyCityGameReady: {
      notes:
        "Full neighborhood city environment with high-rise apartments, motel, diner, shops, multi-lane avenues, sidewalks, and street trees.",
    },
    lowPolyCityAssetPack: {
      notes: "Modular city buildings, storefronts, hospital, road sections, and street furniture.",
    },
    lowPolyCarsPack: {
      notes: "Low-poly vehicles, sedans, utility vans, and neighborhood parked cars.",
    },
    muaHaThu18: {
      notes: "Song played in the UEH courtyard (summer rain theme). Not covered by the project's MIT License.",
    },
    neuNgayMai: {
      notes:
        "Song played in the UEH courtyard (flame tree blossom theme), performed with Hồ Đá Chà Gươm. Not covered by the project's MIT License.",
    },
    coreArchitecture: {
      notes: "First-person 3D scam investigation simulation built for Kiroween 2026.",
    },
  },
};

export default credits;
