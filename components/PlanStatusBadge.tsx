// components/PlanStatusBadge.tsx
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { getPlanStatus } from "../lib/plan";

type PlanView = "free" | "pro" | "expiring" | "expired";

type Props = {
  me: any;
  // برای تب‌های اصلی: بالا-چپ. (پیشنهادی)
  absoluteTopLeft?: boolean;
  top?: number;
  left?: number;

  // اگر expiring بود، متن کناری نمایش بده؟
  showExpiringText?: boolean;

  // سفارشی‌سازی متن کناری (اختیاری)
  expiringText?: (daysLeft: number) => string;

  // اگر بخوای margin داخل Header دستی بدی
  style?: any;
};

const toFaNum = (n: number) =>
  String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export default function PlanStatusBadge({
  me,
  absoluteTopLeft = false,
  top = 10,
  left = 12,
  showExpiringText = true,
  expiringText,
  style,
}: Props) {
  const status = getPlanStatus(me);

  const { planView, daysRemaining, badgeLabel } = useMemo(() => {
    let view: PlanView = "free";
    let days: number | null = null;

    // اگر قبلاً پرو بوده و الان گذشته => expired
    if (
      status?.isExpired &&
      (status?.rawPlan === "pro" || status?.rawPlan === "vip")
    ) {
      view = "expired";
      days = 0;
    } else if (status?.isPro) {
      const d = typeof status?.daysLeft === "number" ? status.daysLeft : null;
      if (d != null && d > 0 && d <= 7) {
        view = "expiring";
        days = d;
      } else {
        view = "pro";
        days = d;
      }
    } else {
      view = "free";
      days = null;
    }

    const label =
      view === "expired" ? "EXPIRED" : view === "pro" || view === "expiring" ? "PRO" : "FREE";

    return { planView: view, daysRemaining: days, badgeLabel: label };
  }, [status]);

  // دقیقاً مثل Subscription
  const badgeBg =
    planView === "expired"
      ? "#7f1d1d55"
      : planView === "expiring"
      ? "#fbbf2455"
      : planView === "pro"
      ? "#16a34a33"
      : "#4B556333";

  const badgeTextColor =
    planView === "expired"
      ? "#F87171"
      : planView === "expiring"
      ? "#FBBF24"
      : planView === "pro"
      ? "#4ADE80"
      : "#E5E7EB";

  const showText =
    showExpiringText && planView === "expiring" && typeof daysRemaining === "number" && daysRemaining > 0;

  const expText =
    typeof daysRemaining === "number"
      ? expiringText?.(daysRemaining) ?? `تا انقضا ${toFaNum(daysRemaining)} روز`
      : "";

  return (
    <View
      style={[
        absoluteTopLeft
          ? { position: "absolute", top, left, zIndex: 50, flexDirection: "row", alignItems: "center" }
          : { flexDirection: "row", alignItems: "center" },
        style,
      ]}
      pointerEvents="none"
    >
      {/* خود بج همیشه چپ باقی می‌مونه */}
      <View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: badgeBg,
        }}
      >
        <Text style={{ color: badgeTextColor, fontSize: 13, fontWeight: "900" }}>
          {badgeLabel}
        </Text>
      </View>

      {/* متن کنار بج، فقط وقتی expiring */}
      {showText && (
        <Text
          style={{
            marginLeft: 8,
            color: "#FBBF24",
            fontSize: 12,
            fontWeight: "800",
          }}
          numberOfLines={1}
        >
          {expText}
        </Text>
      )}
    </View>
  );
}