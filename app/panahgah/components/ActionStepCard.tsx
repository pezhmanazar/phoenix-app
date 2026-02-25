// app/panahgah/components/ActionStepCard.tsx
import type { ActionItem } from "@/lib/panahgah/actions/models";
import { pickActions } from "@/lib/panahgah/actions/models";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  gold: "#D4AF37",
  orange: "#E98A15",
};

export type ActionResult = {
  attempt: number;
  selected: ActionItem;
  durationSec: number;
  doneAt: number;
};

export default function ActionStepCard({
  seed,
  title,
  timerSec = 120,
  maxAttempts = 2,
  onComplete,
}: {
  seed: string;
  title: string;
  timerSec?: number;
  maxAttempts?: number;
  onComplete: (r: ActionResult) => void;
}) {
  const [phase, setPhase] = useState<"pick" | "timer" | "done">("pick");
  const [attempt, setAttempt] = useState(1);
  const [selected, setSelected] = useState<ActionItem | null>(null);
  const [seedTick, setSeedTick] = useState(0);

  const [t, setT] = useState(timerSec);
  const [timerArmed, setTimerArmed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const seedBase = useMemo(
    () => `${seed}::a${attempt}::k${seedTick}`,
    [seed, attempt, seedTick]
  );

  const options = useMemo(() => pickActions(seedBase, 6), [seedBase]);

  const resetTimer = () => {
    setT(timerSec);
    setTimerArmed(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = () => {
    if (!selected) return;
    resetTimer();
    setTimerArmed(true);
    setPhase("timer");
  };

  useEffect(() => {
    if (phase !== "timer") return;

    intervalRef.current = setInterval(() => {
      setT((v) => (v > 0 ? v - 1 : 0));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "timer") return;
    if (!timerArmed) return;
    if (t > 0) return;

    resetTimer();
    setPhase("done");
  }, [t, phase, timerArmed]);

  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");

  const progress = 1 - t / timerSec;
  const stroke = 8;
  const size = 170;
  const inner = size - stroke * 2;

  return (
    <>
      <View style={s.card}>
  <Text style={[s.h1, { textAlign: "center" }]}>{title}</Text>

  <Text style={[s.p, { textAlign: "center" }]}>
    اقدام رو تحلیل نکن و فقط اجراش کن.
  </Text>
</View>

      {phase === "pick" && (
        <View style={s.card}>
          <Text style={[s.noteTitle, { textAlign: "center" }]}>
            یک گزینه رو انتخاب کن
          </Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {options.map((a) => {
              const on = selected?.id === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setSelected(a)}
                  style={[
                    s.actionCard,
                    on && {
                      borderColor: "rgba(212,175,55,.40)",
                      backgroundColor: "rgba(212,175,55,.12)",
                    },
                  ]}
                >
                  <Text style={s.actionText}>{a.label}</Text>
                  {on && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={palette.gold}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setSeedTick((v) => v + 1);
              setSelected(null);
            }}
            style={s.changeBtn}
          >
            <Ionicons name="shuffle" size={16} color={palette.text} />
            <Text style={s.changeText}>گزینه‌های دیگه</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={!selected}
            onPress={startTimer}
            style={[
              s.primaryBtn,
              { marginTop: 12, opacity: selected ? 1 : 0.5 },
            ]}
          >
            <Text style={s.primaryText}>
              شروع {Math.round(timerSec / 60)} دقیقه
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "timer" && (
        <View style={[s.card, { alignItems: "center" }]}>
          <Text style={[s.noteTitle, { textAlign: "center" }]}>
            {selected?.label}
          </Text>

          <View
            style={[
              s.timerOuter,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          >
            <View
              style={[
                s.timerProgress,
                {
                  width: inner,
                  height: inner,
                  borderRadius: inner / 2,
                  opacity: 0.15 + progress * 0.85,
                },
              ]}
            />
            <Text style={s.timerText}>
              {mm}:{ss}
            </Text>
          </View>

          <Text style={[s.p, { textAlign: "center" }]}>
            فقط همین یک کار رو با تمرکز انجام بده
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              resetTimer();
              setPhase("done");
            }}
            style={[s.secondaryBtn, { marginTop: 12, width: "100%" }]}
          >
            <Text style={s.secondaryText}>انجام شد</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "done" && (
  <View style={[s.card, { alignItems: "center" }]}>
    <Text style={[s.h1, { fontSize: 15, textAlign: "center" }]}>
      انجامش دادی، آفرین {"\u{1F44F}"}
    </Text>

    <Text style={[s.p, { marginTop: 6, textAlign: "center" }]}>
      {selected?.label}
      {"\n"}
      تلاش {attempt} از {maxAttempts}
    </Text>

    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        if (!selected) return;
        onComplete({
          attempt,
          selected,
          durationSec: timerSec,
          doneAt: Date.now(),
        });
      }}
      style={[
        s.primaryBtn,
        {
          marginTop: 12,
          alignSelf: "center",
          width: "70%",
          paddingVertical: 14,
          borderRadius: 16,
        },
      ]}
    >
      <Text style={[s.primaryText, { fontSize: 14 }]}>ثبت و ادامه</Text>
    </TouchableOpacity>

          {attempt < maxAttempts && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setAttempt((v) => v + 1);
                setSelected(null);
                setSeedTick((v) => v + 1);
                resetTimer();
                setPhase("pick");
              }}
              style={[s.secondaryBtn, { marginTop: 10, width: "100%" }]}
            >
              <Text style={s.secondaryText}>اقدام دیگر</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 6,
  },

  h1: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  p: {
    color: palette.muted,
    marginTop: 8,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 20,
  },

  noteTitle: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 13,
  },

  actionCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.16)",
  },

  actionText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
    marginLeft: 10,
  },

  timerOuter: {
    marginTop: 14,
    borderWidth: 2,
    borderColor: "rgba(212,175,55,.35)",
    backgroundColor: "rgba(212,175,55,.10)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  timerProgress: {
    position: "absolute",
    backgroundColor: palette.gold,
  },

  timerText: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 36,
    letterSpacing: 1,
  },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: palette.gold,
  },

  primaryText: {
    color: palette.bg,
    fontWeight: "900",
    fontSize: 13,
  },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },

  secondaryText: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 13,
  },

  changeBtn: {
    marginTop: 12,
    alignSelf: "center",
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.06)",
  },

  changeText: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 12,
  },
});