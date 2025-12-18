import React, { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useAnnouncements } from "../hooks/useAnnouncements";

// رنگ مطابق level
function colorFor(level: "info" | "warning" | "critical") {
  switch (level) {
    case "critical":
      return { bg: "#3f1a1a", border: "#b91c1c", text: "#fecaca" };
    case "warning":
      return { bg: "#2b1f0d", border: "#f59e0b", text: "#fde68a" };
    default:
      return { bg: "#0f172a", border: "#38bdf8", text: "#bae6fd" };
  }
}

export default function TopBanner() {
  const { topBanners, phone } = useAnnouncements();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // یک‌به‌یک نمایش بده (اولویت از بک‌اند مرتب شده)
  const current = useMemo(
    () => topBanners.find((a) => !dismissed.has(a.id)),
    [topBanners, dismissed]
  );
  if (!current) return null;

  const colors = colorFor(current.level);

  const onClose = () => {
    // برای دلخواه: dismissible=true را با بستن، فقط محلی می‌بندیم
    setDismissed((s) => new Set(s).add(current.id));
  };

  return (
    <View
      // چسبیده بالا، زیر StatusBar/هدر
      style={{
        width: "100%",
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderColor: colors.border,
        // شیشه‌ای مطابق تم
        ...(Platform.OS === "android"
          ? {}
          : { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8 }),
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          {current.title ? (
            <Text
              style={{
                fontFamily: "Anjoman-Bold",
                fontSize: 13,
                color: colors.text,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {current.title}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: "Anjoman-Regular",
              fontSize: 12,
              color: colors.text,
              opacity: 0.92,
            }}
            numberOfLines={3}
          >
            {current.message}
          </Text>
        </View>

        {current.dismissible ? (
          <Pressable
            onPress={onClose}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              marginStart: 8,
            }}
            android_ripple={{ color: "#333" }}
          >
            <Text
              style={{
                fontFamily: "Anjoman-Bold",
                fontSize: 12,
                color: colors.text,
              }}
            >
              ×
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}