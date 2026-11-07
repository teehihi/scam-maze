/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute URL of the separately deployed game application. Optional. */
  readonly VITE_GAME_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
