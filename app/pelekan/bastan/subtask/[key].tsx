// app/pelekan/bastan/subtask/[key].tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  if (k === "RC_1_red_flags") return "ریز‌اقدام اول";
  return "ریز‌اقدام";
}

type RC1Saved = {
  version: 1;
  savedAt: string; // ISO
  selected: string[]; // ids of items
  top3: string[]; // 3 selected ids
  notes: Record<string, string>; // id -> note
};

type FlagItem = { id: string; text: string };

const KEY_RC1 = "pelekan:bastan:subtask:RC_1_red_flags:v1";

// ✅ لیست ۴۰تایی دقیقا همان‌هایی که دادی
const RC1_FLAGS: FlagItem[] = [
  { id: "rc1_01", text: "احساس می‌کردم باید خودم را سانسور کنم تا دعوا نشود." },
  { id: "rc1_02", text: "ناراحتی‌هایم جدی گرفته نمی‌شد یا کوچک شمرده می‌شد." },
  { id: "rc1_03", text: "وقتی اعتراض می‌کردم، متهم می‌شدم که «حساسم» یا «زیادی فکر می‌کنم»." },
  { id: "rc1_04", text: "برای آرام نگه‌داشتن رابطه، از خواسته‌هایم می‌گذشتم." },
  { id: "rc1_05", text: "احساس گناه دائمی بابت ناراحت شدن داشتم." },
  { id: "rc1_06", text: "عذرخواهی‌ها بیشتر از سمت من بود، حتی وقتی مقصر نبودم." },
  { id: "rc1_07", text: "مدام نگران واکنش او به حرف‌ها یا احساساتم بودم." },
  { id: "rc1_08", text: "احساس می‌کردم باید حال او را مدیریت کنم." },
  { id: "rc1_09", text: "بعد از صحبت‌ها، بیشتر گیج می‌شدم تا آرام." },
  { id: "rc1_10", text: "حس می‌کردم «خودِ واقعی‌ام» در رابطه جا ندارد." },
  { id: "rc1_11", text: "تصمیم‌های مهم بیشتر یک‌طرفه گرفته می‌شد." },
  { id: "rc1_12", text: "استقلال من (دوست‌ها، کار، علایق) تهدید تلقی می‌شد." },
  { id: "rc1_13", text: "تماس‌ها یا پیام‌هایم چک می‌شد یا بابتشان بازخواست می‌شدم." },
  { id: "rc1_14", text: "سکوت یا قهر به‌عنوان تنبیه استفاده می‌شد." },
  { id: "rc1_15", text: "احساس می‌کردم باید ثابت کنم «وفادارم»." },
  { id: "rc1_16", text: "تحقیر کلامی، طعنه یا شوخی‌های آزاردهنده وجود داشت." },
  { id: "rc1_17", text: "اختلاف‌ها به تهدید ختم می‌شد (ترک کردن، بی‌محلی، حذف)." },
  { id: "rc1_18", text: "نظر من فقط وقتی پذیرفته می‌شد که مطابق خواست او بود." },
  { id: "rc1_19", text: "احساس می‌کردم قدرت رابطه متوازن نیست." },
  { id: "rc1_20", text: "بیشتر می‌ترسیدم تا احساس امنیت کنم." },
  { id: "rc1_21", text: "خواسته‌ها یا مرزهای جنسی من نادیده گرفته می‌شد." },
  { id: "rc1_22", text: "احساس فشار برای رابطه‌ی جنسی داشتم." },
  { id: "rc1_23", text: "نه گفتن من با دلخوری، قهر یا فاصله پاسخ داده می‌شد." },
  { id: "rc1_24", text: "صمیمیت فقط وقتی بود که او می‌خواست." },
  { id: "rc1_25", text: "بعد از صمیمیت، احساس نزدیکی عاطفی نمی‌کردم." },
  { id: "rc1_26", text: "صمیمیت جای گفت‌وگوهای حل‌نشده را پر می‌کرد." },
  { id: "rc1_27", text: "بدن یا تمایلات من مقایسه می‌شد." },
  { id: "rc1_28", text: "احساس می‌کردم وسیله‌ی حفظ رابطه هستم نه شریک آن." },
  { id: "rc1_29", text: "صمیمیت به ابزار کنترل تبدیل شده بود." },
  { id: "rc1_30", text: "درباره‌ی مسائل جنسی نمی‌توانستم آزادانه حرف بزنم." },
  { id: "rc1_31", text: "مسائل مالی شفاف نبود." },
  { id: "rc1_32", text: "خرج‌ها یا تصمیم‌های مالی پنهان می‌شد." },
  { id: "rc1_33", text: "احساس بدهکاری عاطفی یا مالی داشتم." },
  { id: "rc1_34", text: "قول‌ها داده می‌شد ولی عملی نمی‌شد." },
  { id: "rc1_35", text: "تناقض بین حرف‌ها و رفتارها وجود داشت." },
  { id: "rc1_36", text: "درباره‌ی ارتباط با دیگران شفافیت نبود." },
  { id: "rc1_37", text: "احساس می‌کردم چیزهایی از من پنهان می‌شود." },
  { id: "rc1_38", text: "به حس درونی‌ام اعتماد نداشتم اما آرامش هم نداشتم." },
  { id: "rc1_39", text: "اعتمادم تدریجی فرسوده شد، نه یک‌باره." },
  { id: "rc1_40", text: "بیشتر امیدوار بودم تغییر کند تا اینکه واقعیت را ببینم." },
];

