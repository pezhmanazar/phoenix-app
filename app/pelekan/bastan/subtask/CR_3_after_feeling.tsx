// app/pelekan/bastan/subtask/CR_3_after_feeling.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

function subtaskNumberFa(key: string) {
  const k = String(key || "").trim();
  if (k === "CR_3_after_feeling") return "ریز اقدام سوم";
  return "ریز اقدام";
}

// convert Persian/Arabic digits to English digits (prevents NaN)
function toEnDigits(input: string) {
  const map: Record<string, string> = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };
  return String(input || "").replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type RitualKey =
  | "walk_close"
  | "shower_close"
  | "sunrise_sunset_close"
  | "letter_close"
  | "symbolic_grave_close";

type ChecklistItem = { id: string; text: string; help?: string | null };

type CR2Saved = {
  version: 1;
  savedAt: string;

  ritual: { key: RitualKey; title: string; subtitle: string };
  plan: { whenText: string; whereText: string; prepText?: string | null };

  ritualChecklistDoneIds: string[];
  stabilizeDoneIds: string[];
  lockDoneIds: string[];
  nextActionText: string;

  agreeLocked: boolean;
  durationSec?: number | null;
};

type EmotionKey =
  | "sadness"
  | "anger"
  | "fear"
  | "shame"
  | "guilt"
  | "loneliness"
  | "relief"
  | "numbness"
  | "longing"
  | "happy";

type BodyKey =
  | "chest"
  | "throat"
  | "stomach"
  | "head"
  | "jaw"
  | "hands"
  | "back"
  | "whole"
  | "nothing";

type ToolKey =
  | "breathing_4_6"
  | "ground_5_4_3_2_1"
  | "cold_water"
  | "walk_10min"
  | "write_2min"
  | "call_safe_person";

type CR3Saved = {
  version: 1;
  savedAt: string;

  ritual: { key: RitualKey; title: string; subtitle: string };
  plan: { whenText: string; whereText: string; prepText?: string | null };

  emotionsSelected: EmotionKey[];
  bodySelected: BodyKey[];
  intensity10: number; // 1..10
  whatHappenedText: string;
  selfTalkText: string;
  toolSelected: ToolKey | null;

  stabilizeDoneIds: string[];

  lockDoneIds: string[];
  nextActionText: string;

  agreeLocked: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CR_3_after_feeling";
const KEY_CR2_FINAL = "pelekan:bastan:subtask:CR_2_do_ritual:final:v1";
const KEY_CR3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Lists ----------------------------- */

const EMOTIONS: { key: EmotionKey; title: string; help?: string }[] = [
  { key: "sadness", title: "غم", help: "دل‌گرفتگی، گریه، سنگینی." },
  { key: "anger", title: "خشم", help: "جوش‌آوردن، بی‌قراری، عصبانیت." },
  { key: "fear", title: "ترس", help: "نگرانی از آینده، دلشوره." },
  { key: "shame", title: "شرم", help: "احساس کوچک‌شدن یا قضاوت‌شدن." },
  { key: "guilt", title: "عذاب وجدان", help: "«کاش این کار رو نمی‌کردم…»" },
  { key: "loneliness", title: "تنهایی", help: "خلأ، نبودنِ همراه." },
  { key: "relief", title: "سبک شدن", help: "آرامش کوتاه یا حس رهایی." },
  { key: "numbness", title: "بی‌حسی", help: "هیچی حس نمی‌کنم." },
  { key: "longing", title: "دلتنگی", help: "کشش به گذشته و یادآوری." },
  { key: "happy", title: "خوشحالی", help: "یک ذره آرام‌ترم / سبک‌ترم." },
];

const BODY: { key: BodyKey; title: string; help?: string }[] = [
  { key: "chest", title: "قفسه سینه", help: "فشار، سنگینی." },
  { key: "throat", title: "گلو", help: "گیر کردن، بغض." },
  { key: "stomach", title: "معده یا شکم", help: "دل‌پیچه، تهوع." },
  { key: "head", title: "سر", help: "سنگینی، گیجی." },
  { key: "jaw", title: "فک", help: "سفتی، دندان‌قروچه." },
  { key: "hands", title: "دست‌ها", help: "لرزش، بی‌قراری." },
  { key: "back", title: "کمر یا پشت", help: "گرفتگی." },
  { key: "whole", title: "کل بدن", help: "پخش و مبهم." },
  { key: "nothing", title: "هیچ‌جا", help: "حسی در بدنم مشخص نیست." },
];

const TOOLS: { key: ToolKey; title: string; help?: string }[] = [
  { key: "breathing_4_6", title: "تنفس ۴-۴-۶", help: "۴ ثانیه دم، ۴ ثانیه مکث، ۶ ثانیه بازدم — ۵ دقیقه." },
  { key: "ground_5_4_3_2_1", title: "حواس ۵-۴-۳-۲-۱", help: "۵ چیز ببین، ۴ لمس کن، ۳ صدا، ۲ بو، ۱ مزه." },
  { key: "cold_water", title: "آب سرد", help: "۳۰ ثانیه دست و صورت با آب سرد." },
  { key: "walk_10min", title: "۱۰ دقیقه قدم زدن", help: "بدون موبایل، فقط قدم و نفس." },
  { key: "write_2min", title: "۲ دقیقه نوشتن", help: "هرچی تو سرت هست روی کاغذ." },
  { key: "call_safe_person", title: "تماس با آدم امن", help: "با یک نفر امن، ۲ دقیقه." },
];

const STABILIZE_CHECKLIST: ChecklistItem[] = [
  { id: "st1", text: "هیجاناتم رو نام‌گذاری کردم و قبولشون کردم" },
  { id: "st2", text: "یادم هست هیجان مثل یک «موج»ه: میاد و میره", help: "ممکنه بعدش دوباره این هیجانات برگرده و کاملاً طبیعی‌ه." },
  { id: "st3", text: "به خودم یادآوری می‌کنم: «من هیجانم نیستم بلکه من کسی هستم که هیجان داره»" },
  { id: "st4", text: "می‌دونم مغزم ممکنه دنبال «معنا یا امید» بگرده و این نشونه حرکت در مسیر درمانه" },
];

const LOCK_CHECKLIST: ChecklistItem[] = [
  { id: "lk1", text: "قبول دارم بعد از موج هیجانات، وسوسه برای برگشت یا چک‌کردن طبیعیه" },
  { id: "lk2", text: "برای ۲۴ ساعت آینده «هیچ تماس، پیام یا چک‌کردنی» رو انجام نمی‌دم" },
  { id: "lk3", text: "اگه وسوسه شدید شد: اول ابزار انتخابی‌ام رو اجرا می‌کنم" },
  { id: "lk4", text: "همین الان بعد از این ریزاقدام، می‌رم سراغ یک کار مشخص و مفید" },
];

/* ----------------------------- Themed Modal ----------------------------- */

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

export default function CR3AfterFeelingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "ثبت احساس پس از بستن";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // ✅ برای اینکه ته صفحه زیر کیبورد نره
  const [kbHeight, setKbHeight] = useState(0);
  const scrollInnerRef = useRef<View>(null);
  const nextActionInputRef = useRef<TextInput>(null);

  const [cr2, setCr2] = useState<CR2Saved | null>(null);

  // Step 2
  const [emotionsSelected, setEmotionsSelected] = useState<EmotionKey[]>([]);
  const [bodySelected, setBodySelected] = useState<BodyKey[]>([]);
  const [intensityText, setIntensityText] = useState("");
  const [whatHappenedText, setWhatHappenedText] = useState("");
  const [selfTalkText, setSelfTalkText] = useState("");
  const [toolSelected, setToolSelected] = useState<ToolKey | null>(null);

  // Step 3
  const [stabilizeDoneIds, setStabilizeDoneIds] = useState<string[]>([]);

  // Step 4
  const [lockDoneIds, setLockDoneIds] = useState<string[]>([]);
  const [nextActionText, setNextActionText] = useState("");

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

  /* ----------------------------- Keyboard handling ----------------------------- */

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: any) => {
      const h = Math.max(0, Math.floor(e?.endCoordinates?.height || 0));
      setKbHeight(h);
    };

    const onHide = () => setKbHeight(0);

    const s1 = Keyboard.addListener(showEvt as any, onShow);
    const s2 = Keyboard.addListener(hideEvt as any, onHide);

    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  const scrollToInput = useCallback(
  (inputRef: React.RefObject<TextInput | null>, extra = 18) => {
    const input = inputRef.current as any;
    const sc = scrollRef.current as any;
    const container = scrollInnerRef.current as any;
    if (!input || !sc || !container) return;

    requestAnimationFrame(() => {
      try {
        input.measureLayout(
          container,
          (_x: number, y: number, _w: number, h: number) => {
            sc.scrollTo({ y: Math.max(0, y - 12), animated: true });
            setTimeout(() => {
              sc.scrollTo({ y: Math.max(0, y - 12 + h + extra - 80), animated: true });
            }, 40);
          },
          () => {}
        );
      } catch {}
    });
  },
  []
);

  /* ----------------------------- Helpers ----------------------------- */

  const ritualInfo = useMemo(() => (cr2 ? cr2.ritual : null), [cr2]);
  const planInfo = useMemo(() => (cr2 ? cr2.plan : null), [cr2]);

  const intensity10 = useMemo(() => {
    const raw = toEnDigits(String(intensityText || "").trim());
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, n));
  }, [intensityText]);

  const cleanedWhatHappened = useMemo(() => String(whatHappenedText || "").trim(), [whatHappenedText]);
  const cleanedSelfTalk = useMemo(() => String(selfTalkText || "").trim(), [selfTalkText]);
  const cleanedNextAction = useMemo(() => String(nextActionText || "").trim(), [nextActionText]);

  const toggleMulti = useCallback(
    (kind: "emotions" | "body", key: EmotionKey | BodyKey) => {
      if (isReview) return;

      if (kind === "emotions") {
        setEmotionsSelected((prev) =>
          prev.includes(key as EmotionKey) ? prev.filter((x) => x !== key) : [...prev, key as EmotionKey]
        );
        return;
      }

      setBodySelected((prev) => (prev.includes(key as BodyKey) ? prev.filter((x) => x !== key) : [...prev, key as BodyKey]));
    },
    [isReview]
  );

  const toggleId = useCallback(
    (list: "stabilize" | "lock", id: string) => {
      if (isReview) return;
      const setter = list === "stabilize" ? setStabilizeDoneIds : setLockDoneIds;
      setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [isReview]
  );

  const step1Ok = !!cr2;

  const step2Ok =
    emotionsSelected.length >= 1 &&
    bodySelected.length >= 1 &&
    intensity10 >= 1 &&
    intensity10 <= 10 &&
    cleanedWhatHappened.length >= 3 &&
    cleanedSelfTalk.length >= 3 &&
    !!toolSelected;

  const step3Ok = stabilizeDoneIds.length === STABILIZE_CHECKLIST.length;
  const step4Ok = lockDoneIds.length === LOCK_CHECKLIST.length && cleanedNextAction.length >= 3;

  const canGo2 = step1Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Load CR2 + CR3 FINAL ----------------------------- */

  const loadCR2IfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR2_FINAL);
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as CR2Saved;
      if (!j || j.version !== 1) return null;
      return j;
    } catch {
      return null;
    }
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR3_FINAL);
    if (!raw) return { loaded: false as const };

    let j: CR3Saved | null = null;
    try {
      j = JSON.parse(raw) as CR3Saved;
    } catch {
      j = null;
    }
    if (!j || j.version !== 1) return { loaded: false as const };

    const c2 = await loadCR2IfAny();
    setCr2(
      c2 ?? {
        version: 1,
        savedAt: j.savedAt,
        ritual: j.ritual,
        plan: j.plan,
        ritualChecklistDoneIds: [],
        stabilizeDoneIds: [],
        lockDoneIds: [],
        nextActionText: "",
        agreeLocked: true,
        durationSec: null,
      }
    );

    setEmotionsSelected(Array.isArray(j.emotionsSelected) ? j.emotionsSelected : []);
    setBodySelected(Array.isArray(j.bodySelected) ? j.bodySelected : []);
    setIntensityText(String(j.intensity10 || ""));
    setWhatHappenedText(String(j.whatHappenedText || ""));
    setSelfTalkText(String(j.selfTalkText || ""));
    setToolSelected((j.toolSelected ? String(j.toolSelected) : null) as any);

    setStabilizeDoneIds(Array.isArray(j.stabilizeDoneIds) ? j.stabilizeDoneIds : []);
    setLockDoneIds(Array.isArray(j.lockDoneIds) ? j.lockDoneIds : []);
    setNextActionText(String(j.nextActionText || ""));

    return { loaded: true as const };
  }, [loadCR2IfAny]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;

        if (loaded) {
          setIsReview(true);
          setStep(4);
          return;
        }

        const c2 = await loadCR2IfAny();
        if (!alive) return;

        if (!c2) {
          setCr2(null);
          openModal({
            kind: "warn",
            title: "اول باید «انجام آیین بستن» ثبت شده باشه",
            message: "برای این ریزاقدام، لازم است ابتدا ریزاقدام «CR_2_do_ritual» را روی همین دستگاه ثبت کرده باشی.",
            primaryText: "برگرد",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
          return;
        }

        setCr2(c2);
        setIsReview(false);
        setStep(1);
      } catch {
        setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [closeModal, loadCR2IfAny, loadFinalIfAny, openModal, router]);

  /* ----------------------------- Smooth scroll on step ----------------------------- */

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

  /* ----------------------------- Persist FINAL local ----------------------------- */

  const persistFinalLocal = useCallback(async () => {
    if (!cr2 || !ritualInfo || !planInfo) return;

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: CR3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      ritual: ritualInfo,
      plan: {
        whenText: String(planInfo.whenText || "").trim(),
        whereText: String(planInfo.whereText || "").trim(),
        prepText: String(planInfo.prepText || "").trim() ? String(planInfo.prepText || "").trim() : null,
      },

      emotionsSelected,
      bodySelected,
      intensity10,
      whatHappenedText: cleanedWhatHappened,
      selfTalkText: cleanedSelfTalk,
      toolSelected,

      stabilizeDoneIds: stabilizeDoneIds || [],

      lockDoneIds: lockDoneIds || [],
      nextActionText: cleanedNextAction,

      agreeLocked: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CR3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [
    bodySelected,
    cleanedNextAction,
    cleanedSelfTalk,
    cleanedWhatHappened,
    cr2,
    emotionsSelected,
    intensity10,
    lockDoneIds,
    planInfo,
    ritualInfo,
    stabilizeDoneIds,
    toolSelected,
  ]);

  /* ----------------------------- Server submit ----------------------------- */

  const completeOnServer = useCallback(async (): Promise<"ok" | "already" | "fail"> => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();

    if (!t || !p) {
      openModal({
        kind: "error",
        title: "ورود لازم است",
        message: "برای ثبت انجام شدن باید وارد حساب باشی",
        primaryText: "باشه",
        onPrimary: closeModal,
      });
      return "fail";
    }

    if (!cr2 || !ritualInfo || !planInfo) return "fail";

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        ritual: ritualInfo,
        plan: {
          whenText: String(planInfo.whenText || "").trim(),
          whereText: String(planInfo.whereText || "").trim(),
          prepText: String(planInfo.prepText || "").trim() ? String(planInfo.prepText || "").trim() : null,
        },

        step2: {
          emotionsSelected,
          bodySelected,
          intensity10,
          whatHappenedText: cleanedWhatHappened,
          selfTalkText: cleanedSelfTalk,
          toolSelected,
        },

        step3: {
          checklistTotal: STABILIZE_CHECKLIST.length,
          checklistDone: stabilizeDoneIds.length,
          doneIds: stabilizeDoneIds,
        },

        step4: {
          checklistTotal: LOCK_CHECKLIST.length,
          checklistDone: lockDoneIds.length,
          doneIds: lockDoneIds,
          nextActionText: cleanedNextAction,
        },

        summary: {
          ritualTitle: ritualInfo.title,
          intensity10,
          emotionsCount: emotionsSelected.length,
          tool: toolSelected,
          nextAction: cleanedNextAction,
        },

        durationSec,
      },
    };

    const url = `${apiBase}/api/pelekan/bastan/subtask/complete?phone=${encodeURIComponent(p)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({
        phone: p,
        subtaskKey: SUBTASK_KEY,
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
      message: faOnlyTitle(err || "مشکلی پیش آمد"),
      primaryText: "باشه",
      onPrimary: closeModal,
    });
    return "fail";
  }, [
    apiBase,
    bodySelected,
    closeModal,
    cleanedNextAction,
    cleanedSelfTalk,
    cleanedWhatHappened,
    cr2,
    emotionsSelected,
    intensity10,
    lockDoneIds,
    openModal,
    phone,
    planInfo,
    ritualInfo,
    stabilizeDoneIds,
    token,
    toolSelected,
  ]);

  const doFinalize = useCallback(async () => {
    if (!canFinalize) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      const r = await completeOnServer();
      if (r === "fail") return;

      await persistFinalLocal();

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلاً ثبت شده",
          message: "این ریز اقدام قبلاً ثبت شده و نیازی به ثبت دوباره نیست.",
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
        message: "این ریز اقدام قفل شد و قابل تغییر نیست.",
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
      setStep(4);
    }
  }, [canFinalize, closeModal, completeOnServer, openModal, persistFinalLocal, router]);

  /* ----------------------------- Step Pills ----------------------------- */

  const StepPills = (
    <View style={styles.stepPills}>
      <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۱) شروع</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) مشاهده</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) تثبیت</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
      </View>
    </View>
  );

  /* ----------------------------- Render ----------------------------- */

  const contentBottomPad =
  16 + insets.bottom + (Platform.OS === "android" && kbHeight ? kbHeight + 14 : 0);

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
  style={styles.kav}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View ref={scrollInnerRef} collapsable={false}>
            {isReview ? (
              <View style={styles.reviewBanner}>
                <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
                <Text style={styles.reviewBannerText}>حالت مرور فعاله: می‌تونی ببینی، ولی قابل تغییر نیست.</Text>
              </View>
            ) : null}

            {StepPills}

            {/* Step 1 */}
            {step === 1 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>سنجش هیجانات بعد از آیین بستن</Text>
                <Text style={styles.p}>
                  بعد از یک موج هیجانی (مثل گریه، خشم، بی‌حسی و دلتنگی)، مغز معمولاً می‌خواد سریع برگرده به «چک‌کردن»، «امید»، یا
                  «یک پیام کوچیک».
                  {"\n\n"}
                  این ریزاقدام برای اینه که:
                  {"\n"}۱) هیجاناتت رو ببینی و روشون اسم بذاری
                  {"\n"}۲) بدنت رو آروم‌تر کنی
                  {"\n"}۳) و «برگشتِ اشتباه» رو قفل کنی
                </Text>

                <View style={{ height: 12 }} />

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!cr2}
                  onPress={() => {
                    if (!isReview && !startedAtRef.current) startedAtRef.current = Date.now();
                    setStep(2);
                  }}
                  style={[styles.primaryBtn, !cr2 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>شروع می‌کنم</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Step 2 */}
            {step === 2 ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.h1}>مشاهده‌ی موج هیجانات</Text>
                  <Text style={styles.p}>
                    اینجا «تحلیل» نمی‌کنی.
                    {"\n"}
                    فقط قراره مبهم‌بودن رو کم کنی تا مغز نتونه با ابهام، تو رو برگردونه.
                  </Text>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>الان چه احساسی داری؟ (حداقل یک مورد)</Text>
                  <Text style={styles.small}>چندتا هم می‌تونی انتخاب کنی.</Text>

                  <View style={{ height: 10 }} />
                  <View style={{ gap: 10 }}>
                    {EMOTIONS.map((it) => {
                      const on = emotionsSelected.includes(it.key);
                      return (
                        <Pressable
                          key={it.key}
                          onPress={() => toggleMulti("emotions", it.key)}
                          disabled={isReview}
                          style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                        >
                          <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                            <Ionicons
                              name={on ? "checkbox" : "square-outline"}
                              size={18}
                              color={on ? palette.green : "rgba(231,238,247,.55)"}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                              {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>این حس کجای بدنت نشسته؟ (حداقل یک مورد)</Text>

                  <View style={{ height: 10 }} />
                  <View style={{ gap: 10 }}>
                    {BODY.map((it) => {
                      const on = bodySelected.includes(it.key);
                      return (
                        <Pressable
                          key={it.key}
                          onPress={() => toggleMulti("body", it.key)}
                          disabled={isReview}
                          style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                        >
                          <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                            <Ionicons
                              name={on ? "checkbox" : "square-outline"}
                              size={18}
                              color={on ? palette.green : "rgba(231,238,247,.55)"}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                              {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>شدت احساس از ۱ تا ۱۰</Text>
                  <Text style={styles.small}>فقط عدد. مثال: ۷</Text>

                  <View style={{ height: 10 }} />
                  <TextInput
                    editable={!isReview}
                    value={intensityText}
                    onChangeText={(t) => (isReview ? null : setIntensityText(t))}
                    keyboardType="number-pad"
                    placeholder="مثلاً ۷"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    style={[styles.input, isReview && { opacity: 0.7 }]}
                  />

                  <View style={{ height: 12 }} />
                  <Text style={styles.noteTitle}>این موج از چی شروع شد؟ (خیلی کوتاه)</Text>
                  <Text style={styles.small}>مثال: «عکسش رو دیدم»، «شب شد»، «یادم افتاد…»</Text>

                  <View style={{ height: 10 }} />
                  <TextInput
                    editable={!isReview}
                    value={whatHappenedText}
                    onChangeText={(t) => (isReview ? null : setWhatHappenedText(t))}
                    placeholder="جرقه چی بود…"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    style={[styles.inputMultiline, isReview && { opacity: 0.7 }]}
                    multiline
                    textAlignVertical="top"
                    maxLength={220}
                  />

                  <View style={{ height: 12 }} />
                  <Text style={styles.noteTitle}>یک جمله‌ی بالغ برای خودت</Text>
                  <Text style={styles.small}>قشنگ لازم نیست؛ واقعی باشه.</Text>

                  <View style={{ height: 10 }} />
                  <TextInput
                    editable={!isReview}
                    value={selfTalkText}
                    onChangeText={(t) => (isReview ? null : setSelfTalkText(t))}
                    placeholder="مثال: «سخته، ولی تصمیمم عوض نمی‌شه.»"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    style={[styles.inputMultiline, isReview && { opacity: 0.7 }]}
                    multiline
                    textAlignVertical="top"
                    maxLength={240}
                  />
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>یک ابزار فوری انتخاب کن (اجباری)</Text>
                  <Text style={styles.small}>همین الان یا وقتی وسوسه آمد.</Text>

                  <View style={{ height: 10 }} />
                  <View style={{ gap: 10 }}>
                    {TOOLS.map((it) => {
                      const on = toolSelected === it.key;
                      return (
                        <Pressable
                          key={it.key}
                          onPress={() => (isReview ? null : setToolSelected(it.key))}
                          disabled={isReview}
                          style={[
                            styles.choiceCard,
                            isReview && { opacity: 0.7 },
                            on && { borderColor: "rgba(212,175,55,.35)", backgroundColor: "rgba(212,175,55,.08)" },
                          ]}
                        >
                          <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                            <Ionicons
                              name={on ? "radio-button-on" : "radio-button-off"}
                              size={18}
                              color={on ? palette.gold : "rgba(231,238,247,.55)"}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.title}</Text>
                              {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {!step2Ok ? (
                  <Text style={[styles.warn, { marginTop: 10 }]}>
                    برای ادامه: حداقل ۱ احساس + ۱ بخش بدن + شدت (۱ تا ۱۰) + دو متن کوتاه + انتخاب ابزار لازمه.
                  </Text>
                ) : null}

                <View style={{ marginTop: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setStep(1)}
                      style={[styles.secondaryBtn, { flex: 1 }]}
                      disabled={saving}
                    >
                      <Text style={styles.secondaryBtnText}>بازگشت</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setStep(3)}
                      style={[styles.primaryBtn, { flex: 1 }, (!step2Ok || saving) && { opacity: 0.45 }]}
                      disabled={!step2Ok || saving}
                    >
                      <Text style={styles.primaryBtnText}>ادامه</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}

            {/* Step 3 */}
            {step === 3 ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.h1}>تثبیت بعد از موج</Text>
                  <Text style={styles.p}>
                    اینجا مغزت رو از «منطقِ برگشت» جدا می‌کنی.
                    {"\n"}
                    هدف: «پایان» رو دوباره محکم کنی، نه اینکه هیجان خودت رو حذف کنی.
                  </Text>
                </View>

                <View style={{ gap: 10, marginTop: 12 }}>
                  {STABILIZE_CHECKLIST.map((it) => {
                    const on = stabilizeDoneIds.includes(it.id);
                    return (
                      <Pressable
                        key={it.id}
                        onPress={() => toggleId("stabilize", it.id)}
                        disabled={isReview}
                        style={[styles.choiceCard, on && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.text}</Text>
                            {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {!step3Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ادامه: همه‌ی موارد این چک‌لیست باید تیک بخوره.</Text> : null}

                <View style={{ marginTop: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setStep(2)}
                      style={[styles.secondaryBtn, { flex: 1 }]}
                      disabled={saving}
                    >
                      <Text style={styles.secondaryBtnText}>بازگشت</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setStep(4)}
                      style={[styles.primaryBtn, { flex: 1 }, (!step3Ok || saving) && { opacity: 0.45 }]}
                      disabled={!step3Ok || saving}
                    >
                      <Text style={styles.primaryBtnText}>ادامه</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}

            {/* Step 4 */}
            {step === 4 ? (
              <>
                <View style={styles.sectionCard}>
                  <Text style={styles.h1}>قفلِ بازگشت بعد از احساس</Text>
                  <Text style={styles.p}>
                    بعد از موج هیجانات، مغز دنبال «راه فرار» می‌گرده:
                    {"\n"}مثلاً: «فقط یه بار دیگه ببینمش»، «فقط یه پیام بدم» یا «فقط چکش کنم…»
                    {"\n\n"}
                    اینجا اون راه رو می‌بندی.
                  </Text>
                </View>

                <View style={{ gap: 10, marginTop: 12 }}>
                  {LOCK_CHECKLIST.map((it) => {
                    const on = lockDoneIds.includes(it.id);
                    const isDanger = it.id === "lk2";
                    const isGold = it.id === "lk4";
                    return (
                      <Pressable
                        key={it.id}
                        onPress={() => toggleId("lock", it.id)}
                        disabled={isReview}
                        style={[
                          styles.choiceCard,
                          on && styles.choiceCardOn,
                          isReview && { opacity: 0.7 },
                          isDanger && { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                          isGold && { backgroundColor: "rgba(212,175,55,.06)", borderColor: "rgba(212,175,55,.18)" },
                        ]}
                      >
                        <View style={{ flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name={on ? "checkbox" : "square-outline"}
                            size={18}
                            color={on ? palette.green : "rgba(231,238,247,.55)"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.choiceText, { flexShrink: 1 }]}>{it.text}</Text>
                            {it.help ? <Text style={[styles.small, { marginTop: 6 }]}>{it.help}</Text> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.noteCard, { marginTop: 12 }]}>
                  <Text style={styles.noteTitle}>اون «کار مشخص» چیه؟ (اجباری)</Text>
                  <Text style={styles.small}>
                    یک کار خیلی ساده بنویس که همین الان انجام می‌دی.
                    {"\n"}مثال: «می‌رم آب می‌خورم»، «۱۰ دقیقه قدم می‌زنم»، «به یه آدم امن زنگ می‌زنم»، «می‌خوابم»
                  </Text>

                  <View style={{ height: 10 }} />
                  <TextInput
                    ref={nextActionInputRef}
                    editable={!isReview}
                    value={nextActionText}
                    onChangeText={(t) => (isReview ? null : setNextActionText(t))}
                    onFocus={() => {
                      if (Platform.OS === "android") {
                        // اندروید بیشتر قاطی می‌کنه → با تاخیر کوچیک اسکرول کن
                        setTimeout(() => scrollToInput(nextActionInputRef, 24), 40);
                      } else {
                        scrollToInput(nextActionInputRef, 18);
                      }
                    }}
                    placeholder="کار مشخص من…"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    style={[styles.inputMultiline, isReview && { opacity: 0.7 }]}
                    multiline
                    textAlignVertical="top"
                    maxLength={220}
                  />
                </View>

                {!step4Ok ? <Text style={[styles.warn, { marginTop: 10 }]}>برای ثبت: همه تیک‌ها + یک کار مشخص لازمه.</Text> : null}

                <View style={{ marginTop: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setStep(3)}
                      style={[styles.secondaryBtn, { flex: 1 }]}
                      disabled={saving}
                    >
                      <Text style={styles.secondaryBtnText}>بازگشت</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={saving || (!isReview && !canFinalize)}
                      onPress={() => {
                        if (isReview) {
                          router.back();
                          return;
                        }
                        setConfirmLockModal(true);
                      }}
                      style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                    >
                      <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                    </TouchableOpacity>
                  </View>

                  {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه مراحل باید کامل بشه.</Text> : null}
                  {isReview ? <Text style={styles.small}>در حالت مرور، فقط نمایش است و امکان ادیت نداری.</Text> : null}
                </View>

                {/* ✅ این spacer باعث میشه حتی با باگ‌های کیبورد اندروید هم ته صفحه قابل اسکرول باشه */}
                <View style={{ height: 24 }} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Booting */}
      {booting ? (
        <View style={styles.bootOverlay} pointerEvents="auto">
          <View style={styles.bootCard}>
            <ActivityIndicator />
            <Text style={styles.bootText}>در حال بارگذاری اطلاعات ذخیره‌شده…</Text>
          </View>
        </View>
      ) : null}

      {/* Confirm lock */}
      <ThemedModal
        visible={confirmLockModal}
        kind="warn"
        title="قبل از ثبت، این رو بدون"
        message="با زدن «ثبت و پایان»، این ریز اقدام قفل میشه و دیگه امکان تغییر وجود نداره."
        primaryText="ثبت و قفل کن"
        secondaryText="فعلاً نه"
        loading={saving}
        onPrimary={() => {
          setConfirmLockModal(false);
          doFinalize();
        }}
        onSecondary={() => setConfirmLockModal(false)}
      />

      {/* Result modal */}
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

  kav: { flex: 1, backgroundColor: "transparent" },
  scroll: { flex: 1, backgroundColor: "transparent" },
  scrollContent: { flexGrow: 1, padding: 16 },

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

  reviewBannerText: {
    color: "rgba(231,238,247,.88)",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "right",
    flex: 1,
  },

  sectionCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 6,
  },

  stepPills: {
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
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

  stepPillOn: { backgroundColor: "rgba(212,175,55,.12)", borderColor: "rgba(212,175,55,.28)" },
  stepPillText: { color: "rgba(231,238,247,.85)", fontWeight: "800", fontSize: 11, textAlign: "center" },

  h1: { color: palette.text, fontWeight: "900", fontSize: 16, textAlign: "center", lineHeight: 22 },
  p: { color: "rgba(231,238,247,.78)", marginTop: 8, textAlign: "right", lineHeight: 20, fontSize: 12 },
  small: { color: "rgba(231,238,247,.70)", fontSize: 11, textAlign: "right", lineHeight: 18 },
  warn: { color: "rgba(252,165,165,.95)", fontWeight: "800", fontSize: 11, textAlign: "right" },

  noteTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right", lineHeight: 18 },

  noteCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 16,
    padding: 12,
  },

  choiceCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 16,
    padding: 12,
  },

  choiceCardOn: { borderColor: "rgba(34,197,94,.35)", backgroundColor: "rgba(34,197,94,.06)" },

  choiceText: {
    color: palette.text,
    fontWeight: "800",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 18,
    flex: 1,
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    color: palette.text,
    textAlign: "right",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 18,
  },

  inputMultiline: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
    color: palette.text,
    textAlign: "right",
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 84,
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

  bootText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "center" },

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