import { NextResponse } from "next/server";
import {
  DESKTOP_BUILD_REQUIRED_CODE,
  DESKTOP_BUILD_REQUIRED_MESSAGE,
  intentRequiresDesktopBuild,
} from "@/lib/build-gate";
import { isDesktopClientRequest } from "@/lib/desktop-client-server";

export function desktopBuildRequiredResponse(request: Request, input: {
  action?: string | null;
  playbookKey?: string | null;
  message?: string | null;
}) {
  if (!intentRequiresDesktopBuild(input)) return null;
  if (isDesktopClientRequest(request)) return null;
  return NextResponse.json(
    {
      error: DESKTOP_BUILD_REQUIRED_MESSAGE,
      code: DESKTOP_BUILD_REQUIRED_CODE,
      desktopRequired: true,
    },
    { status: 403 },
  );
}