export default function BastanSubtaskScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const subtaskKey = String((params as any)?.key || "").trim();

  const { me } = useUser();
  const phone = String(me?.phone || "").trim();
  const { token } = useAuth();

  const apiBase = "https://api.qoqnoos.app";

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selected, setSelected] = useState<string[]>([]);
  const [top3, setTop3] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_RC1);
      if (!raw) return;
      const j = JSON.parse(raw) as RC1Saved;
      if (!j || j.version !== 1) return;
      setSelected(Array.isArray(j.selected) ? j.selected : []);
      setTop3(Array.isArray(j.top3) ? j.top3 : []);
      setNotes(j.notes && typeof j.notes === "object" ? j.notes : {});
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (subtaskKey === "RC_1_red_flags") loadLocal();
  }, [subtaskKey, loadLocal]);

  const persistLocal = useCallback(
    async (next?: Partial<RC1Saved>) => {
      const payload: RC1Saved = {
        version: 1,
        savedAt: new Date().toISOString(),
        selected,
        top3,
        notes,
        ...(next || {}),
      };
      await AsyncStorage.setItem(KEY_RC1, JSON.stringify(payload));
    },
    [notes, selected, top3]
  );

  const toggleSelect = useCallback(
    async (idRaw: string) => {
      const id = String(idRaw || "").trim();
      if (!id) return;

      const nextSelected = selectedSet.has(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id];

      const nextTop3 = top3.filter((x) => nextSelected.includes(x));

      const nextNotes = { ...notes };
      for (const k of top3) {
        if (!nextTop3.includes(k)) delete nextNotes[k];
      }

      setSelected(nextSelected);
      setTop3(nextTop3);
      setNotes(nextNotes);

      await AsyncStorage.setItem(
        KEY_RC1,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          selected: nextSelected,
          top3: nextTop3,
          notes: nextNotes,
        } satisfies RC1Saved)
      );
    },
    [notes, selected, selectedSet, top3]
  );

  const toggleTop3 = useCallback(
    async (idRaw: string) => {
      const id = String(idRaw || "").trim();
      if (!id) return;
      if (!selectedSet.has(id)) return;

      let next = [...top3];
      if (next.includes(id)) next = next.filter((x) => x !== id);
      else {
        if (next.length >= 3) return;
        next = [...next, id];
      }

      const nextNotes = { ...notes };
      if (!next.includes(id)) delete nextNotes[id];

      setTop3(next);
      setNotes(nextNotes);
      await persistLocal({ top3: next, notes: nextNotes });
    },
    [notes, persistLocal, selectedSet, top3]
  );

  const setNote = useCallback(
    async (idRaw: string, v: string) => {
      const id = String(idRaw || "").trim();
      const txt = String(v || "");
      const next = { ...notes, [id]: txt };
      setNotes(next);
      await persistLocal({ notes: next });
    },
    [notes, persistLocal]
  );

  const canGoStep2 = selected.length >= 3;
  const canGoStep3 = top3.length === 3;

  const notesOk = useMemo(() => {
    if (top3.length !== 3) return false;
    for (const id of top3) {
      const n = String(notes[id] || "").trim();
      if (n.length < 160) return false;
    }
    return true;
  }, [notes, top3]);

  const completeOnServer = useCallback(async () => {
    const t = String(token || "").trim();
    const p = String(phone || "").trim();
    if (!t || !p) {
      Alert.alert("خطا", "برای ثبت انجام‌شدن باید وارد حساب باشی.");
      return;
    }

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
        subtaskKey: "RC_1_red_flags",
        payload: null, // لوکال است
      }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok) {
      Alert.alert("خطا", String(json?.error || "ثبت انجام‌شدن ناموفق بود"));
      return;
    }

    router.back();
  }, [apiBase, phone, router, token]);

  const onFinish = useCallback(async () => {
    if (!notesOk) return;
    try {
      setSaving(true);
      await persistLocal();
      await completeOnServer();
    } finally {
      setSaving(false);
    }
  }, [completeOnServer, notesOk, persistLocal]);

  // فقط برای RC_1
  if (subtaskKey !== "RC_1_red_flags") {
    return (
      <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>ریز‌اقدام</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {subtaskKey || "—"}
            </Text>
          </View>

          <View style={{ width: 34, height: 34 }} />
        </View>

        {/* Glow */}
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        <View style={styles.center}>
          <Text style={styles.mutedText}>این ریز‌اقدام هنوز طراحی نشده.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const title = "۴۰ نشانه هشداردهنده رابطه‌ات را تیک بزن";
  const headerNo = subtaskNumberFa(subtaskKey);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      {/* Glow */}
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step indicator */}
        <View style={styles.stepPills}>
          <View style={[styles.stepPill, step === 1 && styles.stepPillOn]}>
            <Text style={styles.stepPillText}>۱) انتخاب</Text>
          </View>
          <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
            <Text style={styles.stepPillText}>۲) انتخاب ۳ مورد</Text>
          </View>
          <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
            <Text style={styles.stepPillText}>۳) نوشتن</Text>
          </View>
        </View>

        {step === 1 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>اون چیزی که دیدی رو انکار نکن</Text>
              <Text style={styles.p}>
                هر موردی که در رابطت بوده رو تیک بزن.{"\n"} این‌ها فقط داخل گوشی خودت ذخیره میشن.
                {"\n"}
                برای رفتن به مرحله بعد، حداقل ۳ مورد رو انتخاب کن.
              </Text>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              {RC1_FLAGS.map((it) => {
                const on = selectedSet.has(it.id);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => toggleSelect(it.id)}
                    style={[styles.choiceCard, on && styles.choiceCardOn]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={on ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={styles.choiceText}>{it.text}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 14, gap: 10 }}>
              <Text style={styles.small}>انتخاب‌شده: {selected.length} مورد</Text>

              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!canGoStep2}
                onPress={() => setStep(2)}
                style={[styles.primaryBtn, !canGoStep2 && { opacity: 0.45 }]}
              >
                <Text style={styles.primaryBtnText}>ادامه</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>۳ موردی که بیشترین آسیب رو زد</Text>
              <Text style={styles.p}>فقط از میان موارد تیک‌خورده، دقیقاً ۳ مورد رو انتخاب کن.</Text>
            </View>

            <View style={{ gap: 10, marginTop: 10 }}>
              {selected.map((id) => {
                const it = RC1_FLAGS.find((x) => x.id === id);
                if (!it) return null;
                const on = top3.includes(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleTop3(id)}
                    style={[styles.choiceCard, on && styles.choiceCardOn]}
                  >
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
                      <Ionicons
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={on ? palette.green : "rgba(231,238,247,.55)"}
                      />
                      <Text style={styles.choiceText}>{it.text}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ marginTop: 14, gap: 10 }}>
              <Text style={styles.small}>انتخاب‌شده برای مرحله بعد: {top3.length}/3</Text>

              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setStep(1)}
                  style={[styles.secondaryBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!canGoStep3}
                  onPress={() => setStep(3)}
                  style={[styles.primaryBtn, { flex: 1 }, !canGoStep3 && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>ادامه</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>هر سه رو به شکل واقعی بررسی کن</Text>
              <Text style={styles.p}>
                برای هر مورد حداقل ۱۶۰ کاراکتر بنویس. تا وقتی هر سه کامل نشه، نمیتونی این اقدام رو ثبت کنی.
              </Text>
            </View>

            <View style={{ gap: 12, marginTop: 10 }}>
              {top3.map((id, idx) => {
                const it = RC1_FLAGS.find((x) => x.id === id);
                const val = String(notes[id] || "");
                const len = val.trim().length;

                return (
                  <View key={id} style={styles.noteCard}>
                    <Text style={styles.noteTitle}>
                      {idx + 1}) {it?.text || id}
                    </Text>

                    <TextInput
                      value={val}
                      onChangeText={(t) => setNote(id, t)}
                      placeholder="توضیح بده دقیقاً چه شد، چند بار تکرار شد، و چه اثری روی تو گذاشت…"
                      placeholderTextColor="rgba(231,238,247,.35)"
                      multiline
                      style={styles.input}
                      textAlign="right"
                      textAlignVertical="top"
                    />

                    <Text style={[styles.small, len < 160 ? { color: palette.red } : null]}>
                      {len}/160
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
                >
                  <Text style={styles.secondaryBtnText}>بازگشت</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={!notesOk || saving}
                  onPress={onFinish}
                  style={[styles.primaryBtn, { flex: 1 }, (!notesOk || saving) && { opacity: 0.45 }]}
                >
                  <Text style={styles.primaryBtnText}>{saving ? "در حال ثبت…" : "ثبت و پایان"}</Text>
                </TouchableOpacity>
              </View>

              {!notesOk ? (
                <Text style={styles.warn}>باید برای هر سه مورد حداقل ۱۶۰ کاراکتر بنویسی.</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  // ✅ تم/گلو مثل صفحه اقدام
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mutedText: { color: palette.muted, fontSize: 12, textAlign: "center" },

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

  // ✅ کارت توضیحات بالا هم گلس‌دار
  sectionCard: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 6,
  },

  stepPills: { flexDirection: "row-reverse", gap: 8, justifyContent: "center", marginBottom: 12 },
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
});