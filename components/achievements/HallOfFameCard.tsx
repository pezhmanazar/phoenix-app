import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  onPress: () => void;
};

export default function HallOfFameCard({
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="trophy"
              size={20}
              color="#D4AF37"
            />
          </View>

          <View style={styles.textWrap}>
            <Text style={styles.title}>
              تالار افتخارات
            </Text>

            <Text style={styles.subtitle}>
              مدال‌ها، نشان‌ها و تندیس‌های ققنوس
            </Text>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={19}
          color="#E5E7EB"
          style={{
            opacity: 0.7,
            transform: [{ scaleX: -1 }],
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.22)",
    backgroundColor: "rgba(212,175,55,.07)",
    overflow: "hidden",
  },

  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  titleRow: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.28)",
    backgroundColor: "rgba(212,175,55,.10)",
  },

  textWrap: {
    flex: 1,
    alignItems: "flex-end",
  },

  title: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "right",
  },

  subtitle: {
    marginTop: 4,
    color: "#9CA3AF",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "right",
  },
});