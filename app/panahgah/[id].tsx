// app/panahgah/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatusSuccess } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { mediaUrl } from "@/constants/media";
import { byId } from "@/lib/panahgah/registry";
import {
  addHistoryEntry,
  bumpVisitIndex,
  getHistory,
  getVisitIndex,
} from "@/lib/panahgah/storage";
import type { Step } from "@/lib/panahgah/types";

import ActionStepCard from "@/app/panahgah/components/ActionStepCard";
import { pickRelaxation, RelaxationPlayer } from "@/lib/panahgah/relaxations";

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

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function BigAudioPlayer({ url }: { url: string }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const opLockRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(1);
  const [trackW, setTrackW] = useState(0);

  const lock = async <T,>(fn: () => Promise<T>) => {
    if (opLockRef.current) return null as any;
    opLockRef.current = true;
    try {
      return await fn();
    } finally {
      opLockRef.current = false;
    }
  };

  const unload = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    try {
      if (s) {
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
    if (!mountedRef.current) return;
    setIsLoaded(false);
    setIsPlaying(false);
    setIsBuffering(false);
    setPosMs(0);
    setDurMs(1);
  }, []);

  const loadIfNeeded = useCallback(async () => {
    if (soundRef.current) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: false, isLooping: false },
      (st) => {
        const s = st as AVPlaybackStatusSuccess;
        if (!s?.isLoaded) return;
        if (!mountedRef.current) return;
        setIsLoaded(true);
        setIsPlaying(!!s.isPlaying);
        setPosMs(Number(s.positionMillis || 0));
        setDurMs(Math.max(1, Number(s.durationMillis || 1)));
        setIsBuffering(false);
        if (s.didJustFinish) setIsPlaying(false);
      }
    );

    soundRef.current = sound;
    if (!mountedRef.current) return;
    setIsLoaded(true);
    setIsBuffering(false);
  }, [url]);

  const togglePlay = useCallback(() => {
    return lock(async () => {
      if (isBuffering) return;
      if (!soundRef.current) setIsBuffering(true);
      await loadIfNeeded();
      const s = soundRef.current;
      if (!s) {
        if (mountedRef.current) setIsBuffering(false);
        return;
      }
      const st = (await s.getStatusAsync().catch(() => null)) as
        | AVPlaybackStatusSuccess
        | null;
      if (!st || !st.isLoaded) {
        if (mountedRef.current) setIsBuffering(false);
        return;
      }
      setIsBuffering(false);
      if (st.isPlaying) {
        await s.pauseAsync().catch(() => {});
        if (!mountedRef.current) return;
        setIsPlaying(false);
        return;
      }
      if (
        Number(st.positionMillis || 0) >=
        Number(st.durationMillis || 0) - 250
      ) {
        await s.setPositionAsync(0).catch(() => {});
      }
      await s.playAsync().catch(() => {});
      if (!mountedRef.current) return;
      setIsPlaying(true);
    });
  }, [isBuffering, loadIfNeeded]);

  const seekTo = useCallback(
    (ms: number) => {
      return lock(async () => {
        await loadIfNeeded();
        const s = soundRef.current;
        if (!s) return;
        const st = (await s.getStatusAsync().catch(() => null)) as
          | AVPlaybackStatusSuccess
          | null;
        if (!st || !st.isLoaded) return;
        const d = Math.max(1, Number(st.durationMillis ?? durMs ?? 1));
        const clamped = Math.max(0, Math.min(ms, d));
        await s.setPositionAsync(clamped).catch(() => {});
      });
    },
    [durMs, loadIfNeeded]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unload();
    };
  }, [unload]);

  const progressPct = Math.min(1, posMs / Math.max(1, durMs));

  return (
    <View style={styles.bigPlayerWrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={togglePlay}
        style={styles.bigPlayBtn}
      >
        {isBuffering ? (
          <ActivityIndicator color={palette.bg} />
        ) : (
          <Ionicons
            name={isPlaying ? "stop" : "play"}
            size={72}
            color={palette.bg}
            style={{ marginLeft: isPlaying ? 0 : 6 }}
          />
        )}
      </TouchableOpacity>

      <View
        style={styles.bigTrack}
        onLayout={(e) => setTrackW(e?.nativeEvent?.layout?.width ?? 0)}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={{ flex: 1 }}
          onPress={(e) => {
            if (!trackW) return;
            const x = e.nativeEvent.locationX;
            const pct = Math.max(0, Math.min(1, x / trackW));
            seekTo(Math.floor(pct * durMs));
          }}
        >
          <View
            style={[
              styles.bigFill,
              { width: `${Math.round(progressPct * 100)}%` },
            ]}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.bigTime}>
        {fmtMs(posMs)} / {fmtMs(durMs)}
      </Text>
    </View>
  );
}

