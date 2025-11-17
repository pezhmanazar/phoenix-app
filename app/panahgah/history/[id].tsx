// app/panahgah/history/[id].tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import {
  getHistory, clearHistory, removeHistoryEntry, HistoryEntry
} from "@/lib/panahgah/storage";
import { byId } from "@/lib/panahgah/registry";
import { formatJalali } from "@/lib/panahgah/jdate";
import { Ionicons } from "@expo/vector-icons";

export default function HistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = byId(id!);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getHistory(id!);
    // جدیدترین بالا
    data.sort((a, b) => b.createdAt - a.createdAt);
    setItems(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const confirmClearAll = () =>
    Alert.alert("حذف همه سوابق", "همهٔ سوابق این سناریو پاک شود؟", [
      { text: "انصراف" },
      {
        text: "بله، حذف کن",
        style: "destructive",
        onPress: async () => {
          await clearHistory(id!);
          setExpandedId(null);
          load();
        },
      },
    ]);

  const removeOne = (entryId: string) =>
    Alert.alert("حذف این مورد", "این سابقه حذف شود؟", [
      { text: "انصراف" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          await removeHistoryEntry(id!, entryId);
          if (expandedId === entryId) setExpandedId(null);
          load();
        },
      },
    ]);

  const renderItem = ({ item, index }: { item: HistoryEntry; index: number }) => {
    const isOpen = expandedId === item.id;
    // چون sort کردیم جدیدترین بالاست → نوبت‌ها را از 1 تا n رو به بالا نشان بده
    const displayIndex = items.length - index;
    const title = `نوبت ${displayIndex}`;
    const payload = (item.payload || "").trim();

    return (
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.9}
          onPress={() => setExpandedId(isOpen ? null : item.id)}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={styles.rowRight}>
            <TouchableOpacity onPress={() => removeOne(item.id)} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
              <Ionicons name="trash" size={18} color="#EF4444" />
            </TouchableOpacity>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text}
              style={{ opacity: 0.7 }}
            />
          </View>
        </TouchableOpacity>

        {isOpen && (
          <View style={{ marginTop: 10, gap: 6 }}>
            <Text style={{ color: colors.text, opacity: 0.6, textAlign: "right" }}>
              {formatJalali(new Date(item.createdAt))}
            </Text>

            <View style={[styles.payloadBox, { borderColor: colors.border }]}>
              {payload.length ? (
                <Text
                  selectable
                  style={{ color: colors.text, lineHeight: 22, textAlign: "right" }}
                >
                  {payload}
                </Text>
              ) : item.data && Object.keys(item.data).length ? (
                <View style={{ gap: 10 }}>
                  {Object.entries(item.data).map(([k, v]) => (
                    <View key={k} style={{ gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "900", textAlign: "right" }}>
                        {k}:
                      </Text>
                      <Text
                        selectable
                        style={{ color: colors.text, lineHeight: 22, textAlign: "right" }}
                      >
                        {(v ?? "").trim() || "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.text, lineHeight: 22, textAlign: "right" }}>—</Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          سوابق ({scenario?.title ?? ""})
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ padding: 24 }}>
            <Text style={{ color: colors.text, opacity: 0.6, textAlign: "center" }}>
              هنوز سابقه‌ای ثبت نشده است.
            </Text>
          </View>
        }
      />

      <View style={{ padding: 16, gap: 10 }}>
        <TouchableOpacity onPress={confirmClearAll} style={styles.btnDanger}>
          <Text style={styles.btnText}>پاک‌کردن همهٔ سوابق</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.btnOutline, { borderColor: colors.border }]}
        >
          <Text style={[styles.btnOutlineText, { color: colors.text }]}>بازگشت</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  row: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "900" },
  payloadBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  btnDanger: {
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "900" },
  btnOutline: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  btnOutlineText: { fontWeight: "900" },
});