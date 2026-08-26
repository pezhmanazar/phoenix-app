// api/notifications.ts

import { toAppApi } from "../constants/env";
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
  readAt: string | null;

  createdAt: string;
};

type NotificationListData = {
  items: AppNotification[];
};

export async function getNotifications(): Promise<
  AppNotification[]
> {
  const result = await doJson<NotificationListData>(
  toAppApi("/api/notifications"),
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

export async function getUnreadNotificationCount(): Promise<number> {
  const result = await doJson<{
    count: number;
  }>(
    toAppApi("/api/notifications/unread-count"),
    {
      method: "GET",
    }
  );

  if (!result.ok) {
    throw new Error(
      result.error || "UNREAD_COUNT_FAILED"
    );
  }

  return Number(result.data?.count || 0);
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  const result = await doJson<{
    read: boolean;
  }>(
    toAppApi(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!result.ok) {
    throw new Error(
      result.error || "MARK_NOTIFICATION_READ_FAILED"
    );
  }
}

export async function markNotificationOpened(
  notificationId: string
): Promise<void> {
  const result = await doJson<{
    opened: boolean;
    deliveriesUpdated: number;
  }>(
    toAppApi(
      `/api/notifications/${encodeURIComponent(notificationId)}/open`
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!result.ok) {
    throw new Error(
      result.error || "MARK_NOTIFICATION_OPENED_FAILED"
    );
  }
}