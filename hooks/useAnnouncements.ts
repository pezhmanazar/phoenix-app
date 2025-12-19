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

const API_BASE =
  (process.env.EXPO_PUBLIC_BACKEND_URL && String(process.env.EXPO_PUBLIC_BACKEND_URL).trim()) ||
  (process.env.EXPO_PUBLIC_APP_API_URL && String(process.env.EXPO_PUBLIC_APP_API_URL).trim()) ||
  "https://qoqnoos.app";

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
    if (!enabled) return;
    if (!isAuthenticated || !phone) return;

    setLoading(true);
    try {
      const qs = `?phone=${encodeURIComponent(String(phone))}`;
      const url = `${API_BASE}/api/announcements/active${qs}`;
      if (__DEV__) console.log("[ann] fetch →", url);

      const res = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const ct = res.headers.get("content-type") || "";
      const text = await res.text();

      if (__DEV__) console.log("[ann] status =", res.status, "ct =", ct);

      if (!ct.includes("application/json")) {
        if (__DEV__) console.warn("[ann] Non-JSON response:", text.slice(0, 160));
        // اینجا “خالی کردن items” بدترین کاره چون UI را بی‌دلیل می‌پرونه
        return;
      }

      const json = JSON.parse(text) as ApiResponse;
      if (!res.ok || !json?.ok) {
        if (__DEV__) console.warn("[ann] ok=false:", json?.error || `HTTP_${res.status}`);
        return;
      }

      setItems(json.data || []);
      if (__DEV__) console.log("[ann] items =", (json.data || []).length);
    } catch (e) {
      console.warn("[ann] fetch failed", e);
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

        if (__DEV__) console.log("[ann] seen →", announcementId, "status=", res.status);
      } catch (e) {
        console.warn("[ann] markSeen failed", e);
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