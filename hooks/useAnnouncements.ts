import { useAuth } from "./useAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AnnouncementLevel = "info" | "warning" | "critical";
export type AnnouncementPlacement = "top_banner";

export type Announcement = {
  id: string;
  title: string | null;
  message: string;
  level: AnnouncementLevel;
  placement: AnnouncementPlacement;
  dismissible: boolean;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE?.trim() ||
  "https://qoqnoos.app";

async function fetchActive(phone: string): Promise<Announcement[]> {
  const url = `${API_BASE}/api/announcements/active?phone=${encodeURIComponent(
    phone || ""
  )}&t=${Date.now()}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
  });
  const ct = r.headers.get("content-type") || "";
  const text = await r.text();
  if (!ct.includes("application/json")) {
    throw new Error(`Non-JSON (${r.status}): ${text.slice(0, 160)}...`);
  }
  const j = JSON.parse(text);
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "fetch_failed");
  return (j?.data as Announcement[]) || [];
}

async function markSeen(phone: string, announcementId: string): Promise<void> {
  if (!phone || !announcementId) return;
  try {
    await fetch(`${API_BASE}/api/announcements/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ phone, announcementId }),
    });
  } catch {}
}

export function useAnnouncements() {
  const { phone, isAuthenticated } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // برای اینکه برای هر آیتم چند بار seen نفرستیم
  const sentSeenRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !phone) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchActive(phone);
      setItems(list);
      // فقط برای اجباری‌ها (dismissible=false) یک‌بار seen بزن تا بعداً حذف شوند
      for (const a of list) {
        if (!a.dismissible && !sentSeenRef.current.has(a.id)) {
          sentSeenRef.current.add(a.id);
          markSeen(phone, a.id).catch(() => {});
        }
      }
    } catch (e: any) {
      setError(e?.message || "failed");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, phone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const topBanners = useMemo(
    () => items.filter((x) => x.placement === "top_banner" && x.enabled),
    [items]
  );

  return { items, topBanners, loading, error, refresh, phone };
}