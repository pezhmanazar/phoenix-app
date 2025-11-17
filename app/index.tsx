// app/index.tsx
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";

export default function Gate() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(isAuthenticated ? "/(tabs)" : "/(auth)/login");
  }, [loading, isAuthenticated]);

  return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#0b0c10" }}>
      <ActivityIndicator />
    </View>
  );
}