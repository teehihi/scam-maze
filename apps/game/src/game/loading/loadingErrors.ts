export type LoadingErrorCode =
  | "invalid-chapter"
  | "asset-missing"
  | "asset-invalid"
  | "network"
  | "stalled"
  | "unsupported-device"
  | "webgl-init"
  | "invalid-save"
  | "unknown";

export interface LoadingError {
  code: LoadingErrorCode;
  title: string;
  message: string;
  /** False when trying again cannot help (for example a damaged save). */
  retryable: boolean;
  /** Technical detail for bug reports. Plain text, never rendered as a link. */
  detail?: string;
}

const MESSAGES: Record<LoadingErrorCode, Omit<LoadingError, "code" | "detail">> = {
  "invalid-chapter": {
    title: "Chapter not found",
    message: "This chapter does not exist or is not available yet. Return to the menu to choose again.",
    retryable: false,
  },
  "asset-missing": {
    title: "Game files are missing",
    message:
      "A file this chapter needs was not found on the server. Try again. If this keeps happening, the game may be updating.",
    retryable: true,
  },
  "asset-invalid": {
    title: "Game files could not be read",
    message: "A file this chapter needs was damaged or in the wrong format. Try again.",
    retryable: true,
  },
  network: {
    title: "Connection problem",
    message: "The game files could not be downloaded. Check your internet connection and try again.",
    retryable: true,
  },
  stalled: {
    title: "Loading stopped",
    message: "The download stopped responding. Check your internet connection and try again.",
    retryable: true,
  },
  "unsupported-device": {
    title: "This browser cannot show the 3D world",
    message:
      "SCAMMAZE needs WebGL 2, the browser feature that draws 3D graphics. Try a recent version of Chrome, Edge, Firefox or Safari.",
    retryable: false,
  },
  "webgl-init": {
    title: "3D graphics could not start",
    message:
      "The browser could not start 3D graphics. Turn on hardware acceleration in your browser settings, close other 3D tabs, and try again.",
    retryable: true,
  },
  "invalid-save": {
    title: "Saved game could not be loaded",
    message:
      "Your saved progress is damaged or from an older version of the game. Return to the menu and start a new game.",
    retryable: false,
  },
  unknown: {
    title: "Something went wrong",
    message: "Loading failed for an unexpected reason. Try again.",
    retryable: true,
  },
};

export function createLoadingError(code: LoadingErrorCode, detail?: string): LoadingError {
  return { code, ...MESSAGES[code], ...(detail ? { detail } : {}) };
}

/** Error thrown inside the pipeline; carries a classified code. */
export class AssetLoadError extends Error {
  readonly code: LoadingErrorCode;

  constructor(code: LoadingErrorCode, message: string) {
    super(message);
    this.name = "AssetLoadError";
    this.code = code;
  }
}
