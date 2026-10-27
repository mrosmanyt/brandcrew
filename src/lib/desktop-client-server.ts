/** Server-side detection of the Electron desk shell. */
export function isDesktopClientRequest(request: Request): boolean {
  const client = request.headers.get("x-cinem-client")?.trim().toLowerCase();
  return client === "desktop" || client === "electron";
}
