// components/pelekan/Circle1Modal.tsx
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;

  // فقط همین دیتاها رو از state می‌گیریم (فعلاً ساده)
  baselineStatus?: "in_progress" | "completed" | string | null;
  reviewChosenPath?: "review" | "skip_review" | string | null;

  // برای دکمه‌ها
  onViewTest1: () => void;
  onStartTest2: () => void;
  onViewAllAvailableResults: () => void;
};

export default function Circle1Modal({
  visible,
  onClose,
  baselineStatus,
  reviewChosenPath,
  onViewTest1,
  onStartTest2,
  onViewAllAvailableResults,
}: Props) {
  const isBaselineCompleted = baselineStatus === "completed";
  const hasChosenReviewPath = reviewChosenPath === "review" || reviewChosenPath === "skip_review";

  // قوانین UX فعلی (مینیمال):
  // - اگر baseline هنوز کامل نشده: فقط پیام
  // - اگر baseline کامل شده و هنوز review انتخاب/شروع نشده: نتیجه ۱ + شروع آزمون ۲
  // - اگر review انتخاب شده: فعلاً فقط "دیدن نتایج موجود" (بعداً ریز می‌کنیم به تست۲/۳)
  const mode = useMemo(() => {
    if (!isBaselineCompleted) return "need_baseline";
    if (isBaselineCompleted && !hasChosenReviewPath) return "t1_and_offer_t2";
    return "show_available";
  }, [isBaselineCompleted, hasChosenReviewPath]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>دایره اول — نتایج آزمون‌ها</Text>

        {mode === "need_baseline" ? (
          <Text style={styles.desc}>
            برای دیدن نتایج، اول باید «آزمون سنجش شدت آسیب» (آزمون ۱) کامل شود.
          </Text>
        ) : mode === "t1_and_offer_t2" ? (
          <>
            <Text style={styles.desc}>
              می‌تونی نتیجه آزمون ۱ رو ببینی. اگر خواستی، «بازسنجی رابطه» (آزمون ۲) هم فقط یک‌بار قابل انجامه.
            </Text>

            <Pressable style={styles.btnPrimary} onPress={onViewTest1}>
              <Text style={styles.btnTextPrimary}>دیدن نتیجه آزمون ۱</Text>
            </Pressable>

            <Pressable style={styles.btnSecondary} onPress={onStartTest2}>
              <Text style={styles.btnTextSecondary}>شروع بازسنجی رابطه (آزمون ۲)</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.desc}>
              نتایج موجود آماده است. هیچ آزمونی دوباره قابل انجام نیست.
            </Text>

            <Pressable style={styles.btnPrimary} onPress={onViewAllAvailableResults}>
              <Text style={styles.btnTextPrimary}>دیدن نتایج</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.btnGhost} onPress={onClose}>
          <Text style={styles.btnTextGhost}>بستن</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.55)",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(3,7,18,.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  title: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 8,
  },
  desc: {
    color: "rgba(231,238,247,.75)",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  btnPrimary: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(212,175,55,.16)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
    marginTop: 6,
  },
  btnTextPrimary: {
    color: "#D4AF37",
    fontWeight: "900",
    textAlign: "center",
  },
  btnSecondary: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    marginTop: 8,
  },
  btnTextSecondary: {
    color: "#F9FAFB",
    fontWeight: "800",
    textAlign: "center",
  },
  btnGhost: {
    paddingVertical: 10,
    marginTop: 10,
  },
  btnTextGhost: {
    color: "rgba(231,238,247,.65)",
    fontWeight: "800",
    textAlign: "center",
  },
});