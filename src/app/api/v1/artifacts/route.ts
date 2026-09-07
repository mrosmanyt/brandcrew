import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeArtifact } from "@/lib/job-serialize";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    const artifacts = await prisma.artifact.findMany({
      where: {
        workspaceId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return jsonOk({ artifacts: artifacts.map(serializeArtifact) });
  } catch (error) {
    return jsonError(error);
  }
}
