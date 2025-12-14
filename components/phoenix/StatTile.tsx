import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function StatTile({
  title,
  value,
  icon,
  onPress,
  valueBig = false,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  valueBig?: boolean;
}) {
  const Card = onPress ? TouchableOpacity : View;
  return (
    <Card activeOpacity={0.9} onPress={onPress as any} style={styles.card}>
      {/* عنوان راست + آیکن */}
      <View style={styles.titleRow}>
        <Ionicons name={icon as any} size={18} color="#D4AF37" />
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* عدد سمت چپ */}
      <View style={styles.valueWrap}>
        <Text style={[styles.value, valueBig && styles.valueBig]}>{value}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    overflow: "hidden",
    minHeight: 110,
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 13,
    textAlign: "right",
    flex: 1,
  },
  valueWrap: {
    alignItems: "flex-start", // چپ
  },
  value: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 18,
  },
  valueBig: {
    fontSize: 28,
    letterSpacing: 0.2,
  },
});