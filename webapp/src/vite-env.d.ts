/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TONCONNECT_MANIFEST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
