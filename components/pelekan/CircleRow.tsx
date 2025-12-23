// components/pelekan/CircleRow.tsx
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Circle1Modal from "./Circle1Modal";

type Props = {
  // از PelekanState فقط همینا کافی‌ست
  tabState: string;
  baselineStatus?: string | null;
  reviewChosenPath?: string | null;

  // برای ناوبری/اکشن‌ها (فعلاً ساده)
  onGoResults: () => void;
  onGoBaseline: () => void;
  onGoReview: () => void;
};

export default function CircleRow({
  tabState,
  baselineStatus,
  reviewChosenPath,
  onGoResults,
  onGoBaseline,
  onGoReview,
}: Props) {
  const [open, setOpen] = useState(false);

  const circle1Done = useMemo(() => {
    // فعلاً «تیک دایره اول» را حدسی نمی‌زنیم، فقط برای نمایش ساده:
    // baseline completed => دایره ۱ حداقل آماده است.
    // (بعداً از بک‌اند فیلد قطعی می‌گیریم)
    return baselineStatus === "completed";
  }, [baselineStatus]);

  const subtitle = useMemo(() => {
    if (baselineStatus !== "completed") return "اول آزمون ۱";
    if (reviewChosenPath === "review") return "نتایج + بازسنجی";
    if (reviewChosenPath === "skip_review") return "نتایج آماده";
    return "نتیجه آزمون ۱";
  }, [baselineStatus, reviewChosenPath]);

  // کلیک دایره ۱: مودال هوشمند
  const onPressCircle1 = () => setOpen(true);

  return (
    <>
      <View style={styles.wrap}>
        <Pressable style={styles.circle} onPress={onPressCircle1}>
          <Text style={styles.circleTitle}>۱</Text>
          <Text style={styles.circleSub}>{subtitle}</Text>
          <Text style={styles.circleTick}>{circle1Done ? "✓" : ""}</Text>
        </Pressable>

        {/* فعلاً فقط یک دایره می‌گذاریم تا تست کنیم.
            بعداً دایره‌های ۲..۷ رو اضافه می‌کنیم */}
      </View>

      <Circle1Modal
        visible={open}
        onClose={() => setOpen(false)}
        baselineStatus={baselineStatus as any}
        reviewChosenPath={reviewChosenPath as any}
        onViewTest1={() => {
          setOpen(false);
          onGoResults();
        }}
        onStartTest2={() => {
          setOpen(false);
          onGoReview();
        }}
        onViewAllAvailableResults={() => {
          setOpen(false);
          onGoResults();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  circle: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(3,7,18,.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },
  circleTitle: {
    color: "#F9FAFB",
    fontWeight: "900",
    fontSize: 14,
  },
  circleSub: {
    color: "rgba(231,238,247,.70)",
    fontSize: 12,
    marginTop: 4,
  },
  circleTick: {
    position: "absolute",
    right: 12,
    top: 10,
    color: "#D4AF37",
    fontWeight: "900",
    fontSize: 16,
  },
});