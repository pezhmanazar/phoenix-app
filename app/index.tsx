// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";

const ONBOARDING_KEY = "hasOnboarded_v1";

// ✅ فعلاً همیشه آنبوردینگ را نشان بده (بعداً می‌تونیم false کنیم)
const FORCE_ALWAYS_ONBOARDING = true;

export default function Gate() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  // فقط برای اینکه تا وقتی مقدار AsyncStorage رو نخوندیم ریدایرکت نکنیم
  const [onboarded, setOnboarded] = useState<null | boolean>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!mounted) return;
        setOnboarded(v === "1");
      } catch {
        if (!mounted) return;
        // اگر خطا شد، محافظه‌کارانه: آنبوردینگ رو نشان بده
        setOnboarded(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // تا وقتی Auth آماده نشده یا وضعیت onboarding معلوم نیست، تصمیم نگیر
    if (loading) return;
    if (onboarded === null) return;

    // ✅ فعلاً همیشه آنبوردینگ
    if (FORCE_ALWAYS_ONBOARDING) {
      router.replace("/onboarding");
      return;
    }

    // 1) اگر اولین بار است -> onboarding
    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }

    // 2) منطق قبلی خودت
    router.replace(isAuthenticated ? "/(tabs)" : "/(auth)/login");
  }, [loading, isAuthenticated, onboarded, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0b0c10",
      }}
    >
      <ActivityIndicator />
    </View>
  );
}