function stepLabel(step: Step) {
  const t = (step as any)?.type;
  if (t === "checkin") return "شروع";
  if (t === "voice") return "گوش بده";
  if (t === "form") return "بنویس";
  if (t === "breath") return "آروم شو";
  if (t === "action") return "اجرا کن";
  if (t === "done") return "پایان";
  return "مرحله";
}

function resolveVoiceUrl(uri: number | string): string | null {
  if (typeof uri === "number") return null;
  const s = String(uri || "").trim();
  if (!s) return null;
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("file://")
  )
    return s;
  return mediaUrl(s);
}

function clampInt(n: any, min = 0, max = 10) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

/**
 * سیستم رنگ‌گذاری شدت (۱ تا ۱۰)
 * ۱-۳ سبز، ۴-۶ نارنجی، ۷-۱۰ قرمز
 */
function severityColor(n: number | null | undefined) {
  if (n == null) return palette.border;
  if (n <= 3) return palette.green;
  if (n <= 6) return palette.orange;
  return palette.red;
}

type ActionCardResult = {
  before: number;
  after: number;
  improvement: number;
  attempt: number;
  selected: { id: string; label: string; category?: any };
};

/** ✅ فرم‌ها به تفکیک step index ذخیره میشن */
type FormState = {
  values: Record<string, string>;
  touched: Record<string, boolean>;
};

