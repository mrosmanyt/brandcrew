/** True when the path is the workspace settings page (or a nested path under it). */
export function isSettingsFamilyPath(pathname: string, workspaceId: string) {
  const base = `/desk/${workspaceId}/settings`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
