//phoenix-app\components\ui\AppBannerModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type AppBannerModalKind = "success" | "error" | "warning" | "info";

type Props = {
  visible: boolean;
  kind?: AppBannerModalKind;
  title: string;
  message?: string | null;
  refId?: string | null;
  closeText?: string;
  onClose: () => void;
};

export default function AppBannerModal({
  visible,
  kind = "info",
  title,
  message,
  refId,
  closeText = "بستن",
  onClose,
}: Props) {
  const iconName =
    kind === "success"
      ? "checkmark-circle"
      : kind === "warning"
      ? "alert-circle"
      : kind === "error"
      ? "close-circle"
      : "information-circle";

  const iconColor =
    kind === "success"
      ? "#22C55E"
      : kind === "warning"
      ? "#FBBF24"
      : kind === "error"
      ? "#F97373"
      : "#60A5FA";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons
              name={iconName as any}
              size={28}
              color={iconColor}
              style={styles.icon}
            />
            <Text style={styles.title}>{title}</Text>
          </View>

          {!!refId && (
            <View style={styles.refWrap}>
              <Text style={styles.refLabel}>کد رهگیری:</Text>
              <Text style={styles.refValue}>{refId}</Text>
            </View>
          )}

          {!!message && <Text style={styles.message}>{message}</Text>}

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.85}>
            <Text style={styles.closeText}>{closeText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  icon: {
    marginLeft: 8,
  },
  title: {
    flex: 1,
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  message: {
    color: "#D1D5DB",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "right",
    marginTop: 10,
  },
  refWrap: {
    marginTop: 8,
  },
  refLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "right",
  },
  refValue: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "left",
  },
  closeBtn: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#374151",
  },
  closeText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "800",
  },
});
