/// <reference types="vite/client" />

interface CinemDesktopBridge {
  desktop: boolean;
  shell?: string;
  openExternal?: (url: string) => Promise<boolean | void>;
  verifyShell?: (nonce: string) => Promise<boolean>;
  ping?: () => Promise<string>;
  getStoredSession?: () => Promise<{ refreshToken?: string } | null>;
  storeSession?: (session: { refreshToken?: string }) => Promise<unknown>;
  setMode?: (mode: string) => void;
  openDesk?: () => void;
}

interface Window {
  cinemDesktop?: CinemDesktopBridge;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CINEM_CLOUD_URL: string;
  readonly VITE_CINEM_UPGRADE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
