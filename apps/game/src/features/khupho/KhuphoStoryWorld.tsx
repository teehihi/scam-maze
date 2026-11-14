import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import { Engine, type BuildStep, type Hud, type StoryEvent } from "./world/engine";
import { setTranslator } from "./world/strings";

/** Quality names the engine understands, keyed by the game's graphics setting. */
const ENGINE_QUALITY = { low: "low", medium: "med", high: "high" } as const;

export interface KhuphoStoryWorldProps {
  settings: GameSettings;
  /** Build progress for the loading screen (step, 0..1 inside the step). */
  onProgress: (step: BuildStep, fraction: number) => void;
  /** The world is built, compiled, warmed up and drawing steady frames. */
  onReady: (engine: Engine) => void;
  onHud: (hud: Hud) => void;
  onStory: (event: StoryEvent) => void;
  onError: (message: string) => void;
  /** The player came near house no. 59 (build the room now). */
  onNearHome?: () => void;
  /** The player stepped into the white doorway behind the rear bedroom's door in house no. 59. */
  onEnterHome?: () => void;
}

/**
 * The neighborhood as the story's first scene: only the 3D view. The prologue page owns all of
 * the interface (intro, prompts, pause menu, the call home), so nothing here is drawn on top.
 */
export const KhuphoStoryWorld: React.FC<KhuphoStoryWorldProps> = ({ settings, onProgress, onReady, onHud, onStory, onError, onNearHome, onEnterHome }) => {
  const { t } = useTranslation("worlds");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const callbacks = useRef({ onProgress, onReady, onHud, onStory, onError, onNearHome, onEnterHome });
  callbacks.current = { onProgress, onReady, onHud, onStory, onError, onNearHome, onEnterHome };
  const qualityRef = useRef(settings.graphicsQuality);
  qualityRef.current = settings.graphicsQuality;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let engine: Engine | null = null;
    let cancelled = false;
    setTranslator((key, options) => (t as unknown as (k: string, o?: object) => string)(key, options));
    Engine.create(
      el,
      (hud) => callbacks.current.onHud(hud),
      { story: true, onStory: (event) => callbacks.current.onStory(event), quality: ENGINE_QUALITY[qualityRef.current], onNearHome: () => callbacks.current.onNearHome?.(), onEnterHome: () => callbacks.current.onEnterHome?.() },
      (step, fraction) => callbacks.current.onProgress(step, fraction),
      () => cancelled,
    )
      .then((built) => {
        if (cancelled) {
          built.dispose();
          return;
        }
        engine = built;
        callbacks.current.onReady(built);
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!cancelled) callbacks.current.onError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      engine?.dispose();
    };
    // Built once per mount; the language is read live by the translator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0" />;
};
