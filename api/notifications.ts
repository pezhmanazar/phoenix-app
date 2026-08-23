//api/notifications.ts
import { doJson } from "./user";

export type RegisterDevicePayload = {
  token: string;
  platform: "android" | "ios";
};

export async function registerDeviceToken(
  payload: RegisterDevicePayload
) {
  return doJson<{ success: boolean }>(
    "/api/notifications/register-device",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
}