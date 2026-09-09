import { requireDevice, serializeDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const device = await requireDevice(request);
    const nativeHost =
      request.headers.get("x-cinem-native-host") === "1" || device.nativeHost;
    const row = await prisma.localDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        status: "online",
        nativeHost,
      },
    });
    return jsonOk({ device: serializeDevice(row), ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
