import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Screen from "../components/Screen";

export default function AchievementsScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar
        style="light"
        backgroundColor="#0b0f14"
      />

      <View
        pointerEvents="none"
        style={styles.glow}
      />

      <Screen
        backgroundColor="#0b0f14"
        contentContainerStyle={{
          paddingBottom: 24,
        }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color="#F9FAFB"
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              تالار افتخارات
            </Text>

            <Text style={styles.subtitle}>
              دستاوردهای مسیر ققنوس
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },

  glow: {
    position: "absolute",
    top: -220,
    left: -180,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.12)",
  },

  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  headerText: {
    flex: 1,
    alignItems: "center",
  },

  title: {
    color: "#F9FAFB",
    fontSize: 19,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 3,
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 40,
  },
});