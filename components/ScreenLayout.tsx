import { palette } from "@/constants/theme/palette";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  title: string;
  children: React.ReactNode;
}

export const ScreenLayout = ({ title, children }: Props) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Background Decor */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <View pointerEvents="none" style={styles.softGrid} />

      {/* Standard Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-forward" size={19} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.headerTextBox}>
          <Text style={styles.stageTitle}>{title}</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  glowTop: {
    position: "absolute",
    top: -80,
    left: -90,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -90,
    right: -100,
    width: 330,
    height: 330,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.105)",
  },
  softGrid: {
    position: "absolute",
    top: 120,
    right: -40,
    width: 160,
    height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.018)",
    transform: [{ rotate: "-18deg" }],
  },
  headerRow: {
    marginTop: 4,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: palette.cardSoft,
    borderColor: palette.border,
    marginLeft: "auto",
  },
  headerTextBox: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: -1,
  },
  stageTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
    letterSpacing: -0.3,
  },
});
