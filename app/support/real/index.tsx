// app/support/real/index.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";

const DEFAULT_TITLES = {
  tech: "پشتیبانی فنی ققنوس",
  therapy: "پشتیبانی درمانی ققنوس",
} as const;

export default function RealSupport() {
  const { colors, dark } = useTheme();
  const router = useRouter();

  const goTo = (type: "tech" | "therapy") => {
    // فقط نوع را می‌فرستیم؛ خود صفحه‌ی تیکت تیکت واقعی را می‌سازد
    router.push(`/support/tickets/${type}`);
  };

  const Cell = ({
    type,
    iconName,
    iconColor,
    subtitleText,
  }: {
    type: "tech" | "therapy";
    iconName: any;
    iconColor: string;
    subtitleText: string;
  }) => {
    const title = DEFAULT_TITLES[type];
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.cell,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
        onPress={() => goTo(type)}
      >
        <View style={styles.row}>
          <Ionicons name={iconName} size={22} color={iconColor} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: dark ? "#8E8E93" : "#6b7280" },
              ]}
              numberOfLines={1}
            >
              {/* فعلاً آخرین پیام نداریم، فقط یک خط راهنما */}
              —
            </Text>
          </View>
          {/* جای ساعت خالی می‌گذاریم */}
          <View style={{ width: 40 }} />
        </View>
        <Text
          style={[
            styles.description,
            { color: dark ? "#bdbdbd" : "#6b7280" },
          ]}
        >
          {subtitleText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* هدر */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          پشتیبانی واقعی
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* درمانی */}
        <Cell
          type="therapy"
          iconName="person"
          iconColor="#A855F7"
          subtitleText="در صورت نیاز به ارتباط با یک روان‌درمانگر، سؤال یا پیام خودت را به این چت بفرست."
        />
        {/* فنی */}
        <Cell
          type="tech"
          iconName="bug"
          iconColor="#F59E0B"
          subtitleText="در صورت هر گونه مشکل یا سؤال در استفاده از برنامه، پیام خودت را به این چت بفرست."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "900" },
  cell: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontWeight: "900", fontSize: 15 },
  subtitle: { marginTop: 2, fontSize: 12, textAlign: "right" },
  time: { marginLeft: 6, fontSize: 12 },
  description: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
    lineHeight: 18,
  },
});