/// <reference types="vite/client" />

interface CinemDesktopBridge {
  desktop: boolean;
  shell?: string;
  openExternal?: (url: string) => Promise<boolean | void>;
  verifyShell?: (nonce: string) => Promise<boolean>;
  ping?: () => Promise<string>;
  getStoredSession?: () => Promise<{ refreshToken?: string } | null>;
  storeSession?: (session: { refreshToken?: string; accessToken?: string }) => Promise<unknown>;
  onSession?: (handler: (payload: { refreshToken?: string }) => void) => () => void;
  setMode?: (mode: string) => void;
  openDesk?: () => void;
  openUpdates?: () => void;
  getVoiceEnv?: () => { FISH_AUDIO_API_KEY?: string; DEEPGRAM_API_KEY?: string };
  httpGet?: (
    url: string,
    opts?: { worldMonitorKey?: string },
  ) => Promise<{ ok: boolean; status: number; text: string }>;
  updates?: {
    getState: () => Promise<Record<string, unknown>>;
    check: (opts?: { auto?: boolean; silent?: boolean }) => Promise<Record<string, unknown>>;
    download: () => Promise<Record<string, unknown>>;
    install: () => Promise<{ ok?: boolean }>;
    setAutoUpdate: (enabled: boolean) => Promise<Record<string, unknown>>;
    onStatus: (handler: (payload: Record<string, unknown>) => void) => () => void;
  };
}

interface Window {
  cinemDesktop?: CinemDesktopBridge;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_CINEM_CLOUD_URL: string;
  readonly VITE_CINEM_UPGRADE_URL: string;
  readonly VITE_FISH_AUDIO_API_KEY?: string;
  readonly VITE_FISH_API_KEY?: string;
  readonly VITE_DEEPGRAM_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
