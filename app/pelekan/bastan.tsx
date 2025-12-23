// app/pelekan/bastan.tsx
import API_BASE_URL from "@/constants/backend";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

type BastanStateResponse = {
  ok: boolean;
  error?: string;
  data: {
    actions: Array<{
      code: string;
      titleFa: string;
      status: "active" | "locked" | "completed";
      locked: boolean;
      lockReason: string | null;
      progress: { done: number; required: number; total: number };
      subtasks: Array<{
        key: string;
        titleFa: string;
        isRequired: boolean;
        isFree: boolean;
        kind: string;
      }>;
    }>;
  };
};

export default function BastanTestScreen() {
  const [data, setData] = useState<BastanStateResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const phone = "09141480986"; // فعلاً هاردکد برای تست

  async function load() {
    setLoading(true);
    const res = await fetch(
      `${API_BASE_URL}/api/pelekan/bastan/state?phone=${phone}`
    );
    const json: BastanStateResponse = await res.json();
    if (json.ok) setData(json.data);
    setLoading(false);
  }

  async function completeSubtask(subtaskKey: string) {
    await fetch(`${API_BASE_URL}/api/pelekan/bastan/subtask/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, subtaskKey }),
    });
    load(); // ریفرش بعد از انجام
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!data) {
    return <Text>خطا در دریافت داده</Text>;
  }

  return (
    <ScrollView style={{ padding: 16 }}>
      {data.actions.map((action) => (
        <View
          key={action.code}
          style={{
            marginBottom: 20,
            padding: 12,
            borderWidth: 1,
            borderColor: "#333",
          }}
        >
          <Text style={{ fontWeight: "bold", fontSize: 16 }}>
            {action.titleFa}
          </Text>

          <Text style={{ color: "#888", marginBottom: 6 }}>
            {action.progress.done}/{action.progress.required} انجام شده
          </Text>

          {action.locked && (
            <Text style={{ color: "red" }}>🔒 قفل: {action.lockReason}</Text>
          )}

          {action.subtasks.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => completeSubtask(s.key)}
              disabled={action.locked}
              style={{
                padding: 8,
                marginTop: 6,
                backgroundColor: "#111",
                borderWidth: 1,
                borderColor: "#555",
                opacity: action.locked ? 0.4 : 1,
              }}
            >
              <Text>{s.titleFa}</Text>
              <Text style={{ fontSize: 12, color: "#aaa" }}>
                {s.kind} {s.isRequired ? "⭐️ اجباری" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}