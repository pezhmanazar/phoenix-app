// phoenix-app/components/PlanGate.tsx
import React from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@/hooks/useUser";

type PlanGateProps = {
  children: React.ReactNode;
};

export default function PlanGate({ children }: PlanGateProps) {
  const router = useRouter();
  const { loading, plan, isPro, isExpired, daysLeft } = useUser();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: "#fff" }}>در حال بررسی اشتراک…</Text>
      </View>
    );
  }

  // پلن رایگان → کاملاً لاک
  if (!isPro) {
    return (
      <View
        style={{
          flex: 1,
          padding: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          چت با درمانگر فقط برای اعضای پرو فعاله
        </Text>
        <Text
          style={{
            color: "#ccc",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          همین الان می‌تونی با فعال کردن اشتراک پرو، چت خصوصی با درمانگر رو باز
          کنی.
        </Text>

        <Pressable
          onPress={() => router.push("/(tabs)/Subscription")}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: "#ff8800",
          }}
        >
          <Text
            style={{ color: "#000", fontSize: 16, fontWeight: "bold" }}
          >
            فعال کردن اشتراک پرو
          </Text>
        </Pressable>
      </View>
    );
  }

  // پلن پرو/وی‌آی‌پی ولی منقضی شده → read-only
  if (isExpired) {
    return (
      <View
        style={{
          flex: 1,
          padding: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          اشتراک پروت منقضی شده
        </Text>
        <Text
          style={{
            color: "#ccc",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          برای ادامه چت با درمانگر باید اشتراکت رو تمدید کنی.
        </Text>

        {typeof daysLeft === "number" && daysLeft <= 0 && (
          <Text
            style={{
              color: "#ffcccc",
              fontSize: 13,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            اشتراک فعلیت کاملاً تموم شده.
          </Text>
        )}

        <Pressable
          onPress={() => router.push("/(tabs)/Subscription")}
          style={{
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: "#ff8800",
            marginTop: 8,
          }}
        >
          <Text
            style={{ color: "#000", fontSize: 16, fontWeight: "bold" }}
          >
            تمدید اشتراک
          </Text>
        </Pressable>
      </View>
    );
  }

  // پلن پرو فعال → دسترسی کامل
  return <>{children}</>;
}