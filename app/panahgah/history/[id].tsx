// app/panahgah/history/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { formatJalali } from "@/lib/panahgah/jdate";
import { byId } from "@/lib/panahgah/registry";
import { clearHistory, getHistory, HistoryEntry, removeHistoryEntry } from "@/lib/panahgah/storage";

/* ----------------------------- UI ----------------------------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  sub2: "rgba(231,238,247,.70)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  red: "#FCA5A5",
  green: "#22C55E",
};

/* ----------------------------- Themed Modal ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

function ThemedModal({
  visible,
  kind,
  title,
  message,
  primaryText,
  onPrimary,
  secondaryText,
  onSecondary,
  loading,
}: {
  visible: boolean;
  kind: ModalKind;
  title: string;
  message?: string;
  primaryText: string;
  onPrimary: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  loading?: boolean;
}) {
  if (!visible) return null;

  const icon =
    kind === "success"
      ? "checkmark-circle"
      : kind === "warn"
      ? "warning"
      : kind === "info"
      ? "information-circle"
      : "alert-circle";

  const iconColor =
    kind === "success"
      ? palette.green
      : kind === "warn"
      ? palette.orange
      : kind === "info"
      ? "rgba(231,238,247,.85)"
      : palette.red;

  return (
    <View style={styles.modalOverlay} pointerEvents="auto">
      <View style={styles.modalCard}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <Ionicons name={icon as any} size={22} color={iconColor} />
          <Text style={styles.modalTitle}>{title}</Text>
        </View>

        {!!message ? <Text style={styles.modalMsg}>{message}</Text> : null}

        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPrimary}
            style={[styles.modalPrimaryBtn, loading && { opacity: 0.6 }]}
            disabled={!!loading}
          >
            {loading ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={styles.modalPrimaryText}>در حال انجام…</Text>
              </View>
            ) : (
              <Text style={styles.modalPrimaryText}>{primaryText}</Text>
            )}
          </TouchableOpacity>

          {secondaryText && onSecondary ? (
            <TouchableOpacity activeOpacity={0.9} onPress={onSecondary} style={styles.modalSecondaryBtn}>
              <Text style={styles.modalSecondaryText}>{secondaryText}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ----------------------------- Screen ----------------------------- */
