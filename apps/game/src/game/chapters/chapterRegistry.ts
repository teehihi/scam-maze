import type { SceneId } from "@scammaze/shared-types";
import { SKY_TEXTURE, STREET_ENVIRONMENT_GLB } from "../../config/assetPaths";

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
