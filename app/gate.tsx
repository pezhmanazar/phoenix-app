// app/gate.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../hooks/useAuth";

const ONBOARDING_KEY = "hasOnboarded_v1";
const FORCE_ALWAYS_ONBOARDING = false;

export default function Gate() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

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
        setOnboarded(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (onboarded === null) return;

    if (FORCE_ALWAYS_ONBOARDING) {
      router.replace("/onboarding");
      return;
    }

    if (!onboarded) {
      router.replace("/onboarding");
      return;
    }

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