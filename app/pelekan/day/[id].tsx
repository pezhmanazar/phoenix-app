import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function PelekanDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "white" }}>Day ID: {id}</Text>
    </View>
  );
}