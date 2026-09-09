/**
 * Shared protocol between desk APIs, the MV3 extension, and the native host.
 * Keep JSON shapes stable — the extension is plain JS and duplicates constants.
 */

export const NATIVE_HOST_NAME = "com.cinem.pro.agent";
export const DEVICE_TOKEN_PREFIX = "cinem_dev_";
export const DEVICE_PAIRING_TTL_MS = 10 * 60 * 1000;
export const DEVICE_ONLINE_MS = 45_000;
export const DEVICE_COMMAND_WAIT_MS = 12_000;
export const NATIVE_HTTP_PORT = 43181;

export const DEVICE_TOOLS = [
  "browser_navigate",
  "browser_snapshot",
  "browser_click",
  "browser_type",
  "browser_extract",
  "browser_screenshot",
  "native_file_read",
  "native_file_write",
  "native_long_job",
] as const;

export type DeviceTool = (typeof DEVICE_TOOLS)[number];

export type DeviceCommandArgs = Record<string, unknown>;

export type DevicePageResult = {
  url: string;
  ok: boolean;
  title?: string;
  text: string;
  excerpt: string;
  links?: string[];
  engine: "cdp" | "native" | "playwright" | "fetch";
  error?: string;
};

export type DeviceCommandResult = {
  ok: boolean;
  page?: DevicePageResult;
  excerpt?: string;
  extracted?: string;
  screenshot?: string;
  fileText?: string;
  error?: string;
  engine?: DevicePageResult["engine"];
  abortedDomain?: string;
};

export function isDeviceTool(tool: string): tool is DeviceTool {
  return (DEVICE_TOOLS as readonly string[]).includes(tool);
}

export function pairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function isDeviceOnline(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const ts = typeof lastSeenAt === "string" ? Date.parse(lastSeenAt) : lastSeenAt.getTime();
  if (!Number.isFinite(ts)) return false;
  return now - ts <= DEVICE_ONLINE_MS;
}
