import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { MCP_DIRECTORY, createMcpServer, listMcpServers } from "@/lib/chat-mcp";
import { jsonError, jsonOk } from "@/lib/http";

const postSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(500),
  headers: z.record(z.string().max(80), z.string().max(1000)).optional(),
});

/** GET /api/chat/mcp-servers — the user's MCP servers + the curated directory. */
export async function GET() {
  try {
    const user = await requireUser();
    const servers = await listMcpServers(user.id);
    return jsonOk({ servers, directory: MCP_DIRECTORY });
  } catch (error) {
    return jsonError(error);
  }
}

/** POST /api/chat/mcp-servers — add a server (custom or from the directory). */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = postSchema.parse(await request.json());
    const server = await createMcpServer(user.id, body);
    return jsonOk({ server }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(new Error("Give the server a name and a valid URL."));
    }
    return jsonError(error);
  }
}
