// components/pelekan/Review.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  me: any;
  state: any;
  onRefresh?: () => void;
};

export default function Review({ state }: Props) {
  const session = state.review?.session;

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>سشن بازسنجی پیدا نشد</Text>
      </View>
    );
  }

  // ✅ تست اول
  if (session.currentTest === 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>آزمون بازسنجی رابطه</Text>
        <Text style={styles.text}>سوال {session.currentIndex + 1}</Text>
      </View>
    );
  }

  // ✅ تست دوم
  if (session.currentTest === 2) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>آزمون «آیا برمی‌گرده؟»</Text>
        <Text style={styles.text}>سوال {session.currentIndex + 1}</Text>
      </View>
    );
  }

  // ✅ بعد از اتمام
  return (
    <View style={styles.center}>
      <Text style={styles.title}>پایان بازسنجی</Text>
      <Text style={styles.text}>در حال آماده‌سازی نتیجه…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0b0f14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  text: {
    color: "rgba(231,238,247,.75)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});