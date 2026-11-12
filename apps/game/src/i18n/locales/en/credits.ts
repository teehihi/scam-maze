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
  viewSource: "View Source on Sketchfab",
  /** Label for a source that is plain text, not a web address. */
  sourceLabel: "Source:",
  groups: {
    environments: { category: "3D World Environments & Architecture" },
    vehicles: { category: "3D Vehicles & Street Props" },
    audio: { category: "Voice & Audio" },
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
    callPhone: {
      notes:
        "Handheld phone model used for phone calls. Optimized copy with the wallpaper removed and no visible brand marks.",
    },
    chapter1Voices: {
      notes:
        "Synthetic voices for Chapter 1 dialogue: Microsoft David, Mark and Zira (en-US) and Microsoft An (vi-VN). No real person's voice was cloned. Redistribution terms for the generated audio have not been verified.",
    },
    coreArchitecture: {
      notes: "First-person 3D scam investigation simulation built for Kiroween 2026.",
    },
  },
};

export default credits;
