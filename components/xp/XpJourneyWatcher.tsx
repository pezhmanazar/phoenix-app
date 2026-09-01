import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../hooks/useAuth";
import {
  getXpJourneyIntroduced,
  setXpJourneyIntroduced,
} from "../../lib/xpJourneyState";

const API_URL = "https://api.qoqnoos.app/api/pelekan/stats";

export default function XpJourneyWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useAuth();

  const [introVisible, setIntroVisible] = useState(false);

  const checkingRef = useRef(false);

  const checkJourneyIntro = useCallback(async () => {
    if (!token || checkingRef.current) {
      return;
    }

    checkingRef.current = true;

    try {
      const introduced = await getXpJourneyIntroduced();

      if (introduced) {
        return;
      }

      const res = await fetch(API_URL, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          Authorization: `Bearer ${token}`,
          "x-session-token": token,
        },
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        return;
      }

      const xp = Math.max(
        0,
        Number(json?.data?.xpTotal ?? 0),
      );

      if (xp <= 0) {
        return;
      }

      /*
       * اولین XP در این چرخه:
       * Journey را فقط یک بار معرفی کن.
       */
      await setXpJourneyIntroduced(true);

      setIntroVisible(true);
    } catch {
      // Watcher نباید UI اصلی اپ را مختل کند.
    } finally {
      checkingRef.current = false;
    }
  }, [token]);

  /*
   * با تغییر route، اگر Journey هنوز معرفی نشده باشد،
   * XP واقعی را از بک‌اند بررسی می‌کنیم.
   *
   * بنابراین بعد از اولین فعالیت بستن که XP می‌دهد،
   * با برگشت/تغییر صفحه modal معرفی ظاهر می‌شود.
   */
  useEffect(() => {
    void checkJourneyIntro();
  }, [pathname, checkJourneyIntro]);

  const closeModal = useCallback(() => {
    setIntroVisible(false);
  }, []);

  const openJourney = useCallback(() => {
    setIntroVisible(false);
    router.push("/xp-journey" as any);
  }, [router]);

  return (
    <Modal
      visible={introVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.glow} />

          <View style={styles.iconWrap}>
            <Ionicons
              name="sparkles"
              size={42}
              color="#F6C453"
            />
          </View>

          <Text style={styles.eyebrow}>
            یک مسیر تازه آغاز شد
          </Text>

          <Text style={styles.title}>
            سفر ققنوس تو آغاز شد
          </Text>

          <Text style={styles.description}>
            اولین قدم رو برداشتی. هر امتیاز نشونه‌ای از کاریه که برای
            دوباره ساختن خودت انجام می‌دی. با ادامه مسیر، ققنوس تو از
            دل خاکستر دوباره جون می‌گیره.
          </Text>

          <Pressable
            onPress={openJourney}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.primaryButtonText}>
              مشاهده سفر من
            </Text>

            <Ionicons
              name="arrow-back"
              size={17}
              color="#111318"
            />
          </Pressable>

          <Pressable
            onPress={closeModal}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              فعلاً نه
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0,0,0,.72)",
  },

  card: {
    width: "100%",
    maxWidth: 390,
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.30)",
    backgroundColor: "#11161D",
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },

  glow: {
    position: "absolute",
    top: -130,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(245,185,66,.09)",
  },

  iconWrap: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 46,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.32)",
    backgroundColor: "rgba(212,175,55,.08)",
    marginBottom: 16,
  },

  eyebrow: {
    color: "#858B95",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },

  title: {
    marginTop: 5,
    color: "#F6C453",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  description: {
    marginTop: 10,
    color: "#C5CAD1",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },

  primaryButton: {
    width: "100%",
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#D4AF37",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  primaryButtonText: {
    color: "#111318",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryButton: {
    marginTop: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  secondaryButtonText: {
    color: "#777D87",
    fontSize: 10,
    fontWeight: "800",
  },
});