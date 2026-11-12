/**
 * English source text for the `chapters` namespace.
 *
 * Chapter keys are chapter IDs from `game/chapters/chapterRegistry.ts`, and asset keys are the
 * asset IDs of that chapter. The registry keeps the same English text as its own source, and the
 * UI falls back to it for a chapter or asset that has no key here.
 */
const chapters = {
  "chapter-1": {
    title: "The Urgent Call",
    subtitle: "The notification arrives before breakfast.",
    assets: {
      "street-environment": "Loading the street",
      sky: "Loading the sky",
      "call-phone": "Loading the phone",
      "city-district": "Loading the neighborhood",
      "city-cars": "Loading the parked cars",
    },
  },
  scenes: {
    "main-menu": "Main menu",
    "intro-prologue": "Prologue",
    apartment: "Apartment",
    street: "Street",
  },
  placeholder: {
    heading: "Gameplay for this chapter is still in development.",
    body: "The chapter files loaded and the starting state was created, but the playable scene is not built yet.",
    startLabel: "Starting location",
    originLabel: "Started from",
    origin: {
      "new-game": "New game",
      "saved-game": "Saved game",
    },
  },
};

export default chapters;
