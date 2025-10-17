// components/Screen.tsx
import React, { useEffect, useState } from "react";
import { AppState, AppStateStatus, Platform, ScrollView, ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * لایه‌ی امن برای صفحات با فاصلهٔ استاندارد از نوارهای سیستم و تب‌بار
 */
export default function Screen({
  children,
  contentContainerStyle,
  backgroundColor = undefined,
}: {
  children: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  backgroundColor?: string;
}) {
  const insets = useSafeAreaInsets();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        // اپ از بک‌گراند برگشته → render دوباره
        setRefreshKey((prev) => prev + 1);
      }
    });
    return () => subscription.remove();
  }, []);

  const TAB_BAR_HEIGHT = 74;
  const safeBottom =
    (insets.bottom || (Platform.OS === "ios" ? 10 : 12)) + TAB_BAR_HEIGHT + 16;

  return (
    <SafeAreaView
      key={refreshKey}
      style={{ flex: 1, backgroundColor: backgroundColor ?? "transparent" }}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: (insets.top || (Platform.OS === "android" ? 8 : 0)) + 8,
          paddingHorizontal: 16,
          paddingBottom: safeBottom,
          rowGap: 12,
          ...(contentContainerStyle || {}),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}