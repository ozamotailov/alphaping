/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TONCONNECT_MANIFEST: string;
  readonly VITE_ANALYTICS_TOKEN: string;
  readonly VITE_ANALYTICS_APP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
