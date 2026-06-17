//phoenix-app\app\pelekan\sookhtan\_layout.tsx
import { Stack } from "expo-router";

export default function SookhtanLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="current" />
      <Stack.Screen name="[code]" />
      <Stack.Screen name="stage-intro" />
    </Stack>
  );
}
