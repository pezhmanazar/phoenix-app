// app/pelekan/bastan/subtask/TD_3_places_playlist.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
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
  if (k === "TD_3_places_playlist") return "ریز اقدام سوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */
type ModalKind = "info" | "warn" | "error" | "success";

type WaveKind = "longing" | "anger" | "regret" | "worthless" | "anxiety";
type WaveKindFa = "دلتنگی" | "خشم" | "حسرت" | "بی‌ارزشی" | "اضطراب";

type TriggerItem = {
  title: string; // place / playlist
  intensity: 1 | 2 | 3 | 4 | 5;
  wave: WaveKind;
  afterBehavior: string; // what happens after
};

type CorePlan = {
  label: string; // e.g. "محرک اول"
  fromType: "place" | "playlist";
  index: number; // 0..4
  plan30: string; // 30-sec plan
  envChange: string; // small environmental change
};

type TD3Saved = {
  version: 1;
  savedAt: string;
  acceptedWhy: boolean;

  places: TriggerItem[]; // length 5
  playlists: TriggerItem[]; // length 5

  core: CorePlan[]; // length 3 (selected)
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */
const SUBTASK_KEY = "TD_3_places_playlist";
const KEY_TD3_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Helpers ----------------------------- */
const WAVE_OPTIONS: { key: WaveKind; fa: WaveKindFa }[] = [
  { key: "longing", fa: "دلتنگی" },
  { key: "anger", fa: "خشم" },
  { key: "regret", fa: "حسرت" },
  { key: "worthless", fa: "بی‌ارزشی" },
  { key: "anxiety", fa: "اضطراب" },
];

function waveFa(k: WaveKind): WaveKindFa {
  const x = WAVE_OPTIONS.find((w) => w.key === k);
  return (x?.fa || "دلتنگی") as WaveKindFa;
}

function clampIntensity(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as any;
}

function emptyTrigger(): TriggerItem {
  return { title: "", intensity: 3, wave: "longing", afterBehavior: "" };
}

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
    kind === "success" ? "checkmark-circle" : kind === "warn" ? "warning" : kind === "info" ? "information-circle" : "alert-circle";

  const iconColor =
    kind === "success" ? palette.green : kind === "warn" ? palette.orange : kind === "info" ? "rgba(231,238,247,.85)" : palette.red;

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
export default function TD3PlacesPlaylistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "شناسایی محرک‌های اصلی";

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();
  const apiBase = "https://api.qoqnoos.app";

  // 1..5
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [booting, setBooting] = useState(false);
  const [isReview, setIsReview] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const startedAtRef = useRef<number | null>(null);

  // Step 1
  const [acceptedWhy, setAcceptedWhy] = useState(false);

  // Step 2: places (5)
  const [places, setPlaces] = useState<TriggerItem[]>([emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger()]);

  // Step 3: playlists/media (5)
  const [playlists, setPlaylists] = useState<TriggerItem[]>([emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger()]);

  // Step 4: core triggers (3)
  const [core, setCore] = useState<CorePlan[]>([
    { label: "محرک اول", fromType: "place", index: 0, plan30: "", envChange: "" },
    { label: "محرک دوم", fromType: "place", index: 0, plan30: "", envChange: "" },
    { label: "محرک سوم", fromType: "place", index: 0, plan30: "", envChange: "" },
  ]);

  // Modals
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

  /* ----------------------------- Load FINAL if any ----------------------------- */
  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_TD3_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as TD3Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    setAcceptedWhy(!!j.acceptedWhy);

    const p = Array.isArray(j.places) ? j.places : [];
    const pl = Array.isArray(j.playlists) ? j.playlists : [];
    const c = Array.isArray(j.core) ? j.core : [];

    const normTrig = (arr: any[]): TriggerItem[] =>
      [...arr, emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger(), emptyTrigger()]
        .slice(0, 5)
        .map((x) => ({
          title: String(x?.title || ""),
          intensity: clampIntensity(Number(x?.intensity || 3)),
          wave: (String(x?.wave || "longing") as WaveKind) || "longing",
          afterBehavior: String(x?.afterBehavior || ""),
        }));

    const normCore = (arr: any[]): CorePlan[] =>
      [...arr,
        { label: "محرک اول", fromType: "place", index: 0, plan30: "", envChange: "" },
        { label: "محرک دوم", fromType: "place", index: 0, plan30: "", envChange: "" },
        { label: "محرک سوم", fromType: "place", index: 0, plan30: "", envChange: "" },
      ]
        .slice(0, 3)
        .map((x, i) => ({
          label: String(x?.label || (i === 0 ? "محرک اول" : i === 1 ? "محرک دوم" : "محرک سوم")),
          fromType: (String(x?.fromType || "place") as any) === "playlist" ? "playlist" : "place",
          index: Math.max(0, Math.min(4, Number(x?.index || 0))),
          plan30: String(x?.plan30 || ""),
          envChange: String(x?.envChange || ""),
        }));

    setPlaces(normTrig(p));
    setPlaylists(normTrig(pl));
    setCore(normCore(c));

    return { loaded: true as const };
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setBooting(true);
      try {
        const { loaded } = await loadFinalIfAny();
        if (!alive) return;
        setIsReview(!!loaded);
        if (loaded) setStep(5); // در مرور: مستقیم جمع‌بندی
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

  /* ----------------------------- Form helpers ----------------------------- */
  const trimLen = (s: string) => String(s || "").trim().length;

  const setPlaceTitle = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      setPlaces((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], title: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const setPlaceAfter = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      setPlaces((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], afterBehavior: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const setPlaceWave = useCallback(
    (idx: number, w: WaveKind) => {
      if (isReview) return;
      setPlaces((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], wave: w };
        return next;
      });
    },
    [isReview]
  );

  const setPlaceIntensity = useCallback(
    (idx: number, n: number) => {
      if (isReview) return;
      setPlaces((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], intensity: clampIntensity(n) };
        return next;
      });
    },
    [isReview]
  );

  const setPlayTitle = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      setPlaylists((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], title: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const setPlayAfter = useCallback(
    (idx: number, v: string) => {
      if (isReview) return;
      setPlaylists((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], afterBehavior: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const setPlayWave = useCallback(
    (idx: number, w: WaveKind) => {
      if (isReview) return;
      setPlaylists((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], wave: w };
        return next;
      });
    },
    [isReview]
  );

  const setPlayIntensity = useCallback(
    (idx: number, n: number) => {
      if (isReview) return;
      setPlaylists((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], intensity: clampIntensity(n) };
        return next;
      });
    },
    [isReview]
  );

  const setCoreFromType = useCallback(
    (i: number, v: "place" | "playlist") => {
      if (isReview) return;
      setCore((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], fromType: v, index: 0 };
        return next;
      });
    },
    [isReview]
  );

  const setCoreIndex = useCallback(
    (i: number, idx: number) => {
      if (isReview) return;
      setCore((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], index: Math.max(0, Math.min(4, idx)) };
        return next;
      });
    },
    [isReview]
  );

  const setCorePlan30 = useCallback(
    (i: number, v: string) => {
      if (isReview) return;
      setCore((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], plan30: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const setCoreEnv = useCallback(
    (i: number, v: string) => {
      if (isReview) return;
      setCore((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], envChange: String(v || "") };
        return next;
      });
    },
    [isReview]
  );

  const placesOk = useMemo(() => {
    return places.every((x) => trimLen(x.title) >= 2 && trimLen(x.afterBehavior) >= 3);
  }, [places]);

  const playlistsOk = useMemo(() => {
    return playlists.every((x) => trimLen(x.title) >= 2 && trimLen(x.afterBehavior) >= 3);
  }, [playlists]);

  const coreOk = useMemo(() => {
    // 3 selections must be unique by (fromType,index), and plans must be filled.
    const keys = core.map((c) => `${c.fromType}:${c.index}`);
    const unique = new Set(keys).size === keys.length;
    if (!unique) return false;
    return core.every((c) => trimLen(c.plan30) >= 10 && trimLen(c.envChange) >= 6);
  }, [core]);

  const canGo2 = acceptedWhy;
  const canGo3 = acceptedWhy && placesOk;
  const canGo4 = acceptedWhy && placesOk && playlistsOk;
  const canGo5 = acceptedWhy && placesOk && playlistsOk && coreOk;
  const canFinalize = canGo5;

  const getSelectedTitle = useCallback(
    (fromType: "place" | "playlist", index: number) => {
      const arr = fromType === "place" ? places : playlists;
      const t = String(arr?.[index]?.title || "").trim();
      return t || "—";
    },
    [places, playlists]
  );

  /* ----------------------------- Persist FINAL local ----------------------------- */
  const persistFinalLocal = useCallback(async () => {
    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: TD3Saved = {
      version: 1,
      savedAt: new Date().toISOString(),
      acceptedWhy: true,
      places,
      playlists,
      core,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_TD3_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [core, places, playlists]);

  /* ----------------------------- Server submit (ONLY completion) ----------------------------- */
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

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    // ✅ فقط متادیتا (بدون متن‌های حساس)
    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        acceptedWhy: true,
        placesCount: 5,
        playlistsCount: 5,
        coreCount: 3,
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
  }, [apiBase, closeModal, openModal, phone, token]);

  const doFinalize = useCallback(async () => {
    if (!canFinalize) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      setSaving(true);

      // 1) server
      const r = await completeOnServer();
      if (r === "fail") return;

      // 2) local
      await persistFinalLocal();

      if (r === "already") {
        openModal({
          kind: "info",
          title: "قبلا ثبت شده",
          message: "این ریز اقدام قبلا ثبت شده و نیازی به ثبت دوباره نیست",
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
        message: "این ریز اقدام قفل شد و قابل تغییر نیست",
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
      setStep(5);
    }
  }, [canFinalize, closeModal, completeOnServer, openModal, persistFinalLocal, router]);

  const onFinishPress = useCallback(() => {
    if (isReview) {
      router.back();
      return;
    }
    setConfirmLockModal(true);
  }, [isReview, router]);

  /* ----------------------------- Step Pills ----------------------------- */
  const StepPills = (
    <View style={styles.stepPills}>
      <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۱) منطق</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) مکان‌ها</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) پلی‌لیست</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) سه محرک</Text>
      </View>
      <View style={[styles.stepPill, step === 5 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۵) پایان</Text>
      </View>
    </View>
  );

  const WaveSelector = ({
    value,
    onChange,
    disabled,
  }: {
    value: WaveKind;
    onChange: (v: WaveKind) => void;
    disabled?: boolean;
  }) => {
    return (
      <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {WAVE_OPTIONS.map((w) => {
          const on = value === w.key;
          return (
            <TouchableOpacity
              key={w.key}
              activeOpacity={0.9}
              onPress={() => onChange(w.key)}
              disabled={!!disabled}
              style={[
                styles.pill,
                on && styles.pillOn,
                disabled && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.pillText}>{w.fa}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const IntensitySelector = ({
    value,
    onChange,
    disabled,
  }: {
    value: 1 | 2 | 3 | 4 | 5;
    onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
    disabled?: boolean;
  }) => {
    return (
      <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
        {[5, 4, 3, 2, 1].map((n) => {
          const on = value === n;
          return (
            <TouchableOpacity
              key={n}
              activeOpacity={0.9}
              onPress={() => onChange(n as any)}
              disabled={!!disabled}
              style={[styles.pill, on && styles.pillOn, disabled && { opacity: 0.7 }]}
            >
              <Text style={styles.pillText}>{n}</Text>
            </TouchableOpacity>
          );
        })}
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
          <Text style={styles.headerTitle}>{headerNo}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={insets.top + 12}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>حالت مرور فعال است: می‌تونی مراحل رو ببینی ولی قابل تغییر نیست.</Text>
            </View>
          ) : null}

          {StepPills}

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 1 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>چرا باید محرک‌هات رو بشناسی؟</Text>
                <Text style={styles.p}>
                  بعد از جدایی، وسوسه از «هیچ» شروع نمی‌شه؛ از یک محرک شروع می‌شه.
                  {"\n"}یک کافه، یک مسیر، یک آهنگ، یک کلیپ…
                  {"\n"}و بعد مغز می‌ره سمت همون رفتارهای قدیمی: چک کردن، پیام دادن، برگشتن به چت‌ها.
                  {"\n\n"}هدف این تمرین «حذف زندگی» نیست؛
                  {"\n"}هدف اینه که ۱) محرک‌ها رو دقیق ببینی ۲) برای هر کدوم پلن داشته باشی.
                  {"\n\n"}اگر همین الان تحریک شدی: برو تب «پناه» و تکنیک ضدوسوسه رو انجام بده.
                  {"\n"}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    if (isReview) return;
                    setAcceptedWhy((x) => !x);
                  }}
                  style={[styles.choiceCard, acceptedWhy && styles.choiceCardOn, isReview && { opacity: 0.7 }]}
                  disabled={isReview}
                >
                  <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={acceptedWhy ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={acceptedWhy ? palette.green : "rgba(231,238,247,.55)"}
                    />
                    <Text style={styles.choiceText}>قبول دارم محرک‌ها «دستور» نیستن؛ فقط «موج» می‌سازن و من می‌تونم طبق پلن عمل کنم</Text>
                  </View>
                </TouchableOpacity>

                <View style={{ height: 12 }} />

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGo2}
                  onPress={() => {
                    if (!isReview && !startedAtRef.current) startedAtRef.current = Date.now();
                    setStep(2);
                  }}
                  style={[styles.primaryBtn, !canGo2 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>ادامه</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
{step === 2 ? (
  <>
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>۵ مکان محرک</Text>
      <Text style={styles.p}>
        ۵ جایی رو بنویس که بیشتر از همه موج وسوسه یا ناراحتی می‌سازه.
        {"\n"}برای هر مورد: شدت موج، نوع موج و رفتاری که معمولاً بعدش انجام می‌دی رو مشخص کن.
        {"\n\n"}نکته: لازم نیست داستان بنویسی؛ کوتاه و دقیق.
      </Text>
    </View>

    <View style={{ gap: 12, marginTop: 10 }}>
      {places.map((it, idx) => {
        const titleLen = trimLen(it.title);
        const afterLen = trimLen(it.afterBehavior);

        return (
          <View key={`pl_${idx}`} style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
            <Text style={styles.noteTitle}>{idx + 1}) مکان</Text>

            <TextInput
              value={it.title}
              onChangeText={(t) => setPlaceTitle(idx, t)}
              placeholder={`مثال: کافه...، مسیر... مثل مسیر دانشگاه یا سر کار`}
              placeholderTextColor="rgba(231,238,247,.35)"
              style={[styles.inputOne, isReview && styles.inputReadOnly]}
              textAlign="right"
              editable={!isReview}
              selectTextOnFocus={!isReview}
            />

            <Text style={[styles.small, !isReview && titleLen < 2 ? { color: palette.red } : null]}>
              {isReview ? "ثبت شده" : `${titleLen}/2`}
            </Text>

            {/* ✅ شدت موج - وسط چین */}
            <View style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={[styles.small, { textAlign: "center" }]}>شدت موج (۱ کم تا ۵ شدید):</Text>
            </View>
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <IntensitySelector
                value={it.intensity}
                onChange={(v) => setPlaceIntensity(idx, v)}
                disabled={isReview}
              />
            </View>

            {/* ✅ نوع موج - وسط چین */}
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={[styles.small, { textAlign: "center" }]}>نوع موج:</Text>
            </View>
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <WaveSelector
                value={it.wave}
                onChange={(v) => setPlaceWave(idx, v)}
                disabled={isReview}
              />
            </View>

            <TextInput
              value={it.afterBehavior}
              onChangeText={(t) => setPlaceAfter(idx, t)}
              placeholder="بعدش معمولاً چی کار می‌کنی؟ (مثال: چکش میکنم، بهش پیام می‌دم یا می‌رم تو چت‌های قدیمی…)"
              placeholderTextColor="rgba(231,238,247,.35)"
              style={[styles.inputFinal, isReview && styles.inputReadOnly]}
              textAlign="right"
              textAlignVertical="top"
              editable={!isReview}
              selectTextOnFocus={!isReview}
              multiline
            />

            <Text style={[styles.small, !isReview && afterLen < 3 ? { color: palette.red } : null]}>
              {isReview ? "ثبت شده" : `${afterLen}/3`}
            </Text>
          </View>
        );
      })}
    </View>

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
          style={[styles.primaryBtn, { flex: 1 }, (!canGo3 || saving) && { opacity: 0.45 }]}
          disabled={!canGo3 || saving}
        >
          <Text style={styles.primaryBtnText}>ادامه</Text>
        </TouchableOpacity>
      </View>

      {!canGo3 ? <Text style={styles.warn}>برای رفتن به مرحله بعد، هر ۵ مکان باید کامل باشه (نام + رفتار بعدش).</Text> : null}
    </View>
  </>
) : null}
          {/* ----------------------------- Step 3 ----------------------------- */}
{step === 3 ? (
  <>
    <View style={styles.sectionCard}>
      <Text style={styles.h1}>۵ پلی‌لیست یا رسانه محرک</Text>
      <Text style={styles.p}>
        اینجا منظور فقط آهنگ نیست؛ هر چیزی که تو رو پرت می‌کنه داخل خاطره.
        {"\n"}مثل: پلی‌لیست، یک آهنگ خاص، کلیپ‌ها، آلبوم عکس‌ها، سریال‌های مشترک…
        {"\n\n"}
      </Text>
    </View>

    <View style={{ gap: 12, marginTop: 10 }}>
      {playlists.map((it, idx) => {
        const titleLen = trimLen(it.title);
        const afterLen = trimLen(it.afterBehavior);

        return (
          <View key={`md_${idx}`} style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
            <Text style={styles.noteTitle}>{idx + 1}) پلی‌لیست یا رسانه</Text>

            <TextInput
              value={it.title}
              onChangeText={(t) => setPlayTitle(idx, t)}
              placeholder="مثال: پلی‌لیست تلگرام، یک آهنگ خاص، آلبوم عکس…"
              placeholderTextColor="rgba(231,238,247,.35)"
              style={[styles.inputOne, isReview && styles.inputReadOnly]}
              textAlign="right"
              editable={!isReview}
              selectTextOnFocus={!isReview}
            />

            <Text style={[styles.small, !isReview && titleLen < 2 ? { color: palette.red } : null]}>
              {isReview ? "ثبت شده" : `${titleLen}/2`}
            </Text>

            {/* ✅ شدت موج - وسط چین */}
            <View style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={[styles.small, { textAlign: "center" }]}>
                شدت موج (۱ کم تا ۵ شدید):
              </Text>
            </View>
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <IntensitySelector
                value={it.intensity}
                onChange={(v) => setPlayIntensity(idx, v)}
                disabled={isReview}
              />
            </View>

            {/* ✅ نوع موج - وسط چین */}
            <View style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={[styles.small, { textAlign: "center" }]}>نوع موج:</Text>
            </View>
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <WaveSelector
                value={it.wave}
                onChange={(v) => setPlayWave(idx, v)}
                disabled={isReview}
              />
            </View>

            <TextInput
              value={it.afterBehavior}
              onChangeText={(t) => setPlayAfter(idx, t)}
              placeholder="بعدش معمولاً چی کار می‌کنی؟ (مثال: دوباره می‌رم سراغ چت‌ها، گریه می‌کنم یا باهاش تماس می‌گیرم)"
              placeholderTextColor="rgba(231,238,247,.35)"
              style={[styles.inputFinal, isReview && styles.inputReadOnly]}
              textAlign="right"
              textAlignVertical="top"
              editable={!isReview}
              selectTextOnFocus={!isReview}
              multiline
            />

            <Text style={[styles.small, !isReview && afterLen < 3 ? { color: palette.red } : null]}>
              {isReview ? "ثبت شده" : `${afterLen}/3`}
            </Text>
          </View>
        );
      })}
    </View>

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
          style={[styles.primaryBtn, { flex: 1 }, (!canGo4 || saving) && { opacity: 0.45 }]}
          disabled={!canGo4 || saving}
        >
          <Text style={styles.primaryBtnText}>ادامه</Text>
        </TouchableOpacity>
      </View>

      {!canGo4 ? (
        <Text style={styles.warn}>
          برای رفتن به مرحله بعد، هر ۵ رسانه باید کامل باشه (نام + رفتار بعدش).
        </Text>
      ) : null}
    </View>
  </>
) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>۳ محرک اصلی + پلن ضدوسوسه</Text>
                <Text style={styles.p}>
                  از بین همه موارد، فقط ۳ محرک اصلی رو انتخاب کن.
                  {"\n"}بعد برای هر کدوم:
                  {"\n"}اول یه نقشه اضطراری بچین تا دیگه حالت رو بد نکنه
                  {"\n"}مثلا برای آهنگ بنویس اون آهنگ رو چند بار پشت سرهم گوش میدم یا توو مسیر کار یه آهنگ شاد گوش میدم
                  {"\n\n"} بعدش یه تکنیک آرام‌بخش انجام بده مثلا 90 ثانیه تنفس عمیق یا رفتن به تب "پناهگاه"
                </Text>
              </View>

              <View style={{ gap: 12, marginTop: 10 }}>
                {core.map((c, i) => {
                  const selectedTitle = getSelectedTitle(c.fromType, c.index);
                  const planLen = trimLen(c.plan30);
                  const envLen = trimLen(c.envChange);

                  return (
                    <View key={`core_${i}`} style={[styles.noteCard, isReview && { opacity: 0.95 }]}>
                      <Text style={styles.noteTitle}>{c.label}</Text>

                      <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setCoreFromType(i, "place")}
                          disabled={isReview}
                          style={[styles.pill, c.fromType === "place" && styles.pillOn, isReview && { opacity: 0.7 }]}
                        >
                          <Text style={styles.pillText}>از مکان‌ها</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setCoreFromType(i, "playlist")}
                          disabled={isReview}
                          style={[styles.pill, c.fromType === "playlist" && styles.pillOn, isReview && { opacity: 0.7 }]}
                        >
                          <Text style={styles.pillText}>از پلی‌لیست</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.small, { marginTop: 10 }]}>انتخاب از ۵ مورد:</Text>
                      <View style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {[0, 1, 2, 3, 4].map((idx) => {
                          const on = c.index === idx;
                          return (
                            <TouchableOpacity
                              key={`idx_${i}_${idx}`}
                              activeOpacity={0.9}
                              onPress={() => setCoreIndex(i, idx)}
                              disabled={isReview}
                              style={[styles.pill, on && styles.pillOn, isReview && { opacity: 0.7 }]}
                            >
                              <Text style={styles.pillText}>{idx + 1}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.pairCard}>
                        <Text style={styles.pairLabel}>محرک انتخاب‌شده:</Text>
                        <Text style={styles.pairText}>
                          {c.fromType === "place" ? "مکان" : "پلی‌لیست"} {c.index + 1} — {selectedTitle}
                        </Text>
                        <View style={{ height: 10 }} />
                        <Text style={styles.pairLabel}>شدت موج:</Text>
                        <Text style={styles.pairText}>
                          {c.fromType === "place" ? places[c.index].intensity : playlists[c.index].intensity} / 5 —{" "}
                          {waveFa(c.fromType === "place" ? places[c.index].wave : playlists[c.index].wave)}
                        </Text>
                      </View>

                      <TextInput
                        value={c.plan30}
                        onChangeText={(t) => setCorePlan30(i, t)}
                        placeholder='نقشه اضطراریت رو برای این مورد بنویس '
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        multiline
                      />
                      <Text style={[styles.small, !isReview && planLen < 10 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${planLen}/10`}
                      </Text>

                      <TextInput
                        value={c.envChange}
                        onChangeText={(t) => setCoreEnv(i, t)}
                        placeholder="تکنیک آرام‌بخش خودت رو بنویس"
                        placeholderTextColor="rgba(231,238,247,.35)"
                        style={[styles.inputFinal, isReview && styles.inputReadOnly]}
                        textAlign="right"
                        textAlignVertical="top"
                        editable={!isReview}
                        selectTextOnFocus={!isReview}
                        multiline
                      />
                      <Text style={[styles.small, !isReview && envLen < 6 ? { color: palette.red } : null]}>
                        {isReview ? "ثبت شده" : `${envLen}/6`}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setStep(3)} style={[styles.secondaryBtn, { flex: 1 }]} disabled={saving}>
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(5)}
                    style={[styles.primaryBtn, { flex: 1 }, (!canGo5 || saving) && { opacity: 0.45 }]}
                    disabled={!canGo5 || saving}
                  >
                    <Text style={styles.primaryBtnText}>ادامه</Text>
                  </TouchableOpacity>
                </View>

                {!canGo5 ? <Text style={styles.warn}>برای رفتن به مرحله پایان، ۳ محرک باید یکتا باشند و پلن‌ها کامل باشند.</Text> : null}
              </View>
            </>
          ) : null}

          {/* ----------------------------- Step 5 ----------------------------- */}
          {step === 5 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>پایان</Text>
                <Text style={styles.p}>
                  الان تو «نقشه محرک‌ها» رو داری.
                  {"\n"}از این به بعد هیچ محرکی غافلگیرت نمی‌کنه؛ چون می‌دونی از کجا شروع می‌شه.
                  {"\n\n"}قانون طلایی:
                  {"\n"}محرک یعنی موج و موج به معنی دستور نیست.
                  {"\n\n"}هر وقت تحریک شدی:
                  {"\n"}۱) ۹۰ ثانیه نفس عمیق
                  {"\n"}۲) برو تب «پناه» و تکنیک ضدوسوسه رو انجام بده
                  {"\n"}۳) بعد طبق نقشه اضطراری خودت عمل کن
                </Text>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setStep(4)}
                    style={[styles.secondaryBtn, { flex: 1 }]}
                    disabled={saving}
                  >
                    <Text style={styles.secondaryBtnText}>بازگشت</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={saving || (!isReview && !canFinalize)}
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه مراحل باید کامل شود.</Text> : null}

                {isReview ? (
                  <Text style={styles.small}>
                    نکته: در حالت مرور، می‌تونی با «بازگشت» مراحل ۲ تا ۴ رو ببینی. فقط ادیت قفله.
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
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
        secondaryText="فعلا نه"
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

  stepPills: { flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" },
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

  inputOne: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.18)",
    color: palette.text,
    lineHeight: 18,
    textAlign: "right",
  },
  inputFinal: {
    marginTop: 10,
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
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

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
  },
  pillOn: { backgroundColor: "rgba(212,175,55,.12)", borderColor: "rgba(212,175,55,.28)" },
  pillText: { color: "rgba(231,238,247,.88)", fontWeight: "900", fontSize: 11, textAlign: "center" },

  pairCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(0,0,0,.14)",
    borderRadius: 14,
    padding: 12,
  },
  pairLabel: { color: "rgba(231,238,247,.72)", fontWeight: "900", fontSize: 11, textAlign: "right" },
  pairText: { color: "rgba(231,238,247,.88)", fontWeight: "800", fontSize: 12, textAlign: "right", marginTop: 6, lineHeight: 18 },

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