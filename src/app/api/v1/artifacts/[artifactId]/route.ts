import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeArtifact } from "@/lib/job-serialize";

export async function GET(
  request: Request,
  context: { params: Promise<{ artifactId: string }> },
) {
  try {
    const { workspaceId } = await requireApiKey(request);
    const { artifactId } = await context.params;
    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, workspaceId },
    });
    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }
    return jsonOk({ artifact: serializeArtifact(artifact) });
  } catch (error) {
    return jsonError(error);
  }
}
