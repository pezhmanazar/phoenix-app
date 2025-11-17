// components/PlanBadge.tsx
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

type Plan = "free" | "pro" | "vip" | (string & {});
type Props = { plan?: Plan; loading?: boolean; compact?: boolean };

const theme: Record<string, { bg: string; fg: string; label: string }> = {
  free: { bg: "#1f2937", fg: "#9ca3af", label: "free" },
  pro:  { bg: "#064e3b", fg: "#34d399", label: "PRO" },
  vip:  { bg: "#3f2e00", fg: "#fbbf24", label: "VIP" },
};

export default function PlanBadge({ plan = "free", loading, compact }: Props) {
  const t = theme[plan] || theme.free;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: compact ? 24 : 28,
        paddingHorizontal: compact ? 8 : 10,
        borderRadius: compact ? 12 : 14,
        backgroundColor: t.bg,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.fg} />
      ) : (
        <Text style={{ color: t.fg, fontWeight: "800", fontSize: compact ? 11 : 12 }}>
          {t.label}
        </Text>
      )}
    </View>
  );
}