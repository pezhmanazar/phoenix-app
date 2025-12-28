import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/* ----------------------------- Theme ----------------------------- */
const palette = {
  bg: "#0b0f14",
  text: "#F9FAFB",
  muted: "rgba(231,238,247,.78)",
  border: "rgba(255,255,255,.10)",
  glass: "rgba(255,255,255,.04)",
  glass2: "rgba(3,7,18,.92)",
  gold: "#D4AF37",
  orange: "#E98A15",
  green: "#22C55E",
  red: "#FCA5A5",
};

function faOnlyTitle(raw?: string) {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const parts = s.split("–").map((x) => x.trim());
  if (parts.length >= 2) return parts.slice(1).join(" – ");
  return s.replace(/[A-Za-z]/g, "").replace(/\s{2,}/g, " ").trim() || "—";
}

/* ----------------------------- Data (RC_1) ----------------------------- */
type ChecklistItem = { id: string; text: string };

const RC1_TITLE = "نشانه‌های هشداردهنده‌ی رابطه";
const RC1_ITEMS: ChecklistItem[] = [
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

function storageKeyFor(subtaskKey: string) {
  return `pelekan:bastan:subtask:${subtaskKey}:v1`;
}

/* ----------------------------- Screen ----------------------------- */
export default function BastanSubtaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const subtaskKey = String((params as any)?.key || "").trim();

  const isRC1 = subtaskKey === "RC_1_red_flags";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const title = useMemo(() => {
    if (isRC1) return RC1_TITLE;
    return "ریز‌اقدام";
  }, [isRC1]);

  const subtitle = useMemo(() => {
    if (isRC1) return "هر موردی واقعاً وجود داشت را تیک بزن.";
    return subtaskKey || "—";
  }, [isRC1, subtaskKey]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const key = storageKeyFor(subtaskKey || "unknown");
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.checked) {
          setChecked(parsed.checked || {});
        } else if (parsed && typeof parsed === "object") {
          setChecked(parsed || {});
        }
      } else {
        setChecked({});
      }
    } catch {
      setChecked({});
    } finally {
      setLoading(false);
    }
  }, [subtaskKey]);

  useEffect(() => {
    // فقط برای اطمینان که متن‌ها RTL نمایش داده می‌شن
    // (در اکثر پروژه‌ها RTL global فعال شده، اینجا فقط محافظه‌کارانه است)
    // I18nManager.forceRTL(true);  // ❌ اینو اینجا نزن، ممکنه کل اپ به‌هم بریزه
    load();
  }, [load]);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const save = useCallback(async () => {
    try {
      setSaving(true);
      const key = storageKeyFor(subtaskKey || "unknown");
      const payload = {
        checked,
        updatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } finally {
      setSaving(false);
    }
  }, [checked, subtaskKey]);

  const checkedCount = useMemo(() => {
    return Object.values(checked).filter(Boolean).length;
  }, [checked]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      {/* Header: چسبیده به SafeArea */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-forward" size={20} color={palette.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>

        <View style={{ width: 34, height: 34 }} />
      </View>

      {/* Glow */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.gold} />
          <Text style={styles.mutedText}>در حال آماده‌سازی…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>پیشرفت</Text>
            <Text style={styles.cardMeta}>
              تعداد موارد تیک‌خورده: {checkedCount} از {isRC1 ? RC1_ITEMS.length : 0}
            </Text>
            <Text style={styles.cardHint}>
              این اطلاعات فقط داخل گوشی ذخیره می‌شود و روی سرور ارسال نمی‌شود.
            </Text>
          </View>

          {!isRC1 ? (
            <View style={styles.card}>
              <Text style={styles.placeholder}>این صفحه هنوز برای این ریز‌اقدام طراحی نشده.</Text>
            </View>
          ) : (
            <>
              {RC1_ITEMS.map((it, idx) => {
                const isOn = !!checked[it.id];
                return (
                  <TouchableOpacity
                    key={it.id}
                    activeOpacity={0.9}
                    onPress={() => toggle(it.id)}
                    style={[styles.item, isOn && styles.itemOn]}
                  >
                    <View style={styles.itemRow}>
                      <View style={[styles.check, isOn && styles.checkOn]}>
                        {isOn ? <Ionicons name="checkmark" size={16} color={palette.bg} /> : null}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemText}>
                          {idx + 1}. {it.text}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Save */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={save}
                disabled={saving}
                style={[styles.saveBtn, saving && { opacity: 0.65 }]}
              >
                <Ionicons name={saving ? "time" : "save"} size={18} color={palette.bg} />
                <Text style={styles.saveBtnText}>{saving ? "در حال ذخیره…" : "ذخیره"}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
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
  mutedText: { color: palette.muted, marginTop: 10, fontSize: 12, textAlign: "center" },

  card: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.glass,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: palette.text, fontWeight: "900", fontSize: 13, textAlign: "right" },
  cardMeta: { color: "rgba(231,238,247,.80)", fontSize: 12, marginTop: 8, textAlign: "right" },
  cardHint: {
    color: "rgba(231,238,247,.62)",
    fontSize: 11,
    marginTop: 8,
    textAlign: "right",
    lineHeight: 17,
  },

  placeholder: { color: palette.muted, textAlign: "center", lineHeight: 18 },

  item: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,.03)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  itemOn: {
    borderColor: "rgba(212,175,55,.28)",
    backgroundColor: "rgba(212,175,55,.06)",
  },
  itemRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 },

  check: {
    width: 26,
    height: 26,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(0,0,0,.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkOn: {
    borderColor: "rgba(212,175,55,.35)",
    backgroundColor: "rgba(212,175,55,.92)",
  },

  itemText: {
    color: palette.text,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "right",
  },

  saveBtn: {
    marginTop: 8,
    marginBottom: 6,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.35)",
    backgroundColor: "rgba(212,175,55,.92)",
  },
  saveBtnText: { color: palette.bg, fontWeight: "900", fontSize: 13 },
});