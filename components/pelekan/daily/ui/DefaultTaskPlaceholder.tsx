import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ResolvedTask } from "../types";

type Props = {
  resolvedTask: ResolvedTask;
};

export default function DefaultTaskPlaceholder({ resolvedTask }: Props) {
  const { config, backendTask } = resolvedTask;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{config.titleFa}</Text>
      <Text style={styles.subtitle}>این تسک شناسایی شد ولی template اون هنوز پیاده‌سازی نشده است.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>taskCode</Text>
        <Text style={styles.value}>{config.code}</Text>

        <Text style={styles.label}>template</Text>
        <Text style={styles.value}>{config.template}</Text>

        <Text style={styles.label}>required</Text>
        <Text style={styles.value}>{config.required ? "بله" : "خیر"}</Text>

        <Text style={styles.label}>backend task id</Text>
        <Text style={styles.value}>{backendTask?.id || "یافت نشد"}</Text>

        <Text style={styles.label}>isDone</Text>
        <Text style={styles.value}>{backendTask?.isDone ? "true" : "false"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "right",
    marginBottom: 16,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: "#888",
    textAlign: "right",
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: "#111",
    textAlign: "right",
  },
});
