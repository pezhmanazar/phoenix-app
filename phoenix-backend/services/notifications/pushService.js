import prisma from "../../utils/prisma.js";

export async function sendPushToUser(userId, payload) {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!devices.length) {
      return {
        ok: false,
        error: "NO_ACTIVE_DEVICES",
      };
    }

    console.log("[PUSH_TARGETS]", {
      userId,
      devices: devices.length,
      payload,
    });

    return {
      ok: true,
      targets: devices.length,
    };
  } catch (error) {
    console.error(
      "[pushService.sendPushToUser]",
      error?.message || error
    );

    return {
      ok: false,
      error: "PUSH_SERVICE_ERROR",
    };
  }
}