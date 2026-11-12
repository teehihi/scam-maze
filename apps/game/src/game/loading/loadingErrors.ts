import enLoading from "../../i18n/locales/en/loading";

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

/**
 * English title and message per code: the source text in `i18n/locales/en/loading.ts`
 * (`errors.<code>`). The UI shows `loading:errors.<code>.title|message` for the current locale;
 * `title` and `message` here stay English for logs and existing callers.
 */
const ENGLISH_TEXT: Record<LoadingErrorCode, { title: string; message: string }> = enLoading.errors;

const RETRYABLE: Record<LoadingErrorCode, boolean> = {
  "invalid-chapter": false,
  "asset-missing": true,
  "asset-invalid": true,
  network: true,
  stalled: true,
  "unsupported-device": false,
  "webgl-init": true,
  "invalid-save": false,
  unknown: true,
};

export function createLoadingError(code: LoadingErrorCode, detail?: string): LoadingError {
  return { code, ...ENGLISH_TEXT[code], retryable: RETRYABLE[code], ...(detail ? { detail } : {}) };
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
