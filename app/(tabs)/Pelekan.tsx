import { StyleSheet, Text, View } from "react-native";

export default function PelakanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>پلکان رَستن</Text>
      <Text style={styles.subtitle}>اینجا بعداً روزها و پله‌ها (صفر، سوختن، زیستن، رَستن) میاد.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { marginTop: 8, fontSize: 14 }
});
