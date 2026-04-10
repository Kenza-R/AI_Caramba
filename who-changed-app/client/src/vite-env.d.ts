/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** e.g. http://127.0.0.1:3001 when the UI is not using the Vite proxy */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