export default function HistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = byId(id!);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{
    visible: boolean;
    kind: ModalKind;
    title: string;
    message?: string;
    primaryText: string;
    secondaryText?: string;
    onPrimary?: () => void;
    onSecondary?: () => void;
    loading?: boolean;
  }>({
    visible: false,
    kind: "info",
    title: "",
    message: "",
    primaryText: "باشه",
  });

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false, loading: false }));
  }, []);

  const openModal = useCallback((cfg: Omit<typeof modal, "visible"> & { visible?: boolean }) => {
    setModal({ ...cfg, visible: true } as any);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHistory(id!);
      data.sort((a, b) => b.createdAt - a.createdAt); // جدیدترین بالا
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmClearAll = useCallback(() => {
    openModal({
      kind: "warn",
      title: "حذف همه سوابق",
      message: "همهٔ سوابق این موقعیت پاک شود؟ این کار برگشت ندارد.",
      primaryText: "بله، پاک کن",
      secondaryText: "انصراف",
      onSecondary: closeModal,
      onPrimary: async () => {
        openModal({
          kind: "info",
          title: "در حال پاک کردن…",
          message: "لطفاً صبر کن.",
          primaryText: "باشه",
          onPrimary: () => {},
          loading: true,
        });

        await clearHistory(id!);
        setExpandedId(null);
        await load();
        closeModal();
      },
    });
  }, [closeModal, id, load, openModal]);

  const removeOne = useCallback(
    (entryId: string) => {
      openModal({
        kind: "warn",
        title: "حذف این مورد",
        message: "این سابقه حذف شود؟ این کار برگشت ندارد.",
        primaryText: "حذف",
        secondaryText: "انصراف",
        onSecondary: closeModal,
        onPrimary: async () => {
          openModal({
            kind: "info",
            title: "در حال حذف…",
            message: "لطفاً صبر کن.",
            primaryText: "باشه",
            onPrimary: () => {},
            loading: true,
          });

          await removeHistoryEntry(id!, entryId);
          if (expandedId === entryId) setExpandedId(null);
          await load();
          closeModal();
        },
      });
    },
    [closeModal, expandedId, id, load, openModal]
  );

  const titleText = useMemo(() => scenario?.title ?? "سوابق", [scenario?.title]);

  const renderItem = ({ item, index }: { item: HistoryEntry; index: number }) => {
    const isOpen = expandedId === item.id;
    // چون sort کردیم جدیدترین بالاست → نوبت‌ها را از 1 تا n رو به بالا نشان بده
    const displayIndex = items.length - index;
    const title = `نوبت ${displayIndex}`;
    const payload = (item.payload || "").trim();

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.9}
          onPress={() => setExpandedId(isOpen ? null : item.id)}
        >
          <Text style={styles.title}>{title}</Text>

          <View style={styles.rowRight}>
            <TouchableOpacity onPress={() => removeOne(item.id)} style={styles.trashBtn} activeOpacity={0.85}>
              <Ionicons name="trash" size={18} color={palette.red} />
            </TouchableOpacity>

            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={palette.text}
              style={{ opacity: 0.7 }}
            />
          </View>
        </TouchableOpacity>

        {isOpen ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Text style={styles.dateText}>{formatJalali(new Date(item.createdAt))}</Text>

            <View style={styles.payloadBox}>
              {payload.length ? (
                <Text selectable style={styles.payloadText}>
                  {payload}
                </Text>
              ) : item.data && Object.keys(item.data).length ? (
                <View style={{ gap: 10 }}>
                  {Object.entries(item.data).map(([k, v]) => (
                    <View key={k} style={{ gap: 4 }}>
                      <Text style={styles.kvKey}>{k}:</Text>
                      <Text selectable style={styles.payloadText}>
                        {(v ?? "").trim() || "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.payloadText}>—</Text>
              )}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>سوابق</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {titleText}
          </Text>
        </View>

        <TouchableOpacity
          onPress={confirmClearAll}
          style={[styles.iconBtn, items.length === 0 && { opacity: 0.35 }]}
          activeOpacity={0.8}
          disabled={items.length === 0}
        >
          <Ionicons name="trash-outline" size={18} color={palette.text} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={palette.gold} />
          <Text style={{ color: palette.muted, marginTop: 10, fontWeight: "800", fontSize: 12 }}>در حال بارگذاری…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>هنوز سابقه‌ای ثبت نشده است.</Text>
            </View>
          }
        />
      )}

      {/* Themed Modal */}
      <ThemedModal
        visible={modal.visible}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        primaryText={modal.primaryText}
        secondaryText={modal.secondaryText}
        loading={modal.loading}
        onPrimary={() => {
          const fn = modal.onPrimary;
          if (fn) fn();
          else closeModal();
        }}
        onSecondary={() => {
          const fn = modal.onSecondary;
          if (fn) fn();
          else closeModal();
        }}
      />
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  glowTop: {
    position: "absolute",
    top: 0,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
    transform: [{ rotate: "12deg" }],
  },
  glowBottom: {
    position: "absolute",
    bottom: -30,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
    transform: [{ rotate: "-10deg" }],
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.glass2,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  headerTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },
  headerSub: { color: "rgba(231,238,247,.85)", marginTop: 4, fontSize: 12, textAlign: "center" },

  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
  },
  row: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  trashBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(252,165,165,.06)",
    borderWidth: 1,
    borderColor: "rgba(252,165,165,.18)",
  },

  title: { fontSize: 15, fontWeight: "900", color: palette.text },

  dateText: { color: palette.sub2, opacity: 0.8, textAlign: "right", fontSize: 11, fontWeight: "800" },

  payloadBox: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(0,0,0,.18)",
  },
  payloadText: { color: palette.text, lineHeight: 22, textAlign: "right", fontWeight: "700", fontSize: 12 },
  kvKey: { color: palette.text, fontWeight: "900", textAlign: "right" },

  emptyBox: { padding: 24 },
  emptyText: { color: palette.muted, textAlign: "center", fontWeight: "800", fontSize: 12 },

  /* Modal */
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(3,7,18,.96)",
    padding: 16,
  },
  modalTitle: { color: palette.text, fontWeight: "900", fontSize: 14, textAlign: "right", flex: 1 },
  modalMsg: { color: "rgba(231,238,247,.82)", marginTop: 10, fontSize: 12, lineHeight: 18, textAlign: "right" },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  modalPrimaryText: { color: palette.bg, fontWeight: "900" },
  modalSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  modalSecondaryText: { color: palette.text, fontWeight: "900" },
});