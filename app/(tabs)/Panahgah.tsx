import { StyleSheet, Text, View } from "react-native";

export default function PanahgahScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>پناهگاه</Text>
      <Text style={styles.subtitle}>اینجا بعداً تکنیک‌های فوری (مثل «الان دلتنگش شدم») میاد.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 8, fontSize: 14 },
});
