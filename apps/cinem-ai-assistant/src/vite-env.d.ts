/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CINEM_CLOUD_URL: string;
  readonly VITE_CINEM_UPGRADE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
