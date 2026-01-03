// app/pelekan/bastan/subtask/CR_2_do_ritual.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    InteractionManager,
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
  if (k === "CR_2_do_ritual") return "ریز اقدام دوم";
  return "ریز اقدام";
}

/* ----------------------------- Types ----------------------------- */

type ModalKind = "info" | "warn" | "error" | "success";

type RitualKey =
  | "walk_close"
  | "shower_close"
  | "sunrise_sunset_close"
  | "letter_close"
  | "symbolic_grave_close";

type CR1Saved = {
  version: 1;
  savedAt: string;
  ritualKey: RitualKey;
  ritualTitle: string;
  ritualSubtitle: string;
  plannedWhenText: string;
  plannedWhereText: string;
  prepText?: string | null;
  commitmentText: string;
  agreeLocked: boolean;
  durationSec?: number | null;
};

type ChecklistItem = { id: string; text: string; help?: string | null };

type CR2Saved = {
  version: 1;
  savedAt: string;

  ritual: {
    key: RitualKey;
    title: string;
    subtitle: string;
  };

  plan: {
    whenText: string;
    whereText: string;
    prepText?: string | null;
  };

  // step2
  ritualChecklistDoneIds: string[];

  // step3
  stabilizeDoneIds: string[];

  // step4
  lockDoneIds: string[];
  nextActionText: string;

  agreeLocked: boolean;
  durationSec?: number | null;
};

/* ----------------------------- Storage Keys ----------------------------- */

const SUBTASK_KEY = "CR_2_do_ritual";
const KEY_CR1_FINAL = `pelekan:bastan:subtask:CR_1_choose_ritual:final:v1`;
const KEY_CR2_FINAL = `pelekan:bastan:subtask:${SUBTASK_KEY}:final:v1`;
const KEY_BASTAN_DIRTY = "pelekan:bastan:dirty:v1";

/* ----------------------------- Checklists ----------------------------- */

const RITUAL_CHECKLISTS: Record<RitualKey, ChecklistItem[]> = {
  walk_close: [
    { id: "w1", text: "یه مسیر امن و آروم انتخاب کن که بتونی بیست دقیقه بدون مشکل داخلش پیاده‌روی کنی" },
    { id: "w2", text: "گوشیت رو بذار روو حالت سایلنت یا خاموشش کن که کسی مزاحم آیین بستن تو نشه" },
    { id: "w3", text: "پیاده‌روی رو شروع کن و پنج دقیقه به چیزی فکر نکن و فقط به مناظر و مسیر نگاه کن و همزمان نفس عمیق بکش (نفس عمیق خیلی مهمه پس انجامش بده)" },
    {
      id: "w4",
      text: "شروع کن به رابطه تموم شده خودت، فکر کن و مسیر رابطه رو از اول  تا آخرش مرور کن",
      help: "مثلاً: «چجوری شروع شد، چه اتفاقاتی افتاد، چرا تموم شد، چرا باید تموم میشد، درس‌هایی که گرفتی و همه موارد دیگه رو مرور کن.»",
    },
    {
      id: "w5",
      text: "بعد از مرور، جملات بستن رابطه رو به خودت بگو حتی اگه برات سخته، تکرارشون کن ", 
      help: "مثلاً: «این رابطه برای همیشه تموم شد و فصل جدیدی از زندگی من شروع شد، من از خودم مراقبت می‌کنم و زندگی رو ادامه میدم.»",
    },
    {
      id: "w6",
      text: "اگه نیاز به تخلیه هیجانی داشتی انجامش بده و بعد دوباره جملات بستن رو تکرار کن", 
      help: "مثلاً: «اگه گریت گرفت گریه کن یا اگه عصبانی شدی با تمام وجود چندبار داد بزن.»",
    },
    {
      id: "w7",
      text: "بعد از تکرار جملات بستن، دوباره به مدت پنج دقیقه پیاده‌روی رو ادامه بده، به مسیر نگاه کن و از مناظر لذت ببر و حتما همزمان نفس عمیق بکش", 
    },
    {
      id: "w8",
      text: "بعد از اینکار برو و یک کار لذت‌بخش برای خودت انجام بده که شروع فصل جدید زندگیت رو جشن بگیری؛ حتی اگه حالت خیلی خوب نیست اجازه بده یکم بهتر بشی و بعد برو انجامش بده", 
      help: "مثلاً: «برو یک لیوان چایی بخور، یه بستنی بخور، سوار تاب شو، از خودت یک عکس بگیر یا هر کار دیگه‌ای که برات لذت بخشه.»", 
    },
    {
      id: "w9",
      text: "بعد از انجام کار لذت بخش، برگرد به اپ و مراحل سوم و چهارم رو انجام بده", 
    },
  ],

  shower_close: [
    { id: "s1", text: "وسایل دوش، شست‌وشو و لباس موردعلاقت رو آماده کن" },
    { id: "s2", text: "لباس خودت رو دربیار و به شکل کاملا عریان برو زیر آب" },
    {
      id: "s3",
      text: "دو دقیقه بدون فکر کردن به چیزی، زیر آب بمون و بدن خودت رو لمس کن و جریان قطرات آب روی بدنت رو حس کن",
    },
    {
      id: "s4",
      text: "حالا زیرآب شروع کن به رابطه تموم شده خودت، فکر کن و مسیر رابطه رو از اول  تا آخرش مرور کن",
      help: "مثلاً: «چجوری شروع شد، چه اتفاقاتی افتاد، چرا تموم شد، چرا باید تموم میشد، درس‌هایی که گرفتی و همه موارد دیگه رو مرور کن.»",
    },
    {
      id: "s5",
      text: "بعد از مرور، همچنان زیر آب جملات بستن رابطه رو به خودت بگو حتی اگه برات سخته، تکرارشون کن ", 
      help: "مثلاً: «این رابطه برای همیشه تموم شد و فصل جدیدی از زندگی من شروع شد، من از خودم مراقبت می‌کنم و زندگی رو ادامه میدم.»",
    },
    {
      id: "s6",
      text: "اگه نیاز به تخلیه هیجانی داشتی انجامش بده و بعد دوباره جملات بستن رو تکرار کن", 
      help: "مثلاً: «اگه گریت گرفت گریه کن یا اگه عصبانی شدی با تمام وجود چندبار داد بزن.»",
    },
    {
      id: "s7",
      text: "بعد از تکرار جملات بستن، دوباره به مدت پنج دقیقه موندن زیر آب رو ادامه بده، جریان قطرات آب روی بدنت رو حس کن و حتما همزمان نفس عمیق بکش", 
    },
    {
      id: "s8",
      text: "بعد از اینکار بدنت رو خشک کن لباس مورد علاقت رو بپوش و یک کار لذت‌بخش برای خودت انجام بده که شروع فصل جدید زندگیت رو جشن بگیری؛ حتی اگه حالت خیلی خوب نیست اجازه بده یکم بهتر بشی و بعد برو انجامش بده", 
      help: "مثلاً: «برو یک لیوان چایی بخور، یه بستنی بخور، از خودت یک عکس بگیر یا هر کار دیگه‌ای که برات لذت بخشه.»", 
    },
    {
      id: "s9",
      text: "بعد از انجام کار لذت بخش، برگرد به اپ و مراحل سوم و چهارم رو انجام بده", 
    },
  ],

  sunrise_sunset_close: [
    { id: "ss1", text: "یه مکان مشخص انتخاب کن که بتونی طلوع آفتاب رو به شکل واضح ببینی مثل بالای پشت بوم یا یک بلند با زاویه دید باز" },
    { id: "ss2", text: "حداقل بیست دقیقه قبل از طلوع یا غروب آفتاب به اون مکان برو و گوشیت رو خاموش کن  یا اون رو در حالت سکوت قرار بده" },
    {
      id: "ss3",
      text: "به افق نگاه کن و آفتاب در حال طلوع یا غروب رو نگاه کن و همزمان به مدت پنج دقیقه نفس عمیق بکش و از منظره لذت ببر",
    },
    {
      id: "ss4",
      text: "حالا همزمان با نگاه کردن به افق شروع کن به رابطه تموم شده خودت، فکر کن و مسیر رابطه رو از اول  تا آخرش مرور کن",
      help: "مثلاً: «چجوری شروع شد، چه اتفاقاتی افتاد، چرا تموم شد، چرا باید تموم میشد، درس‌هایی که گرفتی و همه موارد دیگه رو مرور کن.»",
    },
    {
      id: "ss5",
      text: "بعد از مرور، جملات بستن رابطه رو به خودت بگو حتی اگه برات سخته، تکرارشون کن ", 
      help: "مثلاً: «این رابطه برای همیشه تموم شد و فصل جدیدی از زندگی من شروع شد، من از خودم مراقبت می‌کنم و زندگی رو ادامه میدم.»",
    },
    {
      id: "ss6",
      text: "اگه نیاز به تخلیه هیجانی داشتی انجامش بده و بعد دوباره جملات بستن رو تکرار کن", 
      help: "مثلاً: «اگه گریت گرفت گریه کن یا اگه عصبانی شدی با تمام وجود چندبار داد بزن.»",
    },
    {
      id: "ss7",
      text: "بعد از تکرار جملات بستن، دوباره به مدت پنج دقیقه نگاه کردن به افق رو ادامه بده، از منظره لذت ببر و حتما همزمان نفس عمیق بکش", 
    },
    {
      id: "ss8",
      text: "بعد از اینکار اون مکان رو ترک کن و برو یک کار لذت‌بخش برای خودت انجام بده که شروع فصل جدید زندگیت رو جشن بگیری؛ حتی اگه حالت خیلی خوب نیست اجازه بده یکم بهتر بشی و بعد برو انجامش بده", 
      help: "مثلاً: «برو یک لیوان چایی بخور، یه بستنی بخور، از خودت یک عکس بگیر یا هر کار دیگه‌ای که برات لذت بخشه.»", 
    },
    {
      id: "ss9",
      text: "بعد از انجام کار لذت بخش، برگرد به اپ و مراحل سوم و چهارم رو انجام بده", 
    },
  ],

  letter_close: [
    { id: "l1", text: "قلم و کاغذ آماده کن و گوشیت رو خاموش کن یا اون رو روی حالت سکوت قرار بده" },
    {
      id: "l2",
      text: "چشمات رو ببند و پنج دقیقه نفس عمیق بکش",
      help: "قرار نیست قشنگ بنویسی یا درست بنویسی فقط واضح بنویس.",
    },
    { id: "l3", 
      text: "شروع کن به نوشتن نامه",
      help: "قرار نیست قشنگ بنویسی یا درست بنویسی فقط واضح بنویس که  رابطت چجوری شروع شد، چه اتفاقاتی افتاد،چرا تموم شد، چرا باید تموم میشد، چه درس‌هایی گرفتی و میخوای بعد از این رابطه به چه اهدافی برسی.",
    },
       {
      id: "l4",
      text: "اگه حین نوشتن نامه، نیاز به تخلیه هیجانی داشتی انجامش بده", 
      help: "مثلاً: «اگه گریت گرفت گریه کن یا اگه عصبانی شدی با تمام وجود چندبار داد بزن.»",
    },
    { id: "l4", text: "بعد از نوشتن نامه اون رو تا کن و پارش کن" },
    {
      id: "l5",
      text: "بعد از پاره کردن نامه، جملات بستن رابطه رو به خودت بگو حتی اگه برات سخته، تکرارشون کن ", 
      help: "مثلاً: «این رابطه برای همیشه تموم شد و فصل جدیدی از زندگی من شروع شد، من از خودم مراقبت می‌کنم و زندگی رو ادامه میدم.»",
    },
     {
      id: "l6",
      text: "بعد از تکرار جملات بستن، دوباره به مدت پنج دقیقه چشمات رو بیند و حتما همزمان نفس عمیق بکش", 
    },
    {
      id: "l7",
      text: "بعد از اینکار برو یک کار لذت‌بخش برای خودت انجام بده که شروع فصل جدید زندگیت رو جشن بگیری؛ حتی اگه حالت خیلی خوب نیست اجازه بده یکم بهتر بشی و بعد برو انجامش بده", 
      help: "مثلاً: «برو یک لیوان چایی بخور، یه بستنی بخور، از خودت یک عکس بگیر یا هر کار دیگه‌ای که برات لذت بخشه.»", 
    },
    {
      id: "l8",
      text: "بعد از انجام کار لذت بخش، برگرد به اپ و مراحل سوم و چهارم رو انجام بده", 
    },
  ],

  symbolic_grave_close: [
    { id: "g1", text: "یه نماد کوچیک برای دفن کردن انتخاب کن (مثل سنگ، کاغذ یا شاخه کوچیک)" },
    { id: "g2", text: "یه جای امن برای دفن کردن اون نماد پیدا کن (مثل باغچه یا پارک نزدیک خونه)" },
    {
      id: "g3",
      text: "به همراه اون نماد و یک وسیله کندن مثل قاشق یا بیلچه، به اون مکان امن برو",
    },
    { id: "g4", text: "در اون مکان امن پنج دقیقه به اطرافت نگاه کن و از منظره لذت ببر و همزمان نفس عمیق بکش" },
    { id: "g5", text: "به اندازه کف دست جایی که میشناسی رو با اون وسیله کندن بکن و اون نماد رو داخل اون چاله بنداز ولی دفنش نکن" },
    {
      id: "g6",
      text: "حالا همزمان با نگاه کردن به اون نماد شروع کن به رابطه تموم شده خودت، فکر کن و مسیر رابطه رو از اول  تا آخرش مرور کن",
      help: "مثلاً: «چجوری شروع شد، چه اتفاقاتی افتاد، چرا تموم شد، چرا باید تموم میشد، درس‌هایی که گرفتی و همه موارد دیگه رو مرور کن.»",
    },
    {
      id: "g7",
      text: "بعد از مرور، جملات بستن رابطه رو به خودت بگو حتی اگه برات سخته، تکرارشون کن ", 
      help: "مثلاً: «این رابطه برای همیشه تموم شد و فصل جدیدی از زندگی من شروع شد، من از خودم مراقبت می‌کنم و زندگی رو ادامه میدم.»",
    },
    {
      id: "g8",
      text: "اگه نیاز به تخلیه هیجانی داشتی انجامش بده و بعد دوباره جملات بستن رو تکرار کن", 
      help: "مثلاً: «اگه گریت گرفت گریه کن یا اگه عصبانی شدی با تمام وجود چندبار داد بزن.»",
    },
    {
      id: "g9",
      text: "بعد از تکرار جملات بستن، اون نماد رو دفن کن و روش خاک بریز و بعد دوباره به مدت پنج دقیقه به مناظر اطراف نگاه کن و ازشون لذت ببر و حتما همزمان نفس عمیق بکش", 
    },
    {
      id: "g10",
      text: "بعد از اینکار اون مکان رو ترک کن و برو یک کار لذت‌بخش برای خودت انجام بده که شروع فصل جدید زندگیت رو جشن بگیری؛ حتی اگه حالت خیلی خوب نیست اجازه بده یکم بهتر بشی و بعد برو انجامش بده", 
      help: "مثلاً: «برو یک لیوان چایی بخور، یه بستنی بخور، از خودت یک عکس بگیر یا هر کار دیگه‌ای که برات لذت بخشه.»", 
    },
    {
      id: "g11",
      text: "بعد از انجام کار لذت بخش، برگرد به اپ و مراحل سوم و چهارم رو انجام بده", 
    },
  ],
};

const STABILIZE_CHECKLIST: ChecklistItem[] = [
  { id: "st1", text: "آیین بستن رو به طور کامل انجام دادم" },
  {
    id: "st2",
    text: "هر حسی الان دارم می‌پذیرمش",
    help: "غم، خالی بودن، سبک شدن، شک و تردبد، حسرت، تناقض، خوشحالی و سبک شدن همشون طبیعی‌هستن.",
  },
  {
    id: "st3",
    text: "این جمله رو به خودم گفتم: «حسم ممکنه عوض شه، ولی تصمیمم عوض نمی‌شه»",
  },
  { id: "st4", text: "می‌دونم مغزم ممکنه مقاومت کنه و این نشونه طبیعی بودن رونده" },
];

const LOCK_CHECKLIST: ChecklistItem[] = [
  { id: "lk1", text: "می‌دونم معمولاً کئ وسوسه می‌شم و برای اون مواقع برنامه دارم" },
  { id: "lk2", text: "قبول دارم گفتن «فقط یه بار دیگه»، معمولاً دروغ مغزه" },
  { id: "lk3", text: "تعهد می‌دم: هیچ تماس، پیام یا چک‌کردنی انجام ندم" },
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

export default function CR2DoRitualScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerNo = subtaskNumberFa(SUBTASK_KEY);
  const title = "انجام آیین بستن";

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

  // Loaded from CR1 (plan)
  const [cr1, setCr1] = useState<CR1Saved | null>(null);

  // Step 2
  const [ritualChecklistDoneIds, setRitualChecklistDoneIds] = useState<string[]>([]);

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

  /* ----------------------------- Helpers ----------------------------- */

  const ritualKey: RitualKey | null = useMemo(() => {
    const k = (cr1 as any)?.ritualKey;
    return (k ? String(k) : "") as any;
  }, [cr1]);

  const ritualInfo = useMemo(() => {
    if (!cr1) return null;
    return {
      key: cr1.ritualKey,
      title: cr1.ritualTitle,
      subtitle: cr1.ritualSubtitle,
    };
  }, [cr1]);

  const ritualChecklist = useMemo(() => {
    if (!ritualKey) return [];
    return RITUAL_CHECKLISTS[ritualKey] || [];
  }, [ritualKey]);

  const cleanedNextAction = useMemo(() => String(nextActionText || "").trim(), [nextActionText]);

  const toggleId = useCallback(
    (list: "ritual" | "stabilize" | "lock", id: string) => {
      if (isReview) return;

      const setter =
        list === "ritual"
          ? setRitualChecklistDoneIds
          : list === "stabilize"
          ? setStabilizeDoneIds
          : setLockDoneIds;

      setter((prev) => {
        const has = prev.includes(id);
        if (has) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    },
    [isReview]
  );

  const step1Ok = !!cr1; // باید ریزاقدام اول وجود داشته باشه
  const step2Ok = ritualChecklist.length > 0 && ritualChecklistDoneIds.length === ritualChecklist.length;
  const step3Ok = stabilizeDoneIds.length === STABILIZE_CHECKLIST.length;
  const step4Ok =
    lockDoneIds.length === LOCK_CHECKLIST.length && cleanedNextAction.length >= 3;

  const canGo2 = step1Ok;
  const canGo3 = step1Ok && step2Ok;
  const canGo4 = step1Ok && step2Ok && step3Ok;
  const canFinalize = step1Ok && step2Ok && step3Ok && step4Ok;

  /* ----------------------------- Load CR1 + CR2 FINAL ----------------------------- */

  const loadCR1IfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR1_FINAL);
    if (!raw) return null;
    try {
      const j = JSON.parse(raw) as CR1Saved;
      if (!j || j.version !== 1) return null;
      return j;
    } catch {
      return null;
    }
  }, []);

  const loadFinalIfAny = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEY_CR2_FINAL);
    if (!raw) return { loaded: false as const };

    const j = JSON.parse(raw) as CR2Saved;
    if (!j || j.version !== 1) return { loaded: false as const };

    // CR1 snapshot from saved
    setCr1({
      version: 1,
      savedAt: j.savedAt,
      ritualKey: j.ritual.key,
      ritualTitle: j.ritual.title,
      ritualSubtitle: j.ritual.subtitle,
      plannedWhenText: j.plan.whenText,
      plannedWhereText: j.plan.whereText,
      prepText: j.plan.prepText ?? null,
      commitmentText: "", // CR1 commitment not needed here
      agreeLocked: true,
      durationSec: null,
    });

    setRitualChecklistDoneIds(Array.isArray(j.ritualChecklistDoneIds) ? j.ritualChecklistDoneIds : []);
    setStabilizeDoneIds(Array.isArray(j.stabilizeDoneIds) ? j.stabilizeDoneIds : []);
    setLockDoneIds(Array.isArray(j.lockDoneIds) ? j.lockDoneIds : []);
    setNextActionText(String(j.nextActionText || ""));

    return { loaded: true as const };
  }, []);

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

        // if not loaded, we need CR1
        const c1 = await loadCR1IfAny();
        if (!alive) return;

        if (!c1) {
          setCr1(null);
          openModal({
            kind: "warn",
            title: "اول باید انتخاب آیین انجام بشه",
            message: "برای این ریزاقدام، لازم است ابتدا «انتخاب آیین بستن» را روی همین دستگاه ثبت کرده باشی.",
            primaryText: "برگرد",
            onPrimary: () => {
              closeModal();
              router.back();
            },
          });
          return;
        }

        setCr1(c1);
        setIsReview(false);
        setStep(1);
      } catch {
        // fallback
        setIsReview(false);
      } finally {
        if (alive) setBooting(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [closeModal, loadCR1IfAny, loadFinalIfAny, openModal, router]);

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
    if (!cr1 || !ritualInfo) return;

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payload: CR2Saved = {
      version: 1,
      savedAt: new Date().toISOString(),

      ritual: {
        key: ritualInfo.key,
        title: ritualInfo.title,
        subtitle: ritualInfo.subtitle,
      },

      plan: {
        whenText: String(cr1.plannedWhenText || "").trim(),
        whereText: String(cr1.plannedWhereText || "").trim(),
        prepText: String(cr1.prepText || "").trim() ? String(cr1.prepText || "").trim() : null,
      },

      ritualChecklistDoneIds: ritualChecklistDoneIds || [],
      stabilizeDoneIds: stabilizeDoneIds || [],
      lockDoneIds: lockDoneIds || [],
      nextActionText: cleanedNextAction,

      agreeLocked: true,
      durationSec,
    };

    await AsyncStorage.setItem(KEY_CR2_FINAL, JSON.stringify(payload));
    await AsyncStorage.setItem(KEY_BASTAN_DIRTY, new Date().toISOString());
  }, [cleanedNextAction, cr1, lockDoneIds, ritualChecklistDoneIds, ritualInfo, stabilizeDoneIds]);

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

    if (!cr1 || !ritualInfo) return "fail";

    const startedAt = startedAtRef.current;
    const durationSec = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;

    const payloadToSend = {
      version: 1,
      savedAt: new Date().toISOString(),
      answer: {
        ritual: {
          key: ritualInfo.key,
          title: ritualInfo.title,
          subtitle: ritualInfo.subtitle,
        },
        plan: {
          whenText: String(cr1.plannedWhenText || "").trim(),
          whereText: String(cr1.plannedWhereText || "").trim(),
          prepText: String(cr1.prepText || "").trim() ? String(cr1.prepText || "").trim() : null,
        },

        step2: {
          checklistTotal: ritualChecklist.length,
          checklistDone: ritualChecklistDoneIds.length,
          doneIds: ritualChecklistDoneIds,
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
          when: String(cr1.plannedWhenText || "").trim(),
          where: String(cr1.plannedWhereText || "").trim(),
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
    closeModal,
    cr1,
    cleanedNextAction,
    lockDoneIds,
    openModal,
    phone,
    ritualChecklist,
    ritualChecklistDoneIds,
    ritualInfo,
    stabilizeDoneIds,
    token,
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
      setStep(4);
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
        <Text style={styles.stepPillText}>۱) شروع</Text>
      </View>
      <View style={[styles.stepPill, step === 2 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۲) انجام</Text>
      </View>
      <View style={[styles.stepPill, step === 3 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۳) ثبت</Text>
      </View>
      <View style={[styles.stepPill, step === 4 && styles.stepPillOn]}>
        <Text style={styles.stepPillText}>۴) قفل</Text>
      </View>
    </View>
  );

  const RitualHeaderCard = (
    <View style={[styles.noteCard, { marginTop: 10 }]}>
      <Text style={styles.noteTitle}>آیین انتخاب‌شده</Text>
      <Text style={styles.small}>
        {ritualInfo ? `${ritualInfo.title}\n${ritualInfo.subtitle}` : "—"}
      </Text>

      <View style={{ height: 10 }} />

      <Text style={styles.noteTitle}>برنامه</Text>
      <Text style={styles.small}>
        • زمان: {String(cr1?.plannedWhenText || "").trim() || "—"}
        {"\n"}• مکان: {String(cr1?.plannedWhereText || "").trim() || "—"}
        {String(cr1?.prepText || "").trim() ? `\n• آماده‌سازی: ${String(cr1?.prepText || "").trim()}` : ""}
      </Text>
    </View>
  );

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
        keyboardVerticalOffset={insets.top + 12}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 18 + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isReview ? (
            <View style={styles.reviewBanner}>
              <Ionicons name="eye" size={16} color="rgba(231,238,247,.88)" />
              <Text style={styles.reviewBannerText}>
                حالت مرور فعال است: می‌تونی مراحل رو ببینی ولی قابل تغییر نیست.
              </Text>
            </View>
          ) : null}

          {StepPills}

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 1 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.h1}>الان وقتشه؛ نه بعداً</Text>
              <Text style={styles.p}>
                بعد از جدایی، مغز با «فهمیدن» جلو نمی‌ره؛ با «ثبت بیرونی» جلو می‌ره.
                {"\n\n"}
                وقتی انجامش رو عقب می‌ندازی، مغزت دوباره می‌ره سمت امید و چک‌کردن و برگشت.
                {"\n"}
                این آیین قرار نیست حالتو به شکل جادویی خوب کنه؛ قراره فقط یه چیز رو قطعی کنه، این که:
                {"\n"}«این فصل از زندگیت بسته شد و فصل جدید آغاز شد.»
              </Text>

              {RitualHeaderCard}

              {!step1Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه، باید ریز اقدام «انتخاب آیین بستن» روی همین دستگاه ثبت شده باشه.
                </Text>
              ) : null}

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
                <Text style={styles.primaryBtnText}>شروع می‌کنم</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 2 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>انجام آیین</Text>
                <Text style={styles.p}>
                  اینجا مراحل آیین انتخابی تو آورده شده که بر اساس اون آیین بستن خودت رو باید انجام بدی؛
                  {"\n"} در ضمن می‌تونی به این مراحل، خودت مرحله دلخواه اضافه کنی
                  {"\n"}
                  یادت باشه لازم نیست «کامل و عالی» باشه؛ فقط لازمه «انجام بشه».
                </Text>       
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {ritualChecklist.map((it) => {
                  const on = ritualChecklistDoneIds.includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleId("ritual", it.id)}
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
                          {it.help ? (
                            <Text style={[styles.small, { flexShrink: 1, marginTop: 6 }]}>{it.help}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!step2Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: همه‌ی موارد این چک‌لیست باید تیک بخوره.
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

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 3 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>ثبت پایان</Text>
                <Text style={styles.p}>
                  بعد از آیین، مغز ممکنه شروع کنه به شک و عقب‌گرد.
                  {"\n"}
                  این مرحله برای اینه که «پایان» رو تو ذهنت تثبیت کنی، نه اینکه تحلیل کنی.
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
                          {it.help ? (
                            <Text style={[styles.small, { flexShrink: 1, marginTop: 6 }]}>{it.help}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {!step3Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ادامه: همه‌ی موارد این چک‌لیست باید تیک بخوره.
                </Text>
              ) : null}

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

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 4 ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.h1}>قفل بازگشت</Text>
                <Text style={styles.p}>
                  بعد از بستن، مغز دنبال یه «سوراخ کوچیک» می‌گرده.
                  {"\n"}
                  این مرحله برای بستن همون سوراخه.
                </Text>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                {LOCK_CHECKLIST.map((it) => {
                  const on = lockDoneIds.includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggleId("lock", it.id)}
                      disabled={isReview}
                      style={[
                        styles.choiceCard,
                        on && styles.choiceCardOn,
                        isReview && { opacity: 0.7 },
                        it.id === "lk3" && { backgroundColor: "rgba(252,165,165,.04)", borderColor: "rgba(252,165,165,.18)" },
                        it.id === "lk4" && { backgroundColor: "rgba(212,175,55,.06)", borderColor: "rgba(212,175,55,.18)" },
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
                          {it.help ? (
                            <Text style={[styles.small, { flexShrink: 1, marginTop: 6 }]}>{it.help}</Text>
                          ) : null}
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
                  {"\n"}مثال: «می‌رم آب می‌خورم»، «۱۰ دقیقه قدم می‌زنم»، «به یه آدم امن زنگ می‌زنم»،«یه فیلم قشنگ می‌بینم»، «می‌خوابم»
                </Text>

                <View style={{ height: 10 }} />
                <TextInput
                  editable={!isReview}
                  value={nextActionText}
                  onChangeText={(t) => (isReview ? null : setNextActionText(t))}
                  placeholder="کار مشخص من…"
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, isReview && { opacity: 0.7 }]}
                />
              </View>

              {!step4Ok ? (
                <Text style={[styles.warn, { marginTop: 10 }]}>
                  برای ثبت: همه تیک‌ها + یک کار مشخص لازمه.
                </Text>
              ) : null}

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
                    onPress={onFinishPress}
                    style={[styles.primaryBtn, { flex: 1 }, (saving || (!isReview && !canFinalize)) && { opacity: 0.45 }]}
                  >
                    <Text style={styles.primaryBtnText}>{saving ? "در حال انجام…" : isReview ? "خروج" : "ثبت و پایان"}</Text>
                  </TouchableOpacity>
                </View>

                {!isReview && !canFinalize ? <Text style={styles.warn}>قبل از ثبت، همه مراحل باید کامل بشه.</Text> : null}
                {isReview ? <Text style={styles.small}>در حالت مرور، فقط نمایش است و امکان ادیت نداری.</Text> : null}
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