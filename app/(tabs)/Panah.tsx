// app/(tabs)/Panah.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "../../hooks/useUser";

const { height } = Dimensions.get("window");

// همان کلید مشترک با بقیه تب‌ها
const PRO_FLAG_KEY = "phoenix_is_pro";

export default function Panah() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me } = useUser();

  // آیا از نگاه این تب، کاربر پرو است؟
  const [isProLocal, setIsProLocal] = useState(false);

  // یک تابع مشترک برای همگام‌سازی وضعیت پرو/فری
  const syncProFlag = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const flagIsPro = flag === "1"; // هر چیزی غیر از "1" یعنی فری
      const serverIsPro = me?.plan === "pro" || me?.plan === "vip";

      const nextIsPro = flagIsPro || serverIsPro;
      setIsProLocal(nextIsPro);

      console.log(
        "PANAH syncProFlag flag =",
        flag,
        "server plan =",
        me?.plan,
        "=> isProLocal =",
        nextIsPro
      );
    } catch {
      setIsProLocal(false);
    }
  }, [me?.plan]);

  // ۱) بار اول که تب mount می‌شود
  useEffect(() => {
    syncProFlag();
  }, [syncProFlag]);

  // ۲) هر بار تب پناه فوکوس می‌گیرد (رفت و برگشت بین تب‌ها)
  useFocusEffect(
    useCallback(() => {
      syncProFlag();
      return () => {};
    }, [syncProFlag])
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top", "left", "right", "bottom"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>پنــــــــاه</Text>

        {/* بج وضعیت اشتراک قبل از ورود به پشتیبان‌ها */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              isProLocal ? styles.badgePro : styles.badgeFree,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isProLocal ? styles.badgeTextPro : styles.badgeTextFree,
              ]}
            >
              {isProLocal ? "PRO" : "FREE"}
            </Text>
          </View>
        </View>
      </View>

      {/* دو دکمه‌ی بزرگ با تقسیم دقیق ارتفاع */}
      <View
        style={[
          styles.fullArea,
          {
            height: height - (insets.top + insets.bottom + 140),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.bigBtn, styles.realSupport]}
          onPress={() => router.push("/support/real")}
        >
          <Ionicons name="list" size={28} color="#7C2D12" />
          <Text style={styles.bigBtnText}>پشتیبان واقعی</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.bigBtn, styles.aiSupport]}
          onPress={() => router.push("../support/ai")}
        >
          <Ionicons name="chatbubbles" size={28} color="#1E3A8A" />
          <Text style={styles.bigBtnText}>پشتیبان هوشمند (AI)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  badgeRow: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgePro: {
    backgroundColor: "#f97316",
  },
  badgeFree: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  badgeTextPro: {
    color: "#000",
  },
  badgeTextFree: {
    color: "#e5e7eb",
  },
  fullArea: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  bigBtn: {
    height: "48%",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  realSupport: {
    backgroundColor: "#FFEAD5",
  },
  aiSupport: {
    backgroundColor: "#DBEAFE",
  },
  bigBtnText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 8,
  },
});