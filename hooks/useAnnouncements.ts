import { APP_API_URL } from "@/constants/env";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";

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

type ApiResponse = { ok: boolean; data: Announcement[]; error?: string };

const API_BASE = APP_API_URL;

type Options = {
  enabled?: boolean;
};

export function useAnnouncements(opts: Options = {}) {
  const enabled = opts.enabled ?? true;
  const { phone, isAuthenticated } = useAuth();

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  // فقط برای “dismiss” لوکال (اختیاری‌ها)
  const dismissedRef = useRef<Set<string>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!isAuthenticated || !phone) {
      return;
    }

    setLoading(true);

    try {
      const qs = `?phone=${encodeURIComponent(String(phone))}`;
      const url = `${API_BASE}/api/announcements/active${qs}`;

      const res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const ct = res.headers.get("content-type") || "";
      const text = await res.text();

      if (!ct.includes("application/json")) {
        return;
      }

      const json = JSON.parse(text) as ApiResponse;

      if (!res.ok || !json?.ok) {
        return;
      }

      setItems(json.data || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [enabled, isAuthenticated, phone]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const topBanners = useMemo(() => {
    return (items || [])
      .filter((a) => a.placement === "top_banner" && !dismissedRef.current.has(a.id))
      .sort((a, b) => {
        const p = (b.priority ?? 0) - (a.priority ?? 0);
        if (p !== 0) return p;
        // tie-break پایدار (قدیمی‌تر اول نمایش داده شود یا برعکس؟ اینجا جدیدتر اول)
        return String(b.startAt ?? "").localeCompare(String(a.startAt ?? ""));
      });
  }, [items]);

  const markSeen = useCallback(
    async (announcementId: string) => {
      if (!announcementId) return;
      if (!phone) return;

      try {
        const url = `${API_BASE}/api/announcements/seen`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ phone: String(phone), announcementId }),
        });
            } catch {
        // silent fail
      }
    },
    [phone]
  );

  // ✅ dismiss فقط لوکال؛ برای اجباری‌ها ما از markSeen استفاده می‌کنیم
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