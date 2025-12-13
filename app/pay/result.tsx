// app/pay/result.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
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
  // اگر active شد: refresh(force) و برو Subscription
  useEffect(() => {
    if (!data || data.ok !== true) return;
    if (data.status !== "active") return;
    if (handledSuccessRef.current) return;
    handledSuccessRef.current = true;
    (async () => {
      try {
        // نکته کلیدی: force حتماً true
        await refresh({ force: true });
      } catch {}
      router.replace({
        pathname: "/(tabs)/Subscription",
        params: { _fromPay: Date.now().toString() },
      } as any);
    })();
  }, [data, refresh]);
  const title = (() => {
    if (loading) return "در حال بررسی پرداخت…";
    if (err) return "مشکل در بررسی پرداخت";
    if (!data || data.ok !== true) return "نامشخص";
    if (data.status === "active") return "پرداخت موفق";
    if (data.status === "pending") return "در انتظار تایید";
    if (data.status === "canceled") return "پرداخت ناموفق / لغو شده";
    if (data.status === "expired") return "پرداخت منقضی شده";
    return "وضعیت پرداخت";
  })();
  const subtitle = (() => {
    if (loading) return "چند ثانیه صبر کنید.";
    if (err) return "یک بار «بررسی مجدد» بزنید. اگر ادامه داشت، دوباره از داخل اپ پرداخت کنید.";
    if (!data || data.ok !== true) return "اطلاعات کافی نیست.";
    if (data.status === "active") return "اشتراک شما فعال شد. در حال بازگشت به اپ…";
    if (data.status === "pending") return "اگر همین الان از درگاه برگشتید، چند ثانیه بعد دوباره چک می‌کنیم.";
    if (data.status === "canceled") return "پرداخت تایید نشد. اگر مبلغی کم شده، معمولاً برگشت می‌خورد.";
    if (data.status === "expired") return "این پرداخت منقضی شده. لطفاً دوباره پرداخت کنید.";
    return "";
  })();
  const bg = "#0b0f14";
  const card = "#111824";
  const line = "rgba(255,255,255,0.08)";
  const text = "#e8eef7";
  const muted = "#a7b3c6";
  const showAuthority = authority || (data && data.ok === true ? data.authority : "");
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 20, justifyContent: "center" }}>
      <View style={{ backgroundColor: card, borderRadius: 18, borderWidth: 1, borderColor: line, padding: 18 }}>
        <Text style={{ color: text, fontSize: 20, fontWeight: "800", marginBottom: 6, textAlign: "right" }}>
          {title}
        </Text>
        <Text style={{ color: muted, fontSize: 14, lineHeight: 22, textAlign: "right", marginBottom: 14 }}>
          {subtitle}
        </Text>
        <View style={{ borderWidth: 1, borderColor: line, borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <Text style={{ color: muted, fontSize: 12, textAlign: "right" }}>کد پیگیری</Text>
          <Text style={{ color: text, fontSize: 13, marginTop: 6, textAlign: "right" }}>
            {showAuthority || "-"}
          </Text>
          {data && data.ok === true ? (
            <>
              <Text style={{ color: muted, fontSize: 12, textAlign: "right", marginTop: 10 }}>وضعیت</Text>
              <Text style={{ color: text, fontSize: 13, marginTop: 6, textAlign: "right" }}>
                {data.status} {data.refId ? ` | refId: ${data.refId}` : ""}
              </Text>
            </>
          ) : null}
        </View>
        {loading ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator />
          </View>
        ) : null}
        <View style={{ flexDirection: "row-reverse", gap: 10 }}>
          <Pressable
            onPress={() => {
  pollRef.current = 0;
  fetchStatus();
}}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: line,
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
            }}
          >
            <Text style={{ color: text, fontWeight: "800" }}>بررسی مجدد</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/Subscription")}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.28)",
              alignItems: "center",
              backgroundColor: "rgba(212,175,55,0.12)",
            }}
          >
            <Text style={{ color: text, fontWeight: "800" }}>رفتن به اشتراک</Text>
          </Pressable>
        </View>
        <Text style={{ color: "rgba(231,238,247,0.65)", fontSize: 12, marginTop: 12, textAlign: "right" }}>
          اگر از مرورگر دسکتاپ این صفحه را می‌بینید، دیپ‌لینک اجرا نمی‌شود. برای تست واقعی، روی موبایل انجام دهید.
        </Text>
      </View>
    </View>
  );
}