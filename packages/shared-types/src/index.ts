/**
 * SCAMMAZE Shared Types & Contracts
 * Pure TypeScript definitions shared between apps and packages.
 * No framework dependencies (no React, no Three.js).
 */

export type SceneId = 'main-menu' | 'intro-prologue' | 'apartment' | 'street';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  soundEnabled: boolean;
  musicVolume: number; // 0.0 to 1.0
  sfxVolume: number;   // 0.0 to 1.0
  fov: number;         // Field of View, e.g. 65 - 85
}

export interface CreditEntry {
  category: string;
  items: {
    title: string;
    author: string;
    license: string;
    sourceUrl?: string;
    notes?: string;
  }[];
}

export type ScamThreatCategory =
  | 'urgency-impersonation'
  | 'smishing-otp'
  | 'marketplace-advance-fee'
  | 'fake-job-deposit'
  | 'qr-code-tamper';

export interface ScenarioMeta {
  id: string;
  title: string;
  chapter: number;
  category: ScamThreatCategory;
  description: string;
  learningGoal: string;
}
