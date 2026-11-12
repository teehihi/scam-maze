/**
 * Publishes the effective comfort values (reduced motion, reduced stress, captions) to the chapter.
 * Components outside the provider keep the OS-only behavior (see useReducedMotion).
 */
import React, { createContext, useContext, useMemo } from "react";
import type { GameSettings, ReducedMotionSetting } from "@scammaze/shared-types";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";

export interface ComfortValue {
  /** Effective reduced motion: setting is "on", or "system" and the OS query matches. */
  reducedMotion: boolean;
  reducedStress: boolean;
  subtitlesEnabled: boolean;
}

/** Pure: effective reduced motion from the setting and the OS "reduce motion" query. */
export function effectiveReducedMotion(setting: ReducedMotionSetting, osQuery: boolean): boolean {
  return setting === "on" || (setting === "system" && osQuery);
}

/** null means "no provider": consumers fall back to the OS query. */
export const ComfortContext = createContext<ComfortValue | null>(null);

export type ComfortSettings = Pick<GameSettings, "reducedMotion" | "reducedStress" | "subtitlesEnabled">;

interface ComfortProviderProps {
  settings: ComfortSettings;
  children: React.ReactNode;
}

export const ComfortProvider: React.FC<ComfortProviderProps> = ({ settings, children }) => {
  const osQuery = usePrefersReducedMotion();
  const { reducedMotion: setting, reducedStress, subtitlesEnabled } = settings;
  const value = useMemo<ComfortValue>(
    () => ({
      reducedMotion: effectiveReducedMotion(setting, osQuery),
      reducedStress,
      subtitlesEnabled,
    }),
    [setting, osQuery, reducedStress, subtitlesEnabled],
  );
  return <ComfortContext.Provider value={value}>{children}</ComfortContext.Provider>;
};

/** The comfort values, or null when rendered outside a ComfortProvider. */
export function useComfort(): ComfortValue | null {
  return useContext(ComfortContext);
}
