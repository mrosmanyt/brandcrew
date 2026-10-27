import { jsonError, jsonOk } from "@/lib/http";
import { foundingSpotsSnapshot } from "@/lib/founding-members";

/** Public founding-member counter for landing + signup. */
export async function GET() {
  try {
    const spots = await foundingSpotsSnapshot();
    return jsonOk({
      product: "cinem-ai-assistant",
      ...spots,
      message: spots.open
        ? `${spots.remaining} of ${spots.total} free assistant spots left`
        : "Founding spots are full — Cinem AI Assistant is paid for new members",
    });
  } catch (error) {
    return jsonError(error);
  }
}
