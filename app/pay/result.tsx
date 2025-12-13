// app/pay/result.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/hooks/useUser";
import { toApi } from "@/constants/env";

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
  const okParam = String(params.ok || "").trim();
  const statusParam = String(params.status || "").trim();

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

  useEffect(() => {
    fetchStatus();
  }, [authority]);

  useEffect(() => {
    if (!data || data.ok !== true) return;
    if (data.status !== "pending") return;
    if (pollRef.current >= 20) return;
    pollRef.current += 1;

    const t = setTimeout(() => {
      fetchStatus();
    }, 3000);

    return () => clearTimeout(t);
  }, [data?.ok, (data as any)?.status]);

  useEffect(() => {
    if (!data || data.ok !== true) return;
    if (data.status !== "active") return;
    if (handledSuccessRef.current) return;

    handledSuccessRef.current = true;
    (async () => {
      try {
        await refresh({ force: true });
      } catch {}
    })();
  }, [data, refresh]);

  const status = (() => {
    if (loading) return "loading";
    if (err) return "error";
    if (!data || data.ok !== true) return "unknown";
    return data.status; // pending|active|expired|canceled
  })();

  const ui = useMemo(() => {
    // Brand palette
    const GOLD = "#D4AF37";
    const ORANGE = "#E98A15";
    const GREEN = "#22C55E";
    const RED = "#F87171";

    // defaults
    let title = "در حال بررسی پرداخت…";
    let subtitle = "چند ثانیه صبر کن.";
    let icon: any = "hourglass-outline";
    let bar = "rgba(255,255,255,0.18)";
    let cardBorder = "rgba(255,255,255,0.12)";
    let cardBg = "#0f172a";
    let btnBg = "rgba(255,255,255,0.06)";
    let btnBorder = "rgba(255,255,255,0.12)";
    let btnText = "#E8EEF7";

    if (status === "error") {
      title = "خطا در بررسی پرداخت";
      subtitle = "دوباره تلاش کن. اگر ادامه داشت، از داخل اپ پرداخت را تکرار کن.";
      icon = "warning-outline";
      bar = "rgba(251,191,36,0.95)";
      cardBorder = "rgba(251,191,36,0.25)";
      btnBg = "rgba(251,191,36,0.12)";
      btnBorder = "rgba(251,191,36,0.25)";
    } else if (status === "unknown") {
      title = "وضعیت نامشخص";
      subtitle = "اطلاعات کافی نیست. یکبار دیگر بررسی کن.";
      icon = "help-circle-outline";
      bar = "rgba(167,139,250,0.95)";
      cardBorder = "rgba(167,139,250,0.25)";
      btnBg = "rgba(167,139,250,0.12)";
      btnBorder = "rgba(167,139,250,0.25)";
    } else if (status === "pending") {
      title = "در انتظار تایید";
      subtitle = "اگر همین الان از درگاه برگشتی، چند ثانیه دیگه خودکار دوباره چک می‌کنیم.";
      icon = "time-outline";
      bar = "rgba(251,191,36,0.95)";
      cardBorder = "rgba(251,191,36,0.25)";
      btnBg = "rgba(251,191,36,0.12)";
      btnBorder = "rgba(251,191,36,0.25)";
    } else if (status === "active") {
      // ✅ طلایی + سبز (حس ققنوس)
      title = "پرداخت موفق ✅";
      subtitle = "اشتراک فعال شد. حالا برگرد به ققنوس.";
      icon = "checkmark-circle-outline";
      // gradient حسش رو با دو لایه می‌سازیم (بدون linear-gradient)
      bar = GOLD;
      cardBg = "#0b1220";
      cardBorder = "rgba(212,175,55,0.35)";
      btnBg = "rgba(34,197,94,0.16)";
      btnBorder = "rgba(34,197,94,0.35)";
      btnText = "#E8EEF7";
    } else if (status === "canceled" || initialOk === false) {
      // ✅ قرمز برای ناموفق
      title = "پرداخت ناموفق";
      subtitle = "پرداخت تایید نشد. اگر مبلغی کم شده، معمولاً برگشت می‌خورد.";
      icon = "close-circle-outline";
      bar = RED;
      cardBorder = "rgba(248,113,113,0.35)";
      cardBg = "#120b0f";
      btnBg = "rgba(248,113,113,0.14)";
      btnBorder = "rgba(248,113,113,0.35)";
    } else if (status === "expired") {
      title = "پرداخت منقضی شد";
      subtitle = "این پرداخت منقضی شده. لطفاً دوباره پرداخت کن.";
      icon = "ban-outline";
      bar = ORANGE;
      cardBorder = "rgba(233,138,21,0.35)";
      btnBg = "rgba(233,138,21,0.14)";
      btnBorder = "rgba(233,138,21,0.35)";
    }

    return {
      title,
      subtitle,
      icon,
      bar,
      cardBorder,
      cardBg,
      btnBg,
      btnBorder,
      btnText,
    };
  }, [status, initialOk]);

  const bg = "#0b0f14";
  const text = "#e8eef7";
  const muted = "rgba(231,238,247,0.70)";
  const lineSoft = "rgba(255,255,255,0.08)";

  const isSuccess = status === "active";
  const showRetry = !isSuccess; // موفق → فقط یک دکمه

  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 20, justifyContent: "center" }}>
      <View
        style={{
          backgroundColor: ui.cardBg,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: ui.cardBorder,
          padding: 18,
          overflow: "hidden",
        }}
      >
        {/* subtle glow (brand vibe) */}
        <View
          style={{
            position: "absolute",
            top: -90,
            left: -90,
            width: 220,
            height: 220,
            borderRadius: 220,
            backgroundColor: "rgba(212,175,55,0.10)",
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: -110,
            right: -110,
            width: 260,
            height: 260,
            borderRadius: 260,
            backgroundColor: isSuccess ? "rgba(34,197,94,0.10)" : "rgba(248,113,113,0.08)",
          }}
        />

        {/* Top bar */}
        <View
          style={{
            height: 4,
            borderRadius: 999,
            backgroundColor: ui.bar,
            opacity: 0.95,
            marginBottom: 14,
          }}
        />

        {/* Header */}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: lineSoft,
              backgroundColor: "rgba(255,255,255,0.04)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={ui.icon} size={24} color={text} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 21, fontWeight: "900", textAlign: "right" }}>
              {ui.title}
            </Text>
            <Text style={{ color: muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 4 }}>
              {ui.subtitle}
            </Text>
          </View>
        </View>

        {/* Loading */}
        {loading ? (
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        {/* Buttons */}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
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
                borderColor: lineSoft,
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Text style={{ color: text, fontWeight: "900" }}>بررسی مجدد</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              // ✅ موفق → برو اشتراک
              // ✅ ناموفق → برگرد به ققنوس (منطقی‌ترین: همین تب اشتراک)
              router.replace({
                pathname: "/(tabs)/Subscription",
                params: isSuccess ? { _forceReloadUser: Date.now().toString() } : {},
              } as any);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: ui.btnBorder,
              alignItems: "center",
              backgroundColor: ui.btnBg,
            }}
          >
            <Text style={{ color: ui.btnText, fontWeight: "900" }}>
              {isSuccess ? "رفتن به اشتراک" : "بازگشت به ققنوس"}
            </Text>
          </Pressable>
        </View>

        {/* tiny note only on error-ish */}
        {status === "error" ? (
          <Text style={{ color: "rgba(231,238,247,0.55)", fontSize: 11, marginTop: 12, textAlign: "right" }}>
            اگر این خطا تکرار شد، یکبار اپ را ببند و دوباره باز کن.
          </Text>
        ) : null}
      </View>
    </View>
  );
}