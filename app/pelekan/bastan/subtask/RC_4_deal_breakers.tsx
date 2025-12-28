// app/pelekan/bastan/subtask/RC_4_deal_breakers.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    findNodeHandle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../../hooks/useAuth";
import { useUser } from "../../../../hooks/useUser";

/* ----------------------------- UI ----------------------------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  red: "#FCA5A5",
  green: "#22C55E",
};

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "RC_4_deal_breakers") return "ریز اقدام چهارم";
  return "ریز اقدام";
}

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

/* ----------------------------- Types ----------------------------- */
type DealAnswer = "continue" | "stop" | "unsure";
type Confidence = 25 | 50 | 75 | 100;

type RC4Reason = {
  seen: string;   // چی دیدی
  wound: string;  // کجای تو زخمی شد
  future: string; // اگر ادامه بده چه میشه
};

type RC4Saved = {
  version: 1;
  savedAt: string; // ISO
  answer: DealAnswer;
  confidence: Confidence;
  reasons: RC4Reason[]; // دقیقا 3 تا
  finalMessage: string;
};

/* ----------------------------- Storage Keys ----------------------------- */
const KEY_RC4_FINAL = "pelekan:bastan:subtask:RC_4_deal_breakers:final:v1";
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

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
export default function RC4DealBreakersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  useLocalSearchParams();

  const subtaskKey = "RC_4_deal_breakers";
  const headerNo = subtaskNumberFa(subtaskKey);

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  // 0 معرفی 1 پاسخ 2 دلیل ها 3 حرف آخر
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const [answer, setAnswer] = useState<DealAnswer | null>(null);
  const [confidence, setConfidence] = useState<Confidence>(50);

  const [reasons, setReasons] = useState<RC4Reason[]>([
    { seen: "", wound: "", future: "" },
    { seen: "", wound: "", future: "" },
    { seen: "", wound: "", future: "" },
  ]);

  const [finalMessage, setFinalMessage] = useState("");

  const [confirmLockModal, setConfirmLockModal] = useState(false);
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

  /* ----------------------------- Load FINAL if exists ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_RC4_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as RC4Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAnswer(j.answer);
    setConfidence(j.confidence);
    setReasons(Array.isArray(j.reasons) && j.reasons.length === 3 ? j.reasons : reasons);
    setFinalMessage(String(j.finalMessage || ""));
    return { loaded: true as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;
        setIsReview(!!loaded);
        if (loaded) setStep(3);
      } catch {
        if (alive) setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [loadFinalIfAny]);

  /* ----------------------------- Smooth scroll on step change ----------------------------- */
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
  }, [step, booting]);

  /* ----------------------------- Scroll to input (keyboard safe) ----------------------------- */
  const scrollToInput = useCallback((id: string, extraOffset = 22) => {
    const input = inputRefs.current[id] as any;
    const scroll = scrollRef.current as any;
    if (!input || !scroll) return;

    const node = findNodeHandle(input);
    if (!node) return;

    const responder = scroll.getScrollResponder?.();
    responder?.scrollResponderScrollNativeHandleToKeyboard?.(node, extraOffset, true);
  }, []);

  /* ----------------------------- Validation ----------------------------- */
  const reasonsOk = useMemo(() => {
    // هر فیلد حداقل 50 کاراکتر
    return reasons.every((r) => {
      const a = String(r.seen || "").trim().length >= 50;
      const b = String(r.wound || "").trim().length >= 50;
      const c = String(r.future || "").trim().length >= 50;
      return a && b && c;
    });
  }, [reasons]);

  const finalOk = useMemo(() => String(finalMessage || "").trim().length >= 140, [finalMessage]);

  /* ----------------------------- Helpers ----------------------------- */
  const setReasonField = useCallback(
    (idx: number, field: keyof RC4Reason, value: string) => {
      if (isReview) return;
      setReasons((prev) => {
        const next = [...prev];
        const row = { ...next[idx] };
        row[field] = String(value || "");
        next[idx] = row;
        return next;
      });
    },
    [isReview]
  );

  const persistFinalLocal = useCallback(async () => {
    const payload: RC4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: answer!,
      confidence,
      reasons,
      finalMessage,
    };
    await AsyncStorage.setItem(KEY_RC4_FINAL, JSON.stringify(payload));
  }, [answer, confidence, finalMessage, reasons]);

  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام شدن باید وارد حساب باشی.",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    if (!answer) {
      openModal({
        kind: "error",
        title: "یک پاسخ لازم است",
        message: "اول مشخص کن به دوستت می گفتی ادامه بده یا نه.",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const payloadToSend: RC4Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer,
      confidence,
      reasons,
      finalMessage,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        phone: p,
        subtaskKey: "RC_4_deal_breakers",
        payload: payloadToSend,
      }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.ok && json?.ok) return "ok";

    const err = String(json?.error || "");
    if (err === "ALREADY_DONE") return "already";

    openModal({
      kind: "error",
      title: "ثبت ناموفق بود",
      message: faOnlyTitle(err || "مشکلی پیش آمد. دوباره تلاش کن."),
      primaryText: "باشه",
      onPrimary: closeModal,
    });
    return "fail";
  }, [answer, apiBase, closeModal, confidence, finalMessage, openModal, phone, reasons, token]);

  const doFinalize = useCallback(async () => {
    if (!answer || !reasonsOk || !finalOk) return;

    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) سرور
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) لوکال فقط بعد از ok یا already
      await persistFinalLocal();
      await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلا ثبت شده",
          message: "این ریز اقدام قبلا ثبت شده و نیازی به ثبت دوباره نیست.",
          primaryText: "خروج",
          onPrimary: () => {
            closeModal();
            router.back();
          },
        });
        return;
      }

      openModal({
        kind: "success",
        title: "ثبت شد",
        message: "ثبت انجام شد. از این به بعد امکان تغییر این ریز اقدام وجود ندارد.",
        primaryText: "خروج",
        onPrimary: () => {
          closeModal();
          router.back();
        },
      });
    } finally {
      setSaving(false);
      savingRef.current = false;
      setIsReview(true);
      setStep(3);
    }
  }, [answer, closeModal, completeOnServer, finalOk, openModal, persistFinalLocal, reasonsOk, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  const title = "اگه دوست صمیمیت جای تو بود بهش چی می گفتی؟";

  const stepLabel =
    step === 0 ? "۰) شروع" : step === 1 ? "۱) انتخاب" : step === 2 ? "۲) دلیل ها" : "۳) حرف آخر";

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
          <Text style={styles.headerTitle}>{headerNo}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 72 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Review Banner */}
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور. این ریز اقدام قبلا ثبت شده و قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {/* Step pills */}
          <View style={styles.stepPills}>
            <View style={[styles.stepPill, step === 0 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>شروع</Text>
            </View>
            <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>انتخاب</Text>
            </View>
            <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>دلیل ها</Text>
            </View>
            <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
              <Text style={styles.stepPillText}>حرف آخر</Text>
            </View>
          </View>

          {/* mini label */}
          <Text style={[styles.small, { textAlign: "center", marginBottom: 10 }]}>{stepLabel}</Text>

          {/* Step 0 */}
          {step === 0 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قراره اینجا چیکار کنی؟</Text>
                <Text style={styles.p}>
                  یک لحظه خودتو کنار بذار
                  {"\n"}
                  فرض کن بهترین دوستت دقیقا همین رابطه رو داره
                  {"\n"}
                  همون حرف‍‌ها
                  {"\n"}
                  همون رفتارها
                  {"\n"}
                  همون دردها
                  {"\n"}
                  حالا اینجا فقط یک کار می‌کنی
                  {"\n"}بهش میگی ادامه بده یا نه؟؟
                  {"\n"}
                  این تمرین بهت کمک میکنه از حالت کودک زخمی بیرون بیایی و در نقش بزرگسال بالغ تصمیم بگیری
                </Text>
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(1)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>شروع</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Step 1 */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>اگه دوستت جای تو بود</Text>
                <Text style={styles.p}>
                  بدون توضیح دادن
                  {"\n"}
                  فقط یکی رو انتخاب کن
                  {"\n"}
                  این پاسخ قرار نیست حقیقت مطلق باشه
                  {"\n"}
                  فقط اولین پاسخ ذهن بالغ و عاقل توئه
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {[
                  { k: "continue" as DealAnswer, t: "ادامه بده" },
                  { k: "stop" as DealAnswer, t: "ادامه نده" },
                  { k: "unsure" as DealAnswer, t: "مطمئن نیستم" },
                ].map((o) => {
                  const on = answer === o.k;
                  return (
                    <Pressable
                      key={o.k}
                      onPress={() => {
                        if (isReview) return;
                        setAnswer(o.k);
                      }}
                      style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      disabled={isReview}
                    >
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={on ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={on ? palette.green : "rgba(231,238,247,.55)"}
                        />
                        <Text style={styles.choiceText}>{o.t}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.sectionCard, { marginTop: 12 }]}>
                <Text style={styles.h1}>چقدر به جوابت مطمئنی؟</Text>
                <Text style={styles.p}>
                  این فقط کمک میکنه بفهمی هنوز توو حالت دودلی هستی یا نه!
                </Text>

                <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
                  {[
                    { v: 25 as Confidence, t: "کم" },
                    { v: 50 as Confidence, t: "متوسط" },
                    { v: 75 as Confidence, t: "زیاد" },
                    { v: 100 as Confidence, t: "خیلی زیاد" },
                  ].map((x) => {
                    const on = confidence === x.v;
                    return (
                      <Pressable
                        key={x.v}
                        onPress={() => {
                          if (isReview) return;
                          setConfidence(x.v);
                        }}
                        style={[styles.pillBtn, on && styles.pillBtnOn, isReview && { opacity: 0.7 }]}
                        disabled={isReview}
                      >
                        <Text style={[styles.pillBtnText, on && { color: palette.text }]}>{x.t}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(0)} style={[styles.secondaryBtn, { flex: 1 }]}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!answer}
                    onPress={() => setStep(2)}
                    style={[styles.primaryBtn, { flex: 1 }, !answer && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* Step 2 */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>از جواب خودت دفاع کن</Text>
                <Text style={styles.p}>
                  اینجا هدف تحلیل پیچیده نیست
                  {"\n"}
                  هدف اینه که ببینی جوابت چقد منطقیه
                  {"\n"}
                  پس سه دلیل برای جوابت بیار و دو مدرک برای دلیلت بگو
                  {"\n"}
                  مثلا بگو چرا باید به حرف تو گوش بده
                  {"\n"}
                  یا چه اتفاقی داخل رابطه افتاده که این دلیل رو منطقی میکنه
                  {"\n"}
                  و با این تصمیم چه چیزهایی رو به دست میاره
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {reasons.map((r, i) => {
                  const base = `r${i}`;
                  const a = String(r.seen || "").trim().length;
                  const b = String(r.wound || "").trim().length;
                  const c = String(r.future || "").trim().length;

                  return (
                    <View key={i} style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                      <Text style={styles.noteTitle}>دلیل {i + 1}</Text>

                      <TextInput
                        ref={(x) => {
                          inputRefs.current[`${base}:seen`] = x;
                        }}
                        value={r.seen}
                        onChangeText={(t) => setReasonField(i, "seen", t)}
                        onFocus={() => setTimeout(() => scrollToInput(`${base}:seen`, 22), 60)}
                        
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <Text style={[styles.small, !isReview && a < 50 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${a}/50`}
                      </Text>

                      <TextInput
                        ref={(x) => {
                          inputRefs.current[`${base}:wound`] = x;
                        }}
                        value={r.wound}
                        onChangeText={(t) => setReasonField(i, "wound", t)}
                        onFocus={() => setTimeout(() => scrollToInput(`${base}:wound`, 22), 60)}
                        placeholder="مدارک، شواهد و دلایل منطقی برای این دلیل"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <Text style={[styles.small, !isReview && b < 50 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${b}/50`}
                      </Text>

                      <TextInput
                        ref={(x) => {
                          inputRefs.current[`${base}:future`] = x;
                        }}
                        value={r.future}
                        onChangeText={(t) => setReasonField(i, "future", t)}
                        onFocus={() => setTimeout(() => scrollToInput(`${base}:future`, 22), 60)}
                        placeholder="مدارک، شواهد و دلایل منطقی برای این دلیل"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        multiline
                        style={[styles.input, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                      />
                      <Text style={[styles.small, !isReview && c < 50 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${c}/50`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(1);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={!reasonsOk}
                    onPress={() => setStep(3)}
                    style={[styles.primaryBtn, { flex: 1 }, !reasonsOk && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!reasonsOk ? <Text style={styles.warn}>برای هر سه دلیل هر سه بخش را حداقل 50 کاراکتر بنویس.</Text> : null}
              </View>
            </>
          ) : null}

          {/* Step 3 */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>حرف آخر به دوستت</Text>
                <Text style={styles.p}>
                  یک پیام کوتاه و روشن بهش بگو که بتونه تصمیم بگیره
                  {"\n"}
                 نصیحتش نکن
                  {"\n"}
                 سرزنشش نکن
                  {"\n"}
                 فقط بهش بگو دقیقا چیکار کنه
                </Text>
              </View>

              <View style={[styles.noteCard, isReview && { opacity: 0.9 }]}>
                <Text style={styles.noteTitle}>پیام تو</Text>

                <TextInput
                  ref={(x) => {
                    inputRefs.current["final"] = x;
                  }}
                  value={finalMessage}
                  onChangeText={(t) => {
                    if (isReview) return;
                    setFinalMessage(String(t || ""));
                  }}
                  onFocus={() => setTimeout(() => scrollToInput("final", 22), 60)}
                  placeholder="مثلا: تو حق داری امنیت داشته باشی. اگه رابطه تو رو کوچیک می کنه ادامه نده. اگه داخلش تغییر واقعی نیست خودت رو قربانی امید نکن."
                  placeholderTextColor="rgba(231,238,247,.35)"
                  multiline
                  style={[styles.input, { minHeight: 140 }, isReview && styles.inputReadOnly]}
                  textAlign="right"
                  textAlignVertical="top"
                  editable={!isReview}
                  selectTextOnFocus={!isReview}
                />

                <Text style={[styles.small, !isReview && String(finalMessage || "").trim().length < 140 ? { color: palette.red } : null]}>
                  {isReview ? "ثبت شده" : `${String(finalMessage || "").trim().length}/140`}
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStep(2);
                    }}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={(!isReview && (!answer || !reasonsOk || !finalOk)) || saving}
                    onPress={onFinishPress}
                    style={[
                      styles.primaryBtn,
                      { flex: 1 },
                      ((!isReview && (!answer || !reasonsOk || !finalOk)) || saving) && { opacity: 0.45 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !finalOk ? <Text style={styles.warn}>حرف آخر باید حداقل 140 کاراکتر باشد.</Text> : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Boot overlay */}
      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال بارگذاری اطلاعات ذخیره شده…</Text>
          </View>
        </View>
      ) : null}

      {/* Confirm lock modal */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت این را بدان"
        message="با زدن ثبت و پایان این ریز اقدام قفل می شود و دیگر امکان تغییر پاسخ ها و متن ها را نداری."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلا نه"
        loading={saving}
        onPrimary={() => {
          setConfirmLockModal(false);
          doFinalize();
        }}
        onSecondary={() => setConfirmLockModal(false)}
      />

      {/* General modal */}
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
  headerTitle: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center" },
  headerSub: { color: "rgba(231,238,247,.85)", marginTop: 4, fontSize: 12, textAlign: "center" },

  reviewBanner: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    backgroundColor: "rgba(0,0,0,.18)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  reviewBannerText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", flex: 1 },

  sectionCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 6,
  },

  stepPills: { flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginBottom: 10 },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  stepPillOn: { backgroundColor: "rgba(212,175,55,.12)", borderColor: "rgba(212,175,55,.28)" },
  stepPillText: { color: "rgba(231,238,247,.85)", fontWeight: "800", fontSize: 11, textAlign: "center" },

  h1: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center", lineHeight: 22 },
  p: { color: "rgba(231,238,247,.78)", marginTop: 8, textAlign: "right", lineHeight: 20, fontSize: 12 },
  small: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right" },
  warn: { color: "rgba(252,165,165,.95)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  choiceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },
  choiceCardOn: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },
  choiceText: { color: palette.text, fontWeight: "800", fontSize: 13, textAlign: "right", lineHeight: 18, flex: 1 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },
  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

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
  inputReadOnly: {
    backgroundColor: "rgba(0,0,0,.12)",
    borderColor: "rgba(255,255,255,.08)",
  },

  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
  },
  primaryBtnText: { color: palette.bg, fontWeight: "900" },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryBtnText: { color: palette.text, fontWeight: "900" },

  pillBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    alignItems: "center",
  },
  pillBtnOn: {
    borderColor: "rgba(212,175,55,.35)",
    backgroundColor: "rgba(212,175,55,.14)",
  },
  pillBtnText: { color: "rgba(231,238,247,.85)", fontWeight: "900", fontSize: 11 },

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