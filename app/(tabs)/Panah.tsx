// app/(tabs)/Panah.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]} // ⬅️ bottom اضافه شد
    >
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>پناه</Text>
      </View>

      <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
        {/* ✅ پشتیبانی هوش مصنوعی → مسیر واقعی */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.item, styles.row, { borderColor: colors.border }]}
          onPress={() => router.push("../support/ai")}
        >
          <Ionicons name="chatbubbles" size={20} color="#F59E0B" />
          <Text style={[styles.itemText, { color: colors.text }]}>
            پشتیبان هوشمند (Ai)
          </Text>
        </TouchableOpacity>

        {/* پشتیبانی واقعی → صفحهٔ لیست دو چت */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.item, styles.row, { borderColor: colors.border }]}
          onPress={() => router.push("/support/real")}
        >
          <Ionicons name="list" size={20} color="#F59E0B" />
          <Text style={[styles.itemText, { color: colors.text }]}>
            پشتیبانی واقعی
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  container: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  item: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  itemText: { fontSize: 15, fontWeight: "900", flex: 1, textAlign: "right" },
});