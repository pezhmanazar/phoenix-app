// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="Pelekan" // ⬅️ تب پیش‌فرض: پلکان
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#C7CBD1",
        tabBarStyle: {
          backgroundColor: "#0F1115",
          borderTopWidth: 0,
          height: 74 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
          flexDirection: "row",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: 2,
          textAlign: "center",
          writingDirection: "auto",
        },
      }}
    >
      {/* تب index مخفی */}
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="Pelekan"
        options={{
          title: "پلکان",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panahgah"
        options={{
          title: "پناهگاه",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Mashaal"
        options={{
          title: "مشعل",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Panah"
        options={{
          title: "پناه",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Rooznegar"
        options={{
          title: "روزنگار",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="Phoenix"
        options={{
          title: "ققنوس من",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" color={color} size={size} />
          ),
        }}
      />

      {/* تب مخفی اشتراک – فقط از کد بهش ناوبری می‌کنیم */}
      <Tabs.Screen
        name="Subscription"
        options={{
          href: null, // ⬅️ تو تب‌بار دیده نمی‌شه
        }}
      />
    </Tabs>
  );
}