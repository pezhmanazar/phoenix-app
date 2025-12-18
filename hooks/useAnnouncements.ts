import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AnnouncementLevel = "info" | "warning" | "critical";

export type Announcement = {
  id: string;
  title: string | null;
  message: string;
  level: AnnouncementLevel;
  placement: "top_banner";
  dismissible: boolean;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
  priority: number;
};

type ApiResponse = {
  ok: boolean;
  data: Announcement[];
};

const API_BASE = "https://qoqnoos.app";

export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/announcements/active`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;
      if (json?.ok) {
        setItems(json.data || []);
      }
    } catch (e) {
      console.warn("fetch announcements failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // فقط بنرهای top_banner و مرتب‌شده
  const topBanners = useMemo(() => {
    return items
      .filter(
        (a) =>
          a.placement === "top_banner" &&
          !dismissedRef.current.has(a.id)
      )
      .sort((a, b) => b.priority - a.priority);
  }, [items]);

  // ✅ ثبت seen در بک‌اند
  const markSeen = useCallback(async (announcementId: string) => {
    try {
      await fetch(`${API_BASE}/api/announcements/seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ announcementId }),
      });
    } catch (e) {
      console.warn("markSeen failed", e);
    }
  }, []);

  // ✅ حذف فقط در UI
  const dismissLocal = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return {
    items,
    topBanners,
    loading,
    refresh: fetchAnnouncements,
    markSeen,
    dismissLocal,
  };
}