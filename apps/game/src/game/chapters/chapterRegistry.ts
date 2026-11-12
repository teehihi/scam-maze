import type { SceneId } from "@scammaze/shared-types";
import { CALL_PHONE_GLB, CITY_CARS_GLB, CITY_DISTRICT_GLB, SKY_TEXTURE, STREET_ENVIRONMENT_GLB } from "../../config/assetPaths";

export type ChapterAssetKind = "gltf" | "image";

export interface ChapterAsset {
  /** Stable identifier, unique within the chapter. */
  id: string;
  /** Public URL of the file. */
  url: string;
  kind: ChapterAssetKind;
  /**
   * English status text shown while this file downloads. The UI shows the translation from
   * `chapters:<chapterId>.assets.<assetId>` and falls back to this text.
   */
  loadingText: string;
  /**
   * When true, a failed download or verification of this file does not block the chapter: the
   * loader marks the asset as skipped and continues. Required assets (the default) still fail the
   * chapter.
   */
  optional?: boolean;
}

export interface ChapterDefinition {
  id: string;
  number: number;
  title: string;
  /** Short narrative line shown on the loading screen. */
  subtitle: string;
  startSceneId: SceneId;
  sceneIds: readonly SceneId[];
  /** Files the start scene needs before the chapter can begin. */
  assets: readonly ChapterAsset[];
  /**
   * True only when a playable scene exists for this chapter. When true, the App shell renders
   * the chapter page after loading. While false, the loading pipeline still runs for real,
   * and the player lands on an honest "in development" screen.
   */
  gameplayAvailable: boolean;
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: "chapter-1",
    number: 1,
    title: "The Urgent Call",
    subtitle: "The notification arrives before breakfast.",
    startSceneId: "street",
    sceneIds: ["apartment", "street"],
    assets: [
      {
        id: "street-environment",
        url: STREET_ENVIRONMENT_GLB,
        kind: "gltf",
        loadingText: "Loading the street",
      },
      {
        id: "sky",
        url: SKY_TEXTURE,
        kind: "image",
        loadingText: "Loading the sky",
      },
      {
        id: "call-phone",
        url: CALL_PHONE_GLB,
        kind: "gltf",
        loadingText: "Loading the phone",
        optional: true,
      },
      {
        id: "city-district",
        url: CITY_DISTRICT_GLB,
        kind: "gltf",
        loadingText: "Loading the neighborhood",
        optional: true,
      },
      {
        id: "city-cars",
        url: CITY_CARS_GLB,
        kind: "gltf",
        loadingText: "Loading the parked cars",
        optional: true,
      },
    ],
    // Playable: the App shell renders features/chapter1/ChapterOnePage after loading.
    gameplayAvailable: true,
  },
];

export const DEFAULT_CHAPTER_ID = "chapter-1";

export function getChapter(chapterId: string): ChapterDefinition | undefined {
  return CHAPTERS.find((chapter) => chapter.id === chapterId);
}

/** English scene labels (source text). The UI translates them with `chapters:scenes.<SceneId>`. */
export const SCENE_LABELS: Record<SceneId, string> = {
  "main-menu": "Main menu",
  "intro-prologue": "Prologue",
  apartment: "Apartment",
  street: "Street",
};
