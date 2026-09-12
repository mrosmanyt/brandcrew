import { requireDevice } from "@/lib/device-auth";
import { deviceSessionPayload } from "@/lib/device-desk";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const device = await requireDevice(request);
    return jsonOk(await deviceSessionPayload(device));
  } catch (error) {
    return jsonError(error);
  }
}
