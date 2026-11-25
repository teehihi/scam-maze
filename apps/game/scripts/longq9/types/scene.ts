export type SceneId =
  | 'patrol_cruise'
  | 'meet_road'
  | 'crouch_tire'
  | 'sit_wrench'
  | 'happy_done'
  | 'studio_rig';

export type PosePresetId =
  | 'driving_active'
  | 'riding_wave'
  | 'crouch_tire'
  | 'sit_wrench'
  | 'thumbs_up'
  | 'kneel_pump'
  | 't_pose';

export type LightingPreset = 'morning' | 'golden' | 'studio';

export interface CustomPoseAdjustments {
  spineLean: number;      // -25 to +45 deg
  headYaw: number;        // -45 to +45 deg
  headPitch: number;      // -25 to +30 deg
  armLForward: number;    // -40 to +90 deg
  armLLift: number;       // -60 to +80 deg
  armRForward: number;    // -40 to +90 deg
  armRLift: number;       // -60 to +80 deg
  squatDepth: number;     // 0 to 1 (extra crouch offset)
  bodyTurn: number;       // -180 to +180 deg
}

export interface SpeechBubbleConfig {
  id: string;
  speaker: 'long' | 'student';
  speakerLabel: string;
  text: string;
  worldAnchor: [number, number, number];
}

export interface HotspotConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  worldPosition: [number, number, number];
  cameraOffset: [number, number, number];
}

export interface SceneChapter {
  id: SceneId;
  step: string;
  shortTitle: string;
  title: string;
  locationTag: string;
  caption: string;
  photoRefNote: string;
  defaultPose: PosePresetId;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  speechBubbles: SpeechBubbleConfig[];
  hotspots: HotspotConfig[];
}

export interface AssetVisibility {
  chuLong: boolean;
  xeWave: boolean;
  studentAndCub: boolean;
  repairTools: boolean;
  streetEnvironment: boolean;
}

export interface ModelStats {
  longVertices: number;
  longTriangles: number;
  waveVertices: number;
  waveTriangles: number;
  bonesCount: number;
}