export default function Runner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = byId(id!);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const [visitIndex, setVisitIndex] = useState<number>(1);
  const [preBad, setPreBad] = useState<number | null>(null);
  const [postBad, setPostBad] = useState<number | null>(null);
  const [actionRuns, setActionRuns] = useState<ActionCardResult[]>([]);
  const [actionRunNonce, setActionRunNonce] = useState(0);
  const [formValid, setFormValid] = useState(false);

  // ✅ NEW: state فرم‌ها که با رفت‌وبرگشت پاک نشه
  const [formByStep, setFormByStep] = useState<Record<number, FormState>>({});

  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const scrollToInput = useCallback((key: string, extraOffset = 22) => {
    const input = inputRefs.current[key] as any;
    const scroll = scrollRef.current as any;
    if (!input || !scroll) return;

    const doScroll = () => {
      const responder = scroll.getScrollResponder?.();
      const innerMaybe =
        responder?.getInnerViewNode?.() ??
        responder?.getScrollableNode?.() ??
        findNodeHandle(scroll);

      const innerNode =
        typeof innerMaybe === "number" ? innerMaybe : findNodeHandle(innerMaybe);
      const inputNode = findNodeHandle(input);

      if (!innerNode || !inputNode) return;

      UIManager.measureLayout(
        inputNode,
        innerNode,
        () => {},
        (_x, y) => {
          const targetY = Math.max(0, y - extraOffset);
          scroll.scrollTo?.({ y: targetY, animated: true });
        }
      );
    };

    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 220);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);
      try {
        if (!scenario) return;

        const visitsSoFar = await getVisitIndex(scenario.id);
        const nextVisitIndex = visitsSoFar + 1;
        if (!alive) return;
        setVisitIndex(nextVisitIndex);

        const plan = scenario.getPlanForVisit(nextVisitIndex);
        if (!alive) return;
        setSteps(plan);

        const hist = await getHistory(scenario.id);
        if (!alive) return;
        setHasHistory((hist?.length ?? 0) > 0);

        setIdx(0);
        setPreBad(null);
        setPostBad(null);
        setActionRuns([]);
        setActionRunNonce(0);
        setFormValid(false);

        // ✅ NEW: ریست فرم‌ها فقط وقتی سناریو/وییزیت جدید میشه
        setFormByStep({});
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [scenario?.id]);

  useEffect(() => {
    if (booting) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    });
    return () => {
      cancelled = true;
      // @ts-ignore
      if (typeof task?.cancel === "function") task.cancel();
    };
  }, [idx, booting]);

  const step = steps?.[idx] ?? null;
  const isLast = !!steps && idx === steps.length - 1;
  const showBack = idx >= 1;

  const pills = useMemo(() => {
    const total = steps?.length ?? 0;
    return Array.from({ length: total }, (_, i) => i);
  }, [steps?.length]);

  const relaxSeed = useMemo(() => {
    return `${scenario?.id ?? "no_scenario"}:${visitIndex}:${idx}`;
  }, [scenario?.id, visitIndex, idx]);

  const findStepIndex = useCallback(
    (type: string) => {
      if (!steps) return -1;
      return steps.findIndex((s: any) => String(s?.type) === type);
    },
    [steps]
  );

  const goToType = useCallback(
    (type: string) => {
      const j = findStepIndex(type);
      if (j >= 0) setIdx(j);
    },
    [findStepIndex]
  );

  const stepAny = step as any;

  const canNext = useMemo(() => {
    if (!stepAny) return true;
    if (stepAny.type === "checkin") return preBad !== null;
    if (stepAny.type === "form") return formValid;
    if (stepAny.type === "action") return false;
    if (stepAny.type === "done") return false;
    return true;
  }, [stepAny, preBad, formValid]);

  async function next() {
    if (!steps) return;
    if ((stepAny?.type as string) === "checkin" && preBad === null) return;
    if ((stepAny?.type as string) === "form" && !formValid) return;

    if (idx < steps.length - 1) setIdx((i) => i + 1);
    else {
      if (scenario) await bumpVisitIndex(scenario.id);
      router.back();
    }
  }

  if (!scenario || !steps || !step) {
    return (
      <SafeAreaView
        style={[styles.root, { justifyContent: "center", alignItems: "center" }]}
        edges={["top"]}
      >
        <ActivityIndicator color={palette.gold} />
        <Text
          style={{
            color: palette.muted,
            marginTop: 10,
            fontWeight: "800",
            fontSize: 12,
          }}
        >
          در حال آماده‌سازی…
        </Text>
      </SafeAreaView>
    );
  }

  const isActionOrDone = stepAny.type === "action" || stepAny.type === "done";

  // ✅ فرم state مربوط به همین step
  const currentFormState: FormState =
    formByStep[idx] ?? { values: {}, touched: {} };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{scenario.title}</Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push(`/panahgah/history/${scenario.id}`)}
          style={[styles.iconBtn, !hasHistory && { opacity: 0.35 }]}
          activeOpacity={0.8}
          disabled={!hasHistory}
        >
          <Ionicons name="time-outline" size={18} color={palette.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 72 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 18 + insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepPills}>
            {pills.map((i) => {
              const label = steps?.[i] ? stepLabel(steps[i]) : "—";
              return (
                <View
                  key={i}
                  style={[styles.stepPill, i === idx && styles.stepPillOn]}
                >
                  <Text style={styles.stepPillText}>{label}</Text>
                </View>
              );
            })}
          </View>

          {stepAny.type === "checkin" ? (
            <CheckinStep
              title={String(stepAny?.title || "الان شدت حال بدت چقدره؟")}
              value={preBad}
              onChange={(v) => setPreBad(clampInt(v, 1, 10))}
            />
          ) : stepAny.type === "voice" ? (
            <VoiceStep step={stepAny} />
          ) : stepAny.type === "form" ? (
            <FormStep
              step={stepAny}
              scrollToInput={scrollToInput}
              inputRefs={inputRefs}
              onValidityChange={setFormValid}
              // ✅ NEW: کنترل از Runner
              values={currentFormState.values}
              touched={currentFormState.touched}
              onChangeValue={(fieldKey, text) => {
                setFormByStep((prev) => ({
                  ...prev,
                  [idx]: {
                    values: { ...(prev[idx]?.values ?? {}), [fieldKey]: text },
                    touched: prev[idx]?.touched ?? {},
                  },
                }));
              }}
              onTouchField={(fieldKey) => {
                setFormByStep((prev) => ({
                  ...prev,
                  [idx]: {
                    values: prev[idx]?.values ?? {},
                    touched: { ...(prev[idx]?.touched ?? {}), [fieldKey]: true },
                  },
                }));
              }}
            />
          ) : stepAny.type === "breath" ? (
            <RelaxationStep seed={relaxSeed} />
          ) : stepAny.type === "action" ? (
            <ActionStep
              seed={`${scenario?.id ?? "no_scenario"}:action:${visitIndex}:${idx}:${actionRunNonce}`}
              title={String(stepAny?.title || "اجرا کن")}
              onDone={(r) => {
                setActionRuns((prev) => [...prev, r]);
                setPostBad(null);
                goToType("done");
              }}
              onBack={() => setIdx((v) => Math.max(0, v - 1))}
            />
          ) : stepAny.type === "done" ? (
            <DoneStep
              title={String(stepAny?.title || "پایان")}
              pre={preBad}
              post={postBad}
              onSetPost={(v) => setPostBad(clampInt(v, 1, 10))}
              onSuggestAction={() => {
                setActionRunNonce((v) => v + 1);
                goToType("action");
              }}
              onSuggestRelax={() => goToType("breath")}
              onBack={() => setIdx((v) => Math.max(0, v - 1))}
              onFinish={async () => {
                const pre = clampInt(preBad ?? 1, 1, 10);
                const post = clampInt(postBad ?? pre, 1, 10);
                const improvement = pre - post;

                const lines: string[] = [];
                lines.push(`وضعیت تو در این نوبت`);
                lines.push(``);
                lines.push(`شدت حال تو قبل از تکنیک: ${pre} از ۱۰`);
                lines.push(`شدت حال تو بعد از تکنیک: ${post} از ۱۰`);
                lines.push(`میزان بهبود تو: ${improvement} درجه`);
                lines.push(``);
                
// ✅ NEW: متن‌های نوشته‌شده هم به خلاصه و تاریخچه اضافه میشن
type FormFieldEntry = { key: string; label: string; value: string };
type FormEntry = { stepIndex: number; title: string; fields: FormFieldEntry[] };

// ✅ NEW: متن‌های نوشته‌شده هم به خلاصه و تاریخچه اضافه میشن
const formEntries: Array<{
  stepIndex: number;
  title: string;
  fields: Array<{ key: string; label: string; value: string }>;
}> = [];

if (steps?.length) {
  steps.forEach((s: any, si: number) => {
    if (String(s?.type) !== "form") return;

    const st = formByStep?.[si];
    if (!st) return;

    // ✅ هم حالت معمولی (fields) هم حالت جدول (table.columns)
    const rawFields: Array<{ key: string; label?: string }> =
      Array.isArray(s?.fields) && s.fields.length
        ? s.fields
        : Array.isArray(s?.table?.columns) && s.table.columns.length
        ? s.table.columns
        : [];

    if (!rawFields.length) return;

    const fields = rawFields.map((f) => {
      const k = String((f as any).key);
      const label = String((f as any).label ?? k);
      const value = String((st.values?.[k] ?? "")).trim();
      return { key: k, label, value };
    });

    const hasAny = fields.some((it) => it.value.length > 0);
    if (!hasAny) return;

    formEntries.push({
      stepIndex: si,
      title: String(s?.title || "بنویس"),
      fields,
    });
  });
}

                if (formEntries.length) {
                  lines.push(`نوشته‌های تو:`);
                  formEntries.forEach((fe, i) => {
                    lines.push(`${i + 1}) ${fe.title}`);
                    fe.fields.forEach((f) => {
                      if (!f.value) return;
                      lines.push(`- ${f.label}: ${f.value}`);
                    });
                    lines.push(``);
                  });
                }

               if (actionRuns.length) {
  lines.push(`اقدامات انجام‌شده:`);
  actionRuns.forEach((a, i) => {
    lines.push(`${i + 1}) ${a.selected.label}`);
  });
  lines.push(``);
}

                const payload = lines.join("\n");

                const data = {
                  kind: "panahgah_summary",
                  preBad: pre,
                  postBad: post,
                  improvement,
                  actions: actionRuns,
                  // ✅ NEW
                  forms: formEntries,
                  visitIndex,
                  at: Date.now(),
                };

                await addHistoryEntry(scenario.id, payload, data as any);
                setHasHistory(true);

                if (scenario) await bumpVisitIndex(scenario.id);
                router.back();
              }}
            />
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>مرحله ناشناخته</Text>
              <Text style={[styles.p, { textAlign: "center" }]}>
                این مرحله type معتبر ندارد.
              </Text>
            </View>
          )}

          {/* ✅ ناوبری پایین صفحه (همون چیزی که قبلاً درستش کرده بودیم) */}
          {isActionOrDone ? (
            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIdx((v) => Math.max(0, v - 1));
                  }}
                  style={[styles.secondaryBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 14, gap: 10 }}>
              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                {showBack ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (isLast) {
                        router.back();
                        return;
                      }
                      setIdx((v) => Math.max(0, v - 1));
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {isLast ? "خروج" : "بازگشت"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canNext}
                  onPress={() => {
                    Keyboard.dismiss();
                    next();
                  }}
                  style={[
                    styles.primaryBtn,
                    { flex: 1 },
                    !canNext && { opacity: 0.45 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {isLast ? "تمام" : "مرحله بعد"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال آماده‌سازی…</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function VoiceStep({ step }: { step: Extract<Step, { type: "voice" }> }) {
  const url = useMemo(
    () => resolveVoiceUrl((step as any).uri),
    [(step as any).uri]
  );

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>{(step as any).title}</Text>
      </View>

      {url ? (
        <View style={styles.centerWrap}>
          <BigAudioPlayer url={url} />
        </View>
      ) : null}
    </>
  );
}

function FormStep({
  step,
  scrollToInput,
  inputRefs,
  onValidityChange,

  // ✅ controlled props
  values,
  touched,
  onChangeValue,
  onTouchField,
}: {
  step: Extract<Step, { type: "form" }>;
  scrollToInput: (key: string, extra?: number) => void;
  inputRefs: React.MutableRefObject<Record<string, TextInput | null>>;
  onValidityChange: (v: boolean) => void;

  values: Record<string, string>;
  touched: Record<string, boolean>;
  onChangeValue: (fieldKey: string, text: string) => void;
  onTouchField: (fieldKey: string) => void;
}) {
  const stepAny = step as any;

  const isTable =
    String(stepAny?.variant || "") === "table" && !!stepAny?.table;

  const fields: any[] = Array.isArray(stepAny?.fields) ? stepAny.fields : [];

  const table = stepAny?.table as
    | {
        columns: Array<{ key: string; label: string }>;
        rows?: Array<{ id: string }>;
      }
    | undefined;

  // ✅ required هم برای table و هم برای فرم معمولی
  const required: string[] = Array.isArray(stepAny?.required)
    ? stepAny.required.map((x: any) => String(x))
    : [];

  /* ---------------------------------------------
   * ✅ Auto-calc for Risk Score form (rs_*)
   * فقط وقتی فیلدهای اصلی وجود دارند فعال می‌شود.
   * -------------------------------------------- */
  useEffect(() => {
    // فقط برای فرم معمولی (نه table) چون این فرم ریسک‌اسکور از fields می‌آید
    if (isTable) return;

    const keys = [
      "rs_repeat_pattern",
      "rs_accountability",
      "rs_behavior_change",
      "rs_trust_damage",
      "rs_boundaries",
      "rs_pressure",
      "rs_third_party",
      "rs_my_state",
    ];

    const isRiskScoreForm = keys.every((k) =>
      fields.some((f: any) => String(f?.key) === k)
    );
    if (!isRiskScoreForm) return;

    const nums: number[] = keys
  .map((k) => Number((values[k] ?? "").trim()))
  .filter((n) => n === 0 || n === 1 || n === 2);

const allPicked = nums.length === keys.length;
const total = allPicked ? nums.reduce((a, b) => a + b, 0) : NaN;

    const nextTotal = allPicked ? String(total) : "";

    // ⚠️ این جمله‌ها رو هر وقت خواستی دقیق‌تر می‌کنیم، فعلاً کاربردی و شفاف
    const nextRule = allPicked
      ? total >= 8
        ? "ریسک بالاست. فعلاً بهش جواب نده. اگه لازم شد جواب بدی فقط یک پیام کوتاه قاطعانه بفرست."
        : total >= 4
          ? "ریسک متوسطه. عجله نکن. یک روز صبر کن و بعد با مرزهای روشن و سؤال‌های دقیق صحبت کن."
          : "ریسک پایین‌تره. باز هم عجله نکن؛ فقط با مرزهای روشن و تصمیمِ منطقی جلو برو و باهاش صحبت کن."
      : "";

    // جلوگیری از loop: فقط اگر تغییر واقعی بود
    if ((values["rs_total"] ?? "") !== nextTotal) onChangeValue("rs_total", nextTotal);
    if ((values["rule_from_score"] ?? "") !== nextRule) onChangeValue("rule_from_score", nextRule);
  }, [isTable, fields, values, onChangeValue]);

  /* -------------------------
   * ✅ Validity
   * ------------------------- */
  useEffect(() => {
    if (isTable) {
      const valid =
        required.length === 0
          ? true
          : required.every((k) => (values[k] ?? "").trim().length > 0);
      onValidityChange(valid);
      return;
    }

    // ✅ فرم معمولی: اگر required داری، فقط همونا اجباری‌ان
    const must = required.length
      ? required
      : fields.map((f: any) => String(f?.key));

    const valid = must.every((k) => (values[k] ?? "").trim().length > 0);
    onValidityChange(valid);
  }, [isTable, required, values, fields, onValidityChange]);

  /* -------------------------
   * ✅ Render helpers
   * ------------------------- */
  const renderScore02 = (
    fieldKey: string,
    label: string,
    optionsLine?: string
  ) => {
    const val = (values[fieldKey] ?? "").trim(); // "0" | "1" | "2" | ""
    const mustFill = isTable
      ? required.includes(fieldKey)
      : required.length
        ? required.includes(fieldKey)
        : true;

    const hasError = !!touched[fieldKey] && mustFill && val.length === 0;

    const setPick = (n: 0 | 1 | 2) => {
      onChangeValue(fieldKey, String(n));
      onTouchField(fieldKey);
    };

    const chip = (n: 0 | 1 | 2) => {
      const selected = val === String(n);
      return (
        <TouchableOpacity
          key={`${fieldKey}:${n}`}
          activeOpacity={0.9}
          onPress={() => setPick(n)}
          style={[
            styles.scoreChip,
            selected ? styles.scoreChipOn : null,
            hasError ? { borderColor: palette.red } : null,
          ]}
        >
          <Text style={[styles.scoreChipText, selected ? styles.scoreChipTextOn : null]}>
            {String(n)}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>{label}</Text>

        {optionsLine ? (
          <Text style={[styles.p, { textAlign: "center", marginTop: 8, opacity: 0.9 }]}>
            {optionsLine}
          </Text>
        ) : null}

        <View style={styles.scoreRow}>
          {chip(0)}
          {chip(1)}
          {chip(2)}
        </View>

        {hasError ? <Text style={styles.errorText}>یکی از گزینه‌ها رو انتخاب کن</Text> : null}
      </View>
    );
  };

  const renderReadonly = (fieldKey: string, label: string) => {
    const val = (values[fieldKey] ?? "").trim();
    return (
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>{label}</Text>
        <View style={styles.readonlyBox}>
          <Text style={[styles.p, { textAlign: "center" }]}>
            {val.length ? val : "—"}
          </Text>
        </View>
      </View>
    );
  };

  const renderInput = (fieldKey: string, label: string, isLast?: boolean) => {
    const refKey = isTable ? `t:${fieldKey}` : `f:${fieldKey}`;
    const val = values[fieldKey] ?? "";

    const mustFill = isTable
      ? required.includes(fieldKey)
      : required.length
        ? required.includes(fieldKey)
        : true;

    const hasError = !!touched[fieldKey] && mustFill && val.trim().length === 0;

    return (
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>{label}</Text>

        <TextInput
          ref={(x) => {
            inputRefs.current[refKey] = x;
          }}
          value={val}
          onChangeText={(t) => onChangeValue(fieldKey, t)}
          onBlur={() => onTouchField(fieldKey)}
          onFocus={() => setTimeout(() => scrollToInput(refKey, 22), 60)}
          placeholder="بنویس…"
          placeholderTextColor="rgba(231,238,247,.35)"
          multiline
          style={[
            styles.input,
            isLast ? { minHeight: 140 } : null,
            hasError ? { borderColor: palette.red } : null,
          ]}
          textAlign="right"
          textAlignVertical="top"
        />

        {hasError ? <Text style={styles.errorText}>این بخش رو کامل کن</Text> : null}
      </View>
    );
  };

  const renderField = (f: any, i: number, total: number) => {
    const k = String(f?.key);
    const label = String(f?.label ?? f?.key ?? "");
    const kind = String(f?.kind ?? "");

    if (kind === "score02") {
      return (
        <View key={k}>
          {renderScore02(k, label, String(f?.optionsLine ?? ""))}
        </View>
      );
    }

    if (kind === "readonly") {
      return <View key={k}>{renderReadonly(k, label)}</View>;
    }

    const isLast = i === total - 1;
    return <View key={k}>{renderInput(k, label, isLast)}</View>;
  };

  /* -------------------------
   * ✅ UI
   * ------------------------- */
  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>{String(stepAny?.title || "بنویس")}</Text>
      </View>

      <View style={{ gap: 12, marginTop: 10 }}>
        {isTable ? (
          <>
            {(table?.columns ?? []).map((c: any, i: number) => {
              const k = String(c?.key);
              const label = String(c?.label ?? c?.key);
              const isLast = i === (table?.columns?.length ?? 1) - 1;
              return <View key={k}>{renderInput(k, label, isLast)}</View>;
            })}
          </>
        ) : (
          <>
            {fields.map((f: any, i: number) => renderField(f, i, fields.length))}
          </>
        )}
      </View>
    </>
  );
}

function RelaxationStep({ seed }: { seed: string }) {
  const [nonce, setNonce] = useState(0);
  const seedKey = useMemo(() => `${String(seed)}:${nonce}`, [seed, nonce]);
  const model = useMemo(() => pickRelaxation(seedKey), [seedKey]);

  return (
    <>
      {/* ✅ عنوان بالا تبدیل شد به جمله راهنما */}
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>برای بهتر شدن حالت، این روش آرام‌سازی رو انجام بده.</Text>
      </View>

      {/* ✅ پلیر */}
      <RelaxationPlayer model={model} />

      {/* ✅ دکمه تغییر روش آمد زیر پلیر */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setNonce((n) => n + 1)}
        style={styles.changeRelaxBtn}
      >
        <Ionicons name="refresh" size={16} color={palette.text} />
        <Text style={styles.changeRelaxText}>تغییر روش آرام‌سازی</Text>
      </TouchableOpacity>
    </>
  );
}

function CheckinStep({
  title,
  value,
  onChange,
}: {
  title: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const numsTop = [10, 9, 8, 7, 6];
  const numsBottom = [5, 4, 3, 2, 1];

  const renderRow = (arr: number[]) => (
    <View style={styles.ratingRow}>
      {arr.map((n) => {
        const on = value === n;
        return (
          <TouchableOpacity
            key={n}
            activeOpacity={0.9}
            onPress={() => onChange(n)}
            style={[
              styles.rateChip,
              on && {
                backgroundColor: "rgba(212,175,55,.20)",
                borderColor: "rgba(212,175,55,.40)",
              },
            ]}
          >
            <Text style={[styles.rateChipText, on && { color: palette.text }]}>
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={[styles.p, { textAlign: "center" }]}>
          هر چقدر به ۱۰ نزدیک‌تر باشه حالت بدتره.
          {"\n"}
          هر چقدر به ۱ نزدیک‌تر باشه حالت بهتره.
        </Text>
      </View>

      <View style={[styles.sectionCard, { padding: 12 }]}>
        {renderRow(numsTop)}
        {renderRow(numsBottom)}
      </View>
    </>
  );
}

function ActionStep({
  seed,
  title,
  onDone,
}: {
  seed: string;
  title: string;
  onDone: (r: ActionCardResult) => void;
  onBack: () => void;
}) {
  return (
    <>
      <ActionStepCard
        seed={seed}
        title={title}
        onComplete={(r) => {
          onDone(r as any);
        }}
      />
    </>
  );
}

function DoneStep({
  title,
  pre,
  post,
  onSetPost,
  onSuggestAction,
  onSuggestRelax,
  onFinish,
}: {
  title: string;
  pre: number | null;
  post: number | null;
  onSetPost: (v: number) => void;
  onSuggestAction: () => void;
  onSuggestRelax: () => void;
  onBack: () => void;
  onFinish: () => Promise<void>;
}) {
  const numsTop = [10, 9, 8, 7, 6];
  const numsBottom = [5, 4, 3, 2, 1];

  const preSafe = pre ?? null;
  const postSafe = post ?? null;

  const improvement =
    preSafe != null && postSafe != null ? preSafe - postSafe : null;

  const verdict: "none" | "good" | "medium" | "bad" = useMemo(() => {
  if (preSafe == null || postSafe == null || improvement == null) return "none";

  // ✅ NEW: اگر حالِ بعد خودش در محدوده‌ی خوبه، دیگه گیر نده
  if (postSafe <= 3) return "good";

  // منطق قبلی
  if (improvement >= 2) return "good";
  if (improvement === 1) return "medium";
  return "bad";
}, [preSafe, postSafe, improvement]);

  const renderRow = (arr: number[]) => (
    <View style={styles.ratingRow}>
      {arr.map((n) => {
        const on = post === n;
        const c = severityColor(n);

        return (
          <TouchableOpacity
            key={n}
            activeOpacity={0.9}
            onPress={() => onSetPost(n)}
            style={[styles.rateChip, { borderColor: c }, on && { backgroundColor: c }]}
          >
            <Text style={[styles.rateChipText, on && { color: palette.bg }]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <>
      <View style={styles.sectionCard}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={[styles.p, { textAlign: "center" }]}>
          اگه حالت بدتره به سمت عدد ۱۰ انتخاب کن.
          {"\n"}
          اگه حالت بهتر شده به سمت ۱ برو.
        </Text>
      </View>

      <View style={[styles.sectionCard, { padding: 12 }]}>
        {renderRow(numsTop)}
        {renderRow(numsBottom)}

        {improvement != null ? (
          <Text style={[styles.p, { textAlign: "center", marginTop: 10 }]}>
            بهبود: <Text style={{ color: palette.text, fontWeight: "900" }}>{improvement}</Text>
          </Text>
        ) : null}
      </View>

      {postSafe != null ? (
        <View style={styles.sectionCard}>
          {verdict === "good" ? (
            <>
              <Text style={[styles.p, { textAlign: "center", color: palette.green }]}>
                خوبه. کاهش قابل قبول بوده.
              </Text>

              <TouchableOpacity activeOpacity={0.9} onPress={onFinish} style={[styles.primaryBtn, { marginTop: 12 }]}>
                <Text style={styles.primaryBtnText}>ثبت و پایان</Text>
              </TouchableOpacity>
            </>
          ) : verdict === "medium" ? (
            <>
              <Text style={[styles.p, { textAlign: "center", color: palette.orange }]}>
                بهتر شده، ولی یک اقدام دیگه می‌تونه بهترش کنه.
              </Text>

              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
                <TouchableOpacity activeOpacity={0.9} onPress={onSuggestAction} style={[styles.secondaryBtn, { flex: 1 }]}>
                  <Text style={styles.secondaryBtnText}>اقدام دیگر</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.9} onPress={onFinish} style={[styles.primaryBtn, { flex: 1 }]}>
                  <Text style={styles.primaryBtnText}>ثبت و پایان</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.p, { textAlign: "center", color: palette.red }]}>
                کاهش کافی نبوده. یکی از گزینه‌های زیر رو انجام بده.
              </Text>

              <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onSuggestRelax}
                  style={[
                    styles.primaryBtn,
                    { flex: 1, backgroundColor: "rgba(233,138,21,.92)", borderColor: "rgba(233,138,21,.35)" },
                  ]}
                >
                  <Text style={[styles.primaryBtnText, { color: palette.bg }]}>بازگشت به آرام‌سازی</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.9} onPress={onSuggestAction} style={[styles.secondaryBtn, { flex: 1 }]}>
                  <Text style={styles.secondaryBtnText}>اقدام دیگر</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={onFinish} style={[styles.secondaryBtn, { marginTop: 10 }]}>
                <Text style={styles.secondaryBtnText}>ثبت و پایان</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </>
  );
}

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
  headerTitle: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  stepPills: {
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  stepPillOn: {
    backgroundColor: "rgba(212,175,55,.14)",
    borderColor: "rgba(212,175,55,.30)",
  },
  stepPillText: {
    color: "rgba(231,238,247,.88)",
    fontWeight: "900",
    fontSize: 11,
    textAlign: "center",
  },

  sectionCard: {
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
    lineHeight: 22,
  },
  p: {
    color: "rgba(231,238,247,.78)",
    marginTop: 8,
    textAlign: "right",
    lineHeight: 20,
    fontSize: 12,
  },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 18,
  },

  input: {
    marginTop: 10,
    minHeight: 110,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 20,
    textAlign: "right",
  },

  errorText: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "right",
  },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
    flex: 1,
  },
  primaryBtnText: {
    color: palette.bg,
    fontWeight: "900",
  },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
    flex: 1,
  },
  secondaryBtnText: {
    color: palette.text,
    fontWeight: "900",
  },

  centerWrap: {
    marginTop: 8,
    marginBottom: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  bigPlayerWrap: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  bigPlayBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: palette.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  bigTrack: {
    width: "100%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.06)",
    overflow: "hidden",
    marginTop: 4,
  },
  bigFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.orange,
  },
  bigTime: {
    color: "rgba(231,238,247,.70)",
    fontSize: 12,
    fontWeight: "800",
  },
  bigHint: {
    color: "rgba(231,238,247,.65)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },

  bootOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  bootCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(3,7,18,.94)",
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  bootText: {
    color: "rgba(231,238,247,.88)",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
  },

  changeRelaxBtn: {
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
  changeRelaxText: {
    color: palette.text,
    fontWeight: "900",
    fontSize: 12,
  },

  ratingRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  rateChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  rateChipText: {
    color: "rgba(231,238,247,.85)",
    fontWeight: "900",
    fontSize: 12,
  },
  scoreRow: {
  flexDirection: "row-reverse",
  justifyContent: "center",
  gap: 10,
  marginTop: 6,
},
scoreChip: {
  width: 44,
  height: 44,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,.14)",
  backgroundColor: "rgba(0,0,0,.16)",
  alignItems: "center",
  justifyContent: "center",
},
scoreChipOn: {
  backgroundColor: "rgba(212,175,55,.92)",
  borderColor: "rgba(212,175,55,.35)",
},
scoreChipText: {
  color: "rgba(231,238,247,.88)",
  fontWeight: "900",
  fontSize: 14,
},
scoreChipTextOn: {
  color: palette.bg,
},
scoreHintLine: {
  marginTop: 10,
  textAlign: "center",
  color: "rgba(231,238,247,.70)",
  fontSize: 11,
  fontWeight: "800",
  lineHeight: 16,
},
readonlyBox: {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,.10)",
  backgroundColor: "rgba(0,0,0,.14)",
},
readonlyText: {
  color: "rgba(231,238,247,.88)",
  fontWeight: "800",
  fontSize: 12,
  lineHeight: 18,
  textAlign: "right",
},
});