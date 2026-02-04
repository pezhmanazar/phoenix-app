import { Stack } from "expo-router";

export default function GosastanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="day1" />
      <Stack.Screen name="stage-intro" />
    </Stack>
  );
}