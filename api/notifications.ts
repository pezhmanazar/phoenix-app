// api/notifications.ts

import { doJson } from "./user";

/* ---------------- Register Device ---------------- */

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

/* ---------------- Notification Center ---------------- */

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;

  data: Record<string, unknown> | null;

  campaignId: string | null;

  createdAt: string;
};

type NotificationListData = {
  items: AppNotification[];
};

export async function getNotifications(): Promise<
  AppNotification[]
> {
  const result = await doJson<NotificationListData>(
    "/api/notifications",
    {
      method: "GET",
    }
  );

  if (!result.ok) {
    throw new Error(
      result.error || "NOTIFICATIONS_FAILED"
    );
  }

  return result.data?.items || [];
}