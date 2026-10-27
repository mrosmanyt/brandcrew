import { getFounderAvailability } from "@/lib/helpdesk";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    return jsonOk(await getFounderAvailability());
  } catch (error) {
    return jsonError(error);
  }
}
