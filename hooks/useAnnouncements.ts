import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../hooks/useUser"; // اگر مسیرت فرق داره، همین یک خط رو اصلاح کن

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

type ApiResponse = { ok: boolean; data: Announcement[] };

// ✅ نکته: ثابت کردن به دامنه، در مهاجرت اذیتت می‌کند
// بهتر: از env یا fallback
const API_BASE =
  (process.env.EXPO_PUBLIC_BACKEND_URL &&
    String(process.env.EXPO_PUBLIC_BACKEND_URL).trim()) ||
  "https://qoqnoos.app";

type Options = {
  /** فقط وقتی true شد (بعد از ورود و لود اولیه)، fetch فعال شود */
  enabled?: boolean;
};

export function useAnnouncements(opts: Options = {}) {
  const enabled = opts.enabled ?? true;

  // ✅ اینجا فرض می‌گیرم useUser داری و phone توش هست
  // اگر ساختارت فرق دارد، فقط همین بخش را با واقعیت پروژه‌ات هماهنگ کن.
  const { phone, isAuthenticated } = (useUser as any)?.() ?? {
    phone: null,
    isAuthenticated: false,
  };

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const dismissedRef = useRef<Set<string>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const qs = phone ? `?phone=${encodeURIComponent(String(phone))}` : "";
      const res = await fetch(`${API_BASE}/api/announcements/active${qs}`, {
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (json?.ok) setItems(json.data || []);
    } catch (e) {
      console.warn("fetch announcements failed", e);
    } finally {
      setLoading(false);
    }
  }, [enabled, phone]);

  // ✅ جلوگیری از نمایش روی splash/gate:
  // فقط وقتی enabled=true و ترجیحاً کاربر لاگین/phone آماده شد fetch کن
  useEffect(() => {
    if (!enabled) return;

    // اگر می‌خوای حتی قبل از لاگین هم بنر ببینی: این if را حذف کن
    // ولی تو گفتی "بعد از ورود و لود صفحات" پس نگه می‌داریم
    if (!isAuthenticated || !phone) return;

    fetchAnnouncements();
  }, [enabled, isAuthenticated, phone, fetchAnnouncements]);

  const topBanners = useMemo(() => {
    return (items || [])
      .filter((a) => a.placement === "top_banner" && !dismissedRef.current.has(a.id))
      .sort((a, b) => b.priority - a.priority);
  }, [items]);

  // ✅ ثبت seen در بک‌اند (با phone)
  const markSeen = useCallback(
    async (announcementId: string) => {
      if (!announcementId) return;
      if (!phone) return; // بدون phone، بک‌اندت phone_required می‌دهد

      try {
        await fetch(`${API_BASE}/api/announcements/seen`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ phone: String(phone), announcementId }),
        });
      } catch (e) {
        console.warn("markSeen failed", e);
      }
    },
    [phone]
  );

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