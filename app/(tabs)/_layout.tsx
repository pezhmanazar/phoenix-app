// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ✅ اضافه شد

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets(); // ✅ گرفتن فاصله‌های امن سیستم (مثل دکمه ناوبری)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#C7CBD1",
        tabBarStyle: {
          backgroundColor: "#0F1115",
          borderTopWidth: 0,
          height: 74 + insets.bottom,       // ✅ تب‌بار همیشه بالای ناوبری قرار می‌گیره
          paddingBottom: insets.bottom,     // ✅ فضای واقعی دکمه ناوبری
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
    </Tabs>
  );
}