import { dispatchApi } from "@/server/api/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteCtx) {
  const { path } = await context.params;
  return dispatchApi(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
