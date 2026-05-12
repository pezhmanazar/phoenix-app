// components/pelekan/Circle1Modal.tsx
import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;

  baselineStatus?: "in_progress" | "completed" | string | null;

  reviewChosenPath?: "review" | "skip_review" | string | null;
  reviewStatus?: "in_progress" | "completed_locked" | "unlocked" | string | null;

  onViewTest1: () => void;
  onStartTest2: () => void;
  onViewAllAvailableResults: () => void;
};

export default function Circle1Modal({
  visible,
  onClose,
  baselineStatus,
  reviewChosenPath,
  reviewStatus,
  onViewTest1,
  onStartTest2,
  onViewAllAvailableResults,
}: Props) {
  const isBaselineCompleted = baselineStatus === "completed";
  const isBaselineStarted = !!baselineStatus && baselineStatus !== "completed";

  const isReviewPath = reviewChosenPath === "review";
  const isSkipReviewPath = reviewChosenPath === "skip_review";
  const hasChosenReviewPath = isReviewPath || isSkipReviewPath;

  const isReviewInProgress = reviewStatus === "in_progress";
  const isReviewDone = reviewStatus === "completed_locked" || reviewStatus === "unlocked";

  const mode = useMemo<
    | "need_baseline"
    | "baseline_in_progress"
    | "t1_and_offer_t2"
    | "review_in_progress"
    | "show_available"
  >(() => {
    if (!baselineStatus) return "need_baseline";
    if (!isBaselineCompleted && isBaselineStarted) return "baseline_in_progress";
    if (!isBaselineCompleted) return "need_baseline";

    if (!hasChosenReviewPath) return "t1_and_offer_t2";

    if (isReviewPath && isReviewInProgress) return "review_in_progress";

    return "show_available";
  }, [
    baselineStatus,
    isBaselineCompleted,
    isBaselineStarted,
    hasChosenReviewPath,
    isReviewPath,
    isReviewInProgress,
  ]);

  const title = "دایره اول — نتایج آزمون‌ها";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          {mode === "need_baseline" ? (
            <>
              <Text style={styles.desc}>
                برای دیدن نتایج، اول باید «آزمون سنجش شدت آسیب» کامل شود.
              </Text>

              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  فعلاً هنوز نتیجه‌ای برای نمایش وجود ندارد.
                </Text>
              </View>
            </>
          ) : mode === "baseline_in_progress" ? (
            <>
              <Text style={styles.desc}>
                آزمون سنجش شدت آسیب شروع شده، اما هنوز کامل نشده. تا قبل از تکمیل آزمون، نتیجه نهایی نمایش داده نمی‌شود.
              </Text>

              <Pressable style={styles.btnPrimary} onPress={onViewTest1}>
                <Text style={styles.btnTextPrimary}>ادامه / دیدن وضعیت آزمون ۱</Text>
              </Pressable>
            </>
          ) : mode === "t1_and_offer_t2" ? (
            <>
              <Text style={styles.desc}>
                نتیجه آزمون ۱ آماده است. اگر بخواهی، می‌توانی «بازسنجی رابطه» را هم انجام بدهی. این بخش فقط یک‌بار قابل انجام است.
              </Text>

              <Pressable style={styles.btnPrimary} onPress={onViewTest1}>
                <Text style={styles.btnTextPrimary}>دیدن نتیجه آزمون ۱</Text>
              </Pressable>

              <Pressable style={styles.btnSecondary} onPress={onStartTest2}>
                <Text style={styles.btnTextSecondary}>شروع بازسنجی رابطه</Text>
              </Pressable>
            </>
          ) : mode === "review_in_progress" ? (
            <>
              <Text style={styles.desc}>
                بازسنجی رابطه شروع شده ولی هنوز کامل نشده. نتیجه آزمون ۱ همچنان قابل مشاهده است، اما برای دیدن جمع‌بندی کامل باید بازسنجی را تمام کنی.
              </Text>

              <Pressable style={styles.btnPrimary} onPress={onViewTest1}>
                <Text style={styles.btnTextPrimary}>دیدن نتیجه آزمون ۱</Text>
              </Pressable>

              <Pressable style={styles.btnSecondary} onPress={onViewAllAvailableResults}>
                <Text style={styles.btnTextSecondary}>ادامه / دیدن نتایج موجود</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.desc}>
                {isSkipReviewPath
                  ? "نتایج موجود آماده است. چون مسیر «فراموش کردن» انتخاب شده، فقط نتایج قابل‌نمایش فعلی در دسترس هستند."
                  : isReviewDone
                  ? "نتایج موجود آماده است. آزمون‌های انجام‌شده دوباره قابل تکرار نیستند."
                  : "نتایج موجود آماده است."}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,.55)",
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 16,
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
    textAlign: "right",
    writingDirection: "rtl",
  },
  desc: {
    color: "rgba(231,238,247,.75)",
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  noteBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.04)",
    borderRadius: 14,
    padding: 10,
    marginTop: 2,
  },
  noteText: {
    color: "rgba(231,238,247,.65)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
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
    writingDirection: "rtl",
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
    writingDirection: "rtl",
  },
  btnGhost: {
    paddingVertical: 10,
    marginTop: 10,
  },
  btnTextGhost: {
    color: "rgba(231,238,247,.65)",
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
  },
});
