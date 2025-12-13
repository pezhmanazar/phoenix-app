// app/pay/result.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/hooks/useUser";
import { toApi } from "@/constants/env"; // بهتر از هاردکد

type PayStatusResp =
  | { ok: false; error: string }
  | {
      ok: true;
      authority: string;
      status: "pending" | "active" | "expired" | "canceled";
      refId: string | null;
      amount: number;
      plan: string;
      months: number;
      expiresAt: string | null;
      phone: string | null;
      userPlan: string | null;
      userPlanExpiresAt: string | null;
    };

export default function PayResultScreen() {
  const params = useLocalSearchParams();
  const authority = String(params.authority || "").trim();
  const okParam = String(params.ok || "").trim(); // "1" | "0"
  const statusParam = String(params.status || "").trim(); // "success" | "failed"

  const { refresh } = useUser();

  const initialOk = useMemo(() => {
    if (okParam === "1") return true;
    if (okParam === "0") return false;
    if (statusParam.toLowerCase() === "success") return true;
    if (statusParam.toLowerCase() === "failed") return false;
    return null;
  }, [okParam, statusParam]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PayStatusResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handledSuccessRef = useRef(false);
  const pollRef = useRef(0);

  async function fetchStatus() {
    if (!authority) {
      setErr("AUTHORITY_MISSING");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr(null);

      const url = toApi(`/api/pay/status?authority=${encodeURIComponent(authority)}`);
      const r = await fetch(url, { method: "GET" });

      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await r.text();
        console.log("[pay/result] NON_JSON_RESPONSE:", r.status, ct, text.slice(0, 200));
        setErr("NON_JSON_RESPONSE");
        setLoading(false);
        return;
      }

      const j = (await r.json()) as PayStatusResp;
      setData(j);

      if (!r.ok || !j || (j as any).ok !== true) {
        setErr((j as any)?.error || `HTTP_${r.status}`);
      }
    } catch (e: any) {
      setErr(e?.message || "NETWORK_ERROR");
    } finally {
      setLoading(false);
    }
  }

  // اولین بار
  useEffect(() => {
    fetchStatus();
  }, [authority]);

  // اگر pending بود، چندبار سبک پول کن
  useEffect(() => {
    if (!data || data.ok !== true) return;
    if (data.status !== "pending") return;
    if (pollRef.current >= 20) return; // حداکثر ~۱ دقیقه
    pollRef.current += 1;

    const t = setTimeout(() => {
      fetchStatus();
    }, 3000);

    return () => clearTimeout(t);
  }, [data?.ok, (data as any)?.status]);

  // اگر active شد: refresh(force) (ولی دیگه خودکار به Subscription نرو)
  useEffect(() => {
    if (!data || data.ok !== true) return;
    if (data.status !== "active") return;
    if (handledSuccessRef.current) return;

    handledSuccessRef.current = true;

    (async () => {
      try {
        await refresh({ force: true }); // ✅ مهم
      } catch {}
    })();
  }, [data, refresh]);

  // ---------- UI helpers ----------
  const status = (() => {
    if (loading) return "loading";
    if (err) return "error";
    if (!data || data.ok !== true) return "unknown";
    return data.status; // pending|active|expired|canceled
  })();

  const ui = useMemo(() => {
    // defaults
    let title = "در حال بررسی پرداخت…";
    let subtitle = "چند ثانیه صبر کنید.";
    let icon: any = "hourglass-outline";
    let accent = "#60A5FA"; // blue
    let badge = "در حال بررسی";

    if (status === "error") {
      title = "مشکل در بررسی پرداخت";
      subtitle =
        "یک بار «بررسی مجدد» بزن. اگر ادامه داشت، از داخل اپ دوباره پرداخت کن.";
      icon = "warning-outline";
      accent = "#FBBF24"; // amber
      badge = "خطا";
    } else if (status === "unknown") {
      title = "وضعیت نامشخص";
      subtitle = "اطلاعات کافی نیست. «بررسی مجدد» را امتحان کن.";
      icon = "help-circle-outline";
      accent = "#A78BFA"; // purple
      badge = "نامشخص";
    } else if (status === "pending") {
      title = "در انتظار تایید";
      subtitle = "اگر همین الان از درگاه برگشتی، چند ثانیه دیگه دوباره چک می‌کنیم.";
      icon = "time-outline";
      accent = "#FBBF24"; // amber
      badge = "Pending";
    } else if (status === "active") {
      title = "پرداخت موفق ✅";
      subtitle = "اشتراک فعال شد. حالا برو صفحه اشتراک.";
      icon = "checkmark-circle-outline";
      accent = "#22C55E"; // green
      badge = "Success";
    } else if (status === "canceled") {
      title = "پرداخت ناموفق / لغو شده";
      subtitle = "پرداخت تایید نشد. اگر مبلغی کم شده، معمولاً برگشت می‌خورد.";
      icon = "close-circle-outline";
      accent = "#F87171"; // red
      badge = "Failed";
    } else if (status === "expired") {
      title = "پرداخت منقضی شده";
      subtitle = "این پرداخت منقضی شده. لطفاً دوباره پرداخت کن.";
      icon = "ban-outline";
      accent = "#FB7185"; // rose
      badge = "Expired";
    }

    // کمک از initialOk (اگر دیتا دیر بیاد)
    if (initialOk === false && status === "loading") {
      title = "پرداخت ناموفق";
      subtitle = "در حال بررسی جزئیات…";
      icon = "close-circle-outline";
      accent = "#F87171";
      badge = "Failed";
    }

    return { title, subtitle, icon, accent, badge };
  }, [status, initialOk]);

  const bg = "#0b0f14";
  const card = "#0f172a";
  const line = "rgba(255,255,255,0.10)";
  const text = "#e8eef7";
  const muted = "rgba(231,238,247,0.70)";

  const showAuthority = authority || (data && data.ok === true ? data.authority : "");
  const showRefId = data && data.ok === true ? data.refId : null;

  const isSuccess = status === "active";
  const showRetry = !isSuccess; // ✅ موفق → فقط یک دکمه

  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 20, justifyContent: "center" }}>
      <View
        style={{
          backgroundColor: card,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: line,
          padding: 18,
        }}
      >
        {/* Top Bar */}
        <View
          style={{
            height: 4,
            borderRadius: 999,
            backgroundColor: ui.accent,
            opacity: 0.9,
            marginBottom: 14,
          }}
        />

        {/* Header */}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: line,
              backgroundColor: "rgba(255,255,255,0.04)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={ui.icon} size={22} color={ui.accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 20, fontWeight: "900", textAlign: "right" }}>
              {ui.title}
            </Text>
            <Text style={{ color: muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 4 }}>
              {ui.subtitle}
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: line,
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <Text style={{ color: ui.accent, fontSize: 12, fontWeight: "900" }}>
              {ui.badge}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: line, borderRadius: 16, padding: 12 }}>
          <Text style={{ color: muted, fontSize: 12, textAlign: "right" }}>کد پیگیری (Authority)</Text>
          <Text style={{ color: text, fontSize: 13, marginTop: 6, textAlign: "right" }}>
            {showAuthority || "-"}
          </Text>

          {showRefId ? (
            <>
              <Text style={{ color: muted, fontSize: 12, textAlign: "right", marginTop: 10 }}>RefId</Text>
              <Text style={{ color: text, fontSize: 13, marginTop: 6, textAlign: "right" }}>
                {String(showRefId)}
              </Text>
            </>
          ) : null}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {/* Buttons */}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 12 }}>
          {showRetry ? (
            <Pressable
              onPress={() => {
                pollRef.current = 0;
                fetchStatus();
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: line,
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Text style={{ color: text, fontWeight: "900" }}>بررسی مجدد</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              // ✅ موفق: برو اشتراک (و یکبار هم force refresh یوزر)
              router.replace({
                pathname: "/(tabs)/Subscription",
                params: { _forceReloadUser: Date.now().toString() },
              } as any);
            }}
            style={{
              flex: showRetry ? 1 : 1,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isSuccess ? "rgba(34,197,94,0.35)" : "rgba(212,175,55,0.28)",
              alignItems: "center",
              backgroundColor: isSuccess ? "rgba(34,197,94,0.14)" : "rgba(212,175,55,0.12)",
            }}
          >
            <Text style={{ color: text, fontWeight: "900" }}>
              {isSuccess ? "رفتن به اشتراک" : "رفتن به اشتراک"}
            </Text>
          </Pressable>
        </View>

        <Text style={{ color: "rgba(231,238,247,0.55)", fontSize: 11, marginTop: 12, textAlign: "right" }}>
          نکته: اگر از دسکتاپ این صفحه را می‌بینی، دیپ‌لینک اجرا نمی‌شود. تست واقعی روی موبایل انجام بده.
        </Text>
      </View>
    </View>
  );
}