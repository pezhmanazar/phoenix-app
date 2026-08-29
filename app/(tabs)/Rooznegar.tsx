//phoenix-app\app\(tabs)\Rooznegar.tsx
import { Ionicons } from "@expo/vector-icons";
import { toGregorian, toJalaali } from "jalaali-js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { usePhoenix } from "../../hooks/PhoenixContext";

import {
  loadReminders,
  loadToday,
  saveReminders,
  saveToday,
} from "../../lib/storage";

/* +++ NOTIFS: اکسپو نوتیفیکیشن */
import * as Notifications from "expo-notifications";

/* ===================== UI PALETTE (Phoenix dark, consistent with Mashaal) ===================== */
const UI = {
  BG: "#0b0f14",
  BAR: "#030712",
  TEXT: "#F9FAFB",
  MUTED: "rgba(231,238,247,.55)",
  MUTED2: "rgba(231,238,247,.72)",
  CARD: "rgba(255,255,255,.04)",
  CARD2: "rgba(255,255,255,.03)",
  BORDER: "rgba(255,255,255,.08)",
  BORDER2: "rgba(255,255,255,.10)",
  PRIMARY: "#D4AF37",
  DANGER: "#ff6666",
  PLACEHOLDER: "rgba(231,238,247,.40)",
};

/* ---------------- helpers ---------------- */
const toFa = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]);
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const timeLabel = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const uid = () =>
  Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const todayDateKey = () => localDateKey(new Date());

const getItemDateKey = (item: TodayItem) => {
  if (item.scheduledDate) return item.scheduledDate;

  return localDateKey(new Date(item.createdAt));
};

const jalaliShortLabelFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);

  const d = new Date(year, month - 1, day);
  const { jy, jm, jd } = toJalaali(d);

  const months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];

  return `${toFa(jd)} ${months[jm - 1]} ${toFa(jy)}`;
};

/** jalaali-js تابع طول ماه نداره؛ این helper جایگزینه */
const jalaaliMonthLength = (jy: number, jm: number) => {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;

  // Esfand: calculate length by comparing gregorian dates
  const a = toGregorian(jy, 12, 1); // jy/12/01
  const b = toGregorian(jy + 1, 1, 1); // (jy+1)/01/01
  const da = new Date(a.gy, a.gm - 1, a.gd);
  const db = new Date(b.gy, b.gm - 1, b.gd);
  const diffDays = Math.round(
    (db.getTime() - da.getTime()) / (24 * 60 * 60 * 1000),
  );
  return diffDays; // 29 or 30
};

const jalaliLabel = (d: Date) => {
  const { jy, jm, jd } = toJalaali(d);
  const months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];
  const weekdays = [
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
    "شنبه",
  ];
  return `${weekdays[d.getDay()]} ${toFa(jd)} ${months[jm - 1]} ${toFa(jy)}`;
};

type TodayItem = {
  id: string;
  title: string;
  time?: string;
  done: boolean;
  createdAt: number;
  scheduledDate?: string;
  notificationId?: string;
};

type ReminderItem = {
  id: string;
  title: string;
  when: number;
  createdAt: number;
  done?: boolean;
  notificationId?: string;
};

function ThemedAlert({
  visible,
  title,
  message,
  okText = "باشه",
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  okText?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.alertCard,
            { paddingBottom: (insets.bottom || 0) + 12 },
          ]}
        >
          <Text style={styles.alertTitle}>{title}</Text>
          {message ? <Text style={styles.alertMsg}>{message}</Text> : null}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={[styles.btn, styles.btnPrimary]}
          >
            <Text style={styles.btnPrimaryText}>{okText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- tiny UI ---------- */
function ProgressBar({
  value = 0,
  color = UI.PRIMARY,
  track = UI.BORDER,
}: {
  value: number;
  color?: string;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        height: 10,
        borderRadius: 999,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 999,
        }}
      />
    </View>
  );
}

/* ---------- Header (Phoenix style, no badge) ---------- */
function RoozHeader() {
  return (
    <View style={styles.headerBar}>
      {/* عنوان سمت راست */}
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.headerTitle}>روزنگار</Text>
        <Text style={styles.headerSub}>{jalaliLabel(new Date())}</Text>
      </View>

      {/* اکشن ساده سمت چپ (اختیاری / زیبایی) */}
      <View style={{ width: 44, alignItems: "flex-start" }}>
        <View style={styles.headerIconBubble}>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={UI.TEXT}
            style={{ opacity: 0.9 }}
          />
        </View>
      </View>
    </View>
  );
}

/* ---------- Segmented tabs ---------- */
function Segmented({
  tab,
  setTab,
}: {
  tab: "today" | "rem";
  setTab: (t: "today" | "rem") => void;
}) {
  return (
    <View style={styles.segmentWrap}>
      <TouchableOpacity
        onPress={() => setTab("today")}
        activeOpacity={0.85}
        style={[
          styles.segmentBtn,
          tab === "today" ? styles.segmentBtnActive : null,
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            tab === "today" ? styles.segmentTextActive : null,
          ]}
        >
          برنامهٔ امروز
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setTab("rem")}
        activeOpacity={0.85}
        style={[
          styles.segmentBtn,
          tab === "rem" ? styles.segmentBtnActive : null,
        ]}
      >
        <Text
          style={[
            styles.segmentText,
            tab === "rem" ? styles.segmentTextActive : null,
          ]}
        >
          یادآور
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- ProgressCard ---------- */
function ProgressCard({ value }: { value: number }) {
  return (
    <View style={styles.card}>
      <View
        style={{
          flexDirection: "row-reverse",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: UI.TEXT, fontWeight: "900" }}>پیشرفت امروز</Text>
        <Text style={{ color: UI.MUTED, fontWeight: "900" }}>
          {toFa(value)}٪
        </Text>
      </View>
      <ProgressBar value={value} color={UI.PRIMARY} track={UI.BORDER} />
    </View>
  );
}

/* ---------- TodayBlock ---------- */
function TodayBlock({
  rtl,
  items,
  setItems,
  title,
  setTitle,
  time,
  onOpenTime,
  onAdd,
  editingId,
  onEditItem,
  onToggleItem,
  onRemoveItem,
}: {
  rtl: boolean;
  items: TodayItem[];
  setItems: React.Dispatch<React.SetStateAction<TodayItem[]>>;
  title: string;
  setTitle: (s: string) => void;
  time: Date | null;
  onOpenTime: () => void;
  onAdd: () => void;
  editingId: string | null;
  onEditItem: (it: TodayItem) => void;
  onToggleItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.helperText}>برنامه امروزت رو اینجا اضافه کن</Text>

      <View style={{ gap: 8 }}>
        <View style={[styles.inputBox, { height: 46 }]}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="عنوان کار"
            placeholderTextColor={UI.PLACEHOLDER}
            style={{
              color: UI.TEXT,
              textAlign: "right",
              writingDirection: "rtl",
              fontWeight: "800",
            }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <View style={{ flexDirection: "row-reverse", gap: 8 }}>
          <TouchableOpacity
            onPress={onOpenTime}
            activeOpacity={0.85}
            style={[styles.timeBtn, { flex: 1 }]}
          >
            <Text style={{ color: UI.TEXT, fontWeight: "900" }}>
              {time ? toFa(timeLabel(time)) : "ساعت (اختیاری)"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.85}
            style={styles.addBtn}
          >
            {editingId ? (
              <Text style={{ color: "#111827", fontWeight: "900" }}>ذخیره</Text>
            ) : (
              <Ionicons name="add" size={22} color="#111827" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>هنوز کاری در این برنامه ثبت نشده.</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          {items.map((item) => (
            <View key={item.id} style={styles.rowCard}>
              <TouchableOpacity
                onPress={() => onToggleItem(item.id)}
                activeOpacity={0.85}
                style={[
                  styles.checkBox,
                  item.done ? styles.checkBoxDone : null,
                ]}
              >
                {item.done && (
                  <Ionicons name="checkmark" size={14} color="#111827" />
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: UI.TEXT,
                    textAlign: "right",
                    fontWeight: "900",
                    textDecorationLine: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.6 : 1,
                  }}
                  onLongPress={() => onEditItem(item)}
                >
                  {item.title}
                </Text>

                {!item.done && getItemDateKey(item) !== todayDateKey() ? (
                  <Text
                    style={{
                      color: UI.DANGER,
                      fontSize: 11,
                      fontWeight: "800",
                      textAlign: "right",
                      marginTop: 3,
                    }}
                  >
                    انجام‌نشده از{" "}
                    {jalaliShortLabelFromKey(getItemDateKey(item))}
                  </Text>
                ) : null}
              </View>

              {item.time ? (
                <Text
                  style={{
                    color: UI.MUTED,
                    width: 52,
                    textAlign: "center",
                    fontWeight: "900",
                  }}
                >
                  {toFa(item.time)}
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={() => onEditItem(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={18} color={UI.TEXT} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onRemoveItem(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={UI.DANGER} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------- ReminderBlock ---------- */
function ReminderBlock({
  rtl,
  jy,
  jm,
  jd,
  setJy,
  setJm,
  setJd,
  remTitle,
  setRemTitle,
  remTime,
  onOpenDate,
  onOpenTime,
  items,
  setItems,
  onAdd,
  editingId,
  onEditItem,
  onToggleReminder,
  onRemoveReminder,
  onSnoozeReminder,
}: {
  rtl: boolean;
  jy: number;
  jm: number;
  jd: number;
  setJy: (n: number) => void;
  setJm: (n: number) => void;
  setJd: (n: number) => void;
  remTitle: string;
  setRemTitle: (s: string) => void;
  remTime: Date | null;
  onOpenDate: () => void;
  onOpenTime: () => void;
  items: ReminderItem[];
  setItems: React.Dispatch<React.SetStateAction<ReminderItem[]>>;
  onAdd: () => void;
  editingId: string | null;
  onEditItem: (it: ReminderItem) => void;
  onToggleReminder: (id: string) => void;
  onRemoveReminder: (id: string) => void;
  onSnoozeReminder: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.helperText}>
        کارهای مهم خودت رو در روزهای آینده اینجا اضافه کن
      </Text>

      <View style={{ gap: 8 }}>
        <View style={[styles.inputBox, { height: 46 }]}>
          <TextInput
            value={remTitle}
            onChangeText={setRemTitle}
            placeholder="عنوان"
            placeholderTextColor={UI.PLACEHOLDER}
            style={{
              color: UI.TEXT,
              textAlign: "right",
              writingDirection: "rtl",
              fontWeight: "800",
            }}
            blurOnSubmit={false}
            returnKeyType="done"
          />
        </View>

        <View
          style={{ flexDirection: "row-reverse", gap: 8, flexWrap: "wrap" }}
        >
          <TouchableOpacity
            onPress={onOpenDate}
            activeOpacity={0.85}
            style={styles.timeBtn}
          >
            <Text style={{ color: UI.TEXT, fontWeight: "900" }}>
              {toFa(jy)}/{toFa(pad(jm))}/{toFa(pad(jd))}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onOpenTime}
            activeOpacity={0.85}
            style={[styles.timeBtn, { flex: 1 }]}
          >
            <Text style={{ color: UI.TEXT, fontWeight: "900" }}>
              {remTime ? toFa(timeLabel(remTime)) : "انتخاب ساعت"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.85}
            style={styles.addBtn}
          >
            {editingId ? (
              <Text style={{ color: "#111827", fontWeight: "900" }}>ذخیره</Text>
            ) : (
              <Ionicons name="add" size={22} color="#111827" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={styles.emptyText}>هنوز هیچ یادآوری اینجا ثبت نشده.</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          {items.map((item) => {
            const d = new Date(item.when);
            const done = !!item.done;

            return (
              <View key={item.id} style={styles.rowCard}>
                <TouchableOpacity
                  onPress={() => onToggleReminder(item.id)}
                  activeOpacity={0.85}
                  style={[styles.checkBox, done ? styles.checkBoxDone : null]}
                >
                  {done && (
                    <Ionicons name="checkmark" size={14} color="#111827" />
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: UI.TEXT,
                      fontWeight: "900",
                      textAlign: "right",
                      textDecorationLine: done ? "line-through" : "none",
                      opacity: done ? 0.6 : 1,
                    }}
                    onLongPress={() => onEditItem(item)}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={{
                      color: UI.MUTED,
                      fontSize: 12,
                      textAlign: "right",
                      fontWeight: "800",
                      marginTop: 2,
                    }}
                  >
                    {jalaliLabel(d)} • {toFa(timeLabel(d))}
                  </Text>

                  {!done && (
                    <View
                      style={{
                        flexDirection: "row-reverse",
                        justifyContent: "flex-start",
                        marginTop: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => onSnoozeReminder(item.id)}
                        activeOpacity={0.85}
                        style={styles.snoozeBtn}
                      >
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={UI.TEXT}
                        />
                        <Text
                          style={{
                            color: UI.TEXT,
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          +۱۰ دقیقه
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => onEditItem(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="create-outline" size={18} color={UI.TEXT} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => onRemoveReminder(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={UI.DANGER} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ---------- DateModal ---------- */
function DateModal({
  visible,
  onClose,
  jy,
  jm,
  jd,
  setJy,
  setJm,
  setJd,
}: {
  visible: boolean;
  onClose: () => void;
  jy: number;
  jm: number;
  jd: number;
  setJy: (n: number) => void;
  setJm: (n: number) => void;
  setJd: (n: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const monthsFa = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ];

  const clampDay = (y: number, m: number) => {
    const lim = jalaaliMonthLength(y, m);
    if (jd > lim) setJd(lim);
  };

  const changeYear = (delta: number) => {
    const y = jy + delta;
    setJy(y);
    clampDay(y, jm);
  };

  const selectMonth = (m: number) => {
    setJm(m);
    clampDay(jy, m);
  };

  const daysInMonth = jalaaliMonthLength(jy, jm);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            { paddingBottom: (insets.bottom || 0) + 12 },
          ]}
        >
          <Text style={styles.modalTitle}>انتخاب تاریخ</Text>

          <View style={styles.yearRow}>
            <TouchableOpacity
              onPress={() => changeYear(-1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="remove" size={20} color={UI.TEXT} />
            </TouchableOpacity>
            <Text style={{ color: UI.TEXT, fontWeight: "900" }}>
              {String(jy).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}
            </Text>
            <TouchableOpacity
              onPress={() => changeYear(1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={20} color={UI.TEXT} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            {monthsFa.map((mTitle, idx) => {
              const m = idx + 1;
              const selected = jm === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => selectMonth(m)}
                  activeOpacity={0.85}
                  style={[
                    styles.monthBtn,
                    selected ? styles.monthBtnActive : null,
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? "#111827" : UI.TEXT,
                      fontWeight: "900",
                    }}
                  >
                    {mTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}
          >
            {days.map((d) => {
              const selected = d === jd;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setJd(d)}
                  activeOpacity={0.85}
                  style={[styles.dayBtn, selected ? styles.dayBtnActive : null]}
                >
                  <Text
                    style={{
                      color: selected ? "#111827" : UI.TEXT,
                      fontWeight: "900",
                    }}
                  >
                    {String(d).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[+x])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
            >
              <Text style={styles.btnPrimaryText}>تأیید</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={[styles.btn, styles.btnOutline, { flex: 1 }]}
            >
              <Text style={styles.btnOutlineText}>بستن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ========================================================= */
export default function Rooznegar() {
  const insets = useSafeAreaInsets();

  const { setDayProgress } = usePhoenix();

  const [tab, setTab] = useState<"today" | "rem">("today");

  const [tAlertOpen, setTAlertOpen] = useState(false);
  const [tAlertTitle, setTAlertTitle] = useState("");
  const [tAlertMsg, setTAlertMsg] = useState("");
  const showTAlert = (title: string, message?: string) => {
    setTAlertTitle(title);
    setTAlertMsg(message || "");
    setTAlertOpen(true);
  };

  // امروز
  const [todayTitle, setTodayTitle] = useState("");
  const [todayTime, setTodayTime] = useState<Date | null>(null);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [showTodayTime, setShowTodayTime] = useState(false);
  const [todayEditingId, setTodayEditingId] = useState<string | null>(null);

  // یادآور
  const tJ = toJalaali(new Date());
  const [jy, setJy] = useState<number>(tJ.jy);
  const [jm, setJm] = useState<number>(tJ.jm);
  const [jd, setJd] = useState<number>(tJ.jd);
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState<Date | null>(null);
  const [remItems, setRemItems] = useState<ReminderItem[]>([]);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showRemTime, setShowRemTime] = useState(false);
  const [remEditingId, setRemEditingId] = useState<string | null>(null);

  const loadedRef = useRef(false);

  /* NOTIFS */
  const [notifAllowed, setNotifAllowed] = useState<boolean>(false);
  const askedRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Reminders",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
          vibrationPattern: [0, 250, 250, 250],
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      if (Platform.OS === "ios") {
        await Notifications.setNotificationCategoryAsync("reminder_actions", [
          { identifier: "DONE", buttonTitle: "انجام شد" },
          { identifier: "SNOOZE_10", buttonTitle: "+۱۰ دقیقه" },
        ]);
      }

      // ✅ iOS جدید: باید banner/list هم برگرده
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    })();
  }, []);

  const ensureNotifPermission = async () => {
    if (notifAllowed) return true;
    if (askedRef.current) return false;
    askedRef.current = true;

    const settings = await Notifications.getPermissionsAsync();
    let granted =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;

    if (!granted) {
      const res = await Notifications.requestPermissionsAsync();
      granted =
        res.granted ||
        res.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    }

    setNotifAllowed(granted);
    if (!granted) {
      // ✅ تم‌دار
      showTAlert(
        "اجازه نوتیفیکیشن",
        "برای اعلام یادآورها به تو، اجازه دسترسی به نوتیفیکیشن‌ها لازمه.",
      );
    }
    return granted;
  };

  const debugScheduledNotifications = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();

      console.log(
        "[ROOZNEGAR_SCHEDULED_NOTIFICATIONS]",
        scheduled.map((item) => ({
          identifier: item.identifier,
          title: item.content.title,
          body: item.content.body,
          data: item.content.data,
          trigger: item.trigger,
        })),
      );
    } catch (error) {
      console.log("[ROOZNEGAR_SCHEDULED_NOTIFICATIONS_ERROR]", error);
    }
  };

  const scheduleLocalNotification = async ({
    id,
    title,
    when,
  }: {
    id: string;
    title: string;
    when: number;
  }): Promise<string | undefined> => {
    if (!(await ensureNotifPermission())) {
      return undefined;
    }

    const triggerDate = new Date(when);

    if (triggerDate.getTime() <= Date.now()) {
      return undefined;
    }

    const content: Notifications.NotificationContentInput & {
      categoryIdentifier?: string;
      data?: any;
    } = {
      title: "یادآور",
      body: title,
      sound: "default",
      categoryIdentifier:
        Platform.OS === "ios" ? "reminder_actions" : undefined,
      data: {
        rid: id,
      },
    };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content,

      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,

        ...(Platform.OS === "android"
          ? {
              channelId: "reminders",
            }
          : {}),
      },
    });

    console.log("[ROOZNEGAR_NOTIFICATION_SCHEDULED]", {
      notificationId,
      title,
      when,
      triggerDate: triggerDate.toISOString(),
    });

    await debugScheduledNotifications();

    return notificationId;
  };

  const cancelNotif = async (id?: string) => {
    if (!id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  };

  const visibleTodayItems = useMemo(() => {
    const todayKey = todayDateKey();

    return todayItems.filter((item) => {
      const itemDate = getItemDateKey(item);

      // برنامه‌های امروز همیشه نمایش داده شوند
      if (itemDate === todayKey) {
        return true;
      }

      // از روزهای قبل فقط انجام‌نشده‌ها باقی بمانند
      return !item.done;
    });
  }, [todayItems]);

  const todayProgress = useMemo(() => {
    const todayKey = todayDateKey();

    const todaysItems = todayItems.filter(
      (item) => getItemDateKey(item) === todayKey,
    );

    const total = todaysItems.length;

    if (!total) return 0;

    const done = todaysItems.filter((item) => item.done).length;

    return Math.round((done / total) * 100);
  }, [todayItems]);

  React.useEffect(() => {
    setDayProgress(todayProgress);
  }, [todayProgress, setDayProgress]);

  useEffect(() => {
    (async () => {
      try {
        const [tList, rList] = await Promise.all([
          loadToday(),
          loadReminders(),
        ]);

        if (Array.isArray(tList)) {
          setTodayItems((prev) => (prev.length ? prev : sortToday(tList)));
        }

        if (Array.isArray(rList)) {
          setRemItems((prev) => (prev.length ? prev : sortReminders(rList)));
        }
      } finally {
        loadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveToday(todayItems).catch(() => {});
  }, [todayItems]);

  useEffect(() => {
    if (!loadedRef.current) return;
    saveReminders(remItems).catch(() => {});
  }, [remItems]);

  const addTodayItem = async () => {
    const t = todayTitle.trim();

    if (!t) return;

    /*
     * ساعت برای برنامه امروز اختیاری است.
     * فقط اگر ساعت انتخاب شده باشد، زمان واقعی امروز ساخته می‌شود.
     */
    let when: Date | null = null;

    if (todayTime) {
      const now = new Date();

      when = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        todayTime.getHours(),
        todayTime.getMinutes(),
        0,
        0,
      );
    }

    /*
     * -------------------------
     * EDIT
     * -------------------------
     */
    if (todayEditingId) {
      const existing = todayItems.find((it) => it.id === todayEditingId);

      /*
       * نوتیفیکیشن قبلی را همیشه لغو می‌کنیم؛
       * چون ممکن است ساعت حذف یا تغییر کرده باشد.
       */
      if (existing?.notificationId) {
        await cancelNotif(existing.notificationId);
      }

      let notificationId: string | undefined;

      /*
       * فقط وقتی:
       * 1. ساعت انتخاب شده
       * 2. کار هنوز انجام نشده
       * 3. ساعت در آینده است
       *
       * نوتیفیکیشن ساخته می‌شود.
       */
      if (todayTime && when && !existing?.done && when.getTime() > Date.now()) {
        notificationId = await scheduleLocalNotification({
          id: todayEditingId,
          title: t,
          when: when.getTime(),
        });
      }

      setTodayItems((list) =>
        sortToday(
          list.map((it) =>
            it.id === todayEditingId
              ? {
                  ...it,
                  title: t,
                  time: todayTime ? timeLabel(todayTime) : undefined,
                  notificationId,
                }
              : it,
          ),
        ),
      );

      setTodayEditingId(null);
    } else {
      /*
       * -------------------------
       * CREATE
       * -------------------------
       */
      const id = uid();

      let notificationId: string | undefined;

      /*
       * فقط اگر ساعت انتخاب شده و هنوز نگذشته باشد
       * Notification می‌سازیم.
       */
      if (todayTime && when && when.getTime() > Date.now()) {
        notificationId = await scheduleLocalNotification({
          id,
          title: t,
          when: when.getTime(),
        });
      }

      const item: TodayItem = {
        id,
        title: t,
        time: todayTime ? timeLabel(todayTime) : undefined,
        done: false,
        createdAt: Date.now(),
        scheduledDate: todayDateKey(),
        notificationId,
      };

      setTodayItems((list) => sortToday([...list, item]));
    }

    setTodayTitle("");
    setTodayTime(null);
    Keyboard.dismiss();
  };

  const handleToggleTodayItem = async (id: string) => {
    const target = todayItems.find((it) => it.id === id);
    if (!target) return;

    const nextDone = !target.done;

    /*
     * اگر کار انجام شد:
     * نوتیفیکیشن احتمالی را لغو کن.
     */
    if (nextDone) {
      if (target.notificationId) {
        await cancelNotif(target.notificationId);
      }

      setTodayItems((list) =>
        sortToday(
          list.map((it) =>
            it.id === id
              ? {
                  ...it,
                  done: true,
                  notificationId: undefined,
                }
              : it,
          ),
        ),
      );

      return;
    }

    /*
     * اگر دوباره از حالت انجام‌شده خارج شد
     * ولی ساعت ندارد:
     * فقط Done را false کن و هیچ نوتیفیکیشنی نساز.
     */
    if (!target.time) {
      setTodayItems((list) =>
        sortToday(
          list.map((it) =>
            it.id === id
              ? {
                  ...it,
                  done: false,
                  notificationId: undefined,
                }
              : it,
          ),
        ),
      );

      return;
    }

    /*
     * اگر ساعت دارد، زمان امروز را می‌سازیم.
     */
    const [hh, mm] = target.time.split(":").map((x) => parseInt(x, 10));

    const now = new Date();

    const when = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hh || 0,
      mm || 0,
      0,
      0,
    );

    /*
     * فقط اگر ساعت هنوز نگذشته باشد
     * نوتیفیکیشن دوباره ساخته می‌شود.
     */
    const notificationId =
      when.getTime() > Date.now()
        ? await scheduleLocalNotification({
            id: target.id,
            title: target.title,
            when: when.getTime(),
          })
        : undefined;

    setTodayItems((list) =>
      sortToday(
        list.map((it) =>
          it.id === id
            ? {
                ...it,
                done: false,
                notificationId,
              }
            : it,
        ),
      ),
    );
  };

  const handleRemoveTodayItem = async (id: string) => {
    const target = todayItems.find((it) => it.id === id);

    /*
     * قبل از حذف آیتم،
     * Notification زمان‌بندی‌شده را هم حذف کن.
     */
    if (target?.notificationId) {
      await cancelNotif(target.notificationId);
    }

    setTodayItems((list) => sortToday(list.filter((it) => it.id !== id)));
  };

  const addReminder = async () => {
    const t = remTitle.trim();
    if (!t) return;
    if (!remTime) {
      showTAlert(
        "انتخاب ساعت",
        "برای ثبت یادآور، حتماً ساعت انجامش رو انتخاب کن.",
      );
      return;
    }

    const g = toGregorian(jy, jm, jd);
    const when = new Date(
      g.gy,
      g.gm - 1,
      g.gd,
      remTime.getHours(),
      remTime.getMinutes(),
      0,
      0,
    );

    if (remEditingId) {
      let updatedNotificationId: string | undefined;
      await Promise.resolve();

      setRemItems((list) => {
        const mapped = list.map((it) => {
          if (it.id === remEditingId) {
            cancelNotif(it.notificationId);
            return {
              ...it,
              title: t,
              when: when.getTime(),
              notificationId: undefined,
            };
          }
          return it;
        });
        return sortReminders(mapped);
      });

      updatedNotificationId = await scheduleLocalNotification({
        id: remEditingId,
        title: t,
        when: when.getTime(),
      });

      setRemItems((list) =>
        list.map((it) =>
          it.id === remEditingId
            ? { ...it, notificationId: updatedNotificationId }
            : it,
        ),
      );

      setRemEditingId(null);
    } else {
      const base: ReminderItem = {
        id: uid(),
        title: t,
        when: when.getTime(),
        createdAt: Date.now(),
        done: false,
      };

      const notificationId = await scheduleLocalNotification({
        id: base.id,
        title: base.title,
        when: base.when,
      });
      const item: ReminderItem = { ...base, notificationId };
      setRemItems((list) => sortReminders([...list, item]));
    }

    setRemTitle("");
    setRemTime(null);
    Keyboard.dismiss();
  };

  const handleRemoveReminder = async (id: string) => {
    const target = remItems.find((r) => r.id === id);
    if (target?.notificationId) await cancelNotif(target.notificationId);
    setRemItems((list) => sortReminders(list.filter((r) => r.id !== id)));
  };

  const handleToggleReminder = async (id: string) => {
    const target = remItems.find((r) => r.id === id);
    if (!target) return;
    const toggledDone = !target.done;

    if (toggledDone) {
      if (target.notificationId) await cancelNotif(target.notificationId);
      setRemItems((list) =>
        sortReminders(
          list.map((r) =>
            r.id === id ? { ...r, done: true, notificationId: undefined } : r,
          ),
        ),
      );
    } else {
      const notificationId = await scheduleLocalNotification({
        id: target.id,
        title: target.title,
        when: target.when,
      });

      setRemItems((list) =>
        sortReminders(
          list.map((r) =>
            r.id === id
              ? {
                  ...r,
                  done: false,
                  notificationId,
                }
              : r,
          ),
        ),
      );
    }
  };

  const handleSnoozeReminder = async (id: string) => {
    const target = remItems.find((r) => r.id === id);
    if (!target) return;

    const base = Math.max(Date.now(), target.when);
    const nextWhen = base + 10 * 60 * 1000;

    if (target.notificationId) {
      await cancelNotif(target.notificationId);
    }

    const next: ReminderItem = {
      ...target,
      when: nextWhen,
      done: false,
    };

    const newNotif = await scheduleLocalNotification({
      id: next.id,
      title: next.title,
      when: next.when,
    });

    setRemItems((list) =>
      sortReminders(
        list.map((r) =>
          r.id === id
            ? {
                ...next,
                notificationId: newNotif,
              }
            : r,
        ),
      ),
    );
  };

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        const rid = (resp?.notification?.request?.content?.data as any)?.rid as
          | string
          | undefined;
        const act = resp?.actionIdentifier;
        if (!rid) return;

        if (Platform.OS === "ios") {
          if (act === "DONE") {
            handleToggleReminder(rid);
            return;
          }
          if (act === "SNOOZE_10") {
            handleSnoozeReminder(rid);
            return;
          }
          return;
        }

        if (act === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          const item = remItems.find((r) => r.id === rid);
          // این یکی عمداً خام موند چون دکمه چندگزینه‌ایه؛ اگر خواستی تم‌دارش کنیم باید یک Modal اکشن‌دار بسازیم
          Alert.alert(
            item?.title || "یادآور",
            "چه کاری انجام بدم؟",
            [
              { text: "انجام شد", onPress: () => handleToggleReminder(rid) },
              { text: "+۱۰ دقیقه", onPress: () => handleSnoozeReminder(rid) },
              { text: "بستن", style: "cancel" },
            ],
            { cancelable: true },
          );
        }
      },
    );

    return () => {
      try {
        sub.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remItems]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: UI.BG }}>
      {/* Glow shapes مثل مشعل */}
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Math.max(24, insets.bottom + 24),
            paddingHorizontal: 0,
            rowGap: 14,
            direction: "ltr",
          }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <RoozHeader />

            <ProgressCard value={todayProgress} />
            <Segmented tab={tab} setTab={setTab} />
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {tab === "today" ? (
              <TodayBlock
                rtl={false}
                items={visibleTodayItems}
                setItems={setTodayItems}
                title={todayTitle}
                setTitle={setTodayTitle}
                time={todayTime}
                onOpenTime={() => setShowTodayTime(true)}
                onAdd={addTodayItem}
                editingId={todayEditingId}
                onEditItem={(it) => {
                  setTodayEditingId(it.id);
                  setTodayTitle(it.title);

                  if (it.time) {
                    const [hh, mm] = it.time
                      .split(":")
                      .map((x) => parseInt(x, 10));

                    const d = new Date();
                    d.setHours(hh || 0, mm || 0, 0, 0);
                    setTodayTime(d);
                  } else {
                    setTodayTime(null);
                  }
                }}
                onToggleItem={handleToggleTodayItem}
                onRemoveItem={handleRemoveTodayItem}
              />
            ) : (
              <ReminderBlock
                rtl={false}
                jy={jy}
                jm={jm}
                jd={jd}
                setJy={setJy}
                setJm={setJm}
                setJd={setJd}
                remTitle={remTitle}
                setRemTitle={setRemTitle}
                remTime={remTime}
                onOpenDate={() => setShowDateModal(true)}
                onOpenTime={() => setShowRemTime(true)}
                items={remItems}
                setItems={setRemItems}
                onAdd={addReminder}
                editingId={remEditingId}
                onEditItem={(it) => {
                  setRemEditingId(it.id);
                  setRemTitle(it.title);
                  const d = new Date(it.when);
                  const j = toJalaali(d);
                  setJy(j.jy);
                  setJm(j.jm);
                  setJd(j.jd);
                  const tmp = new Date();
                  tmp.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  setRemTime(tmp);
                }}
                onToggleReminder={handleToggleReminder}
                onRemoveReminder={handleRemoveReminder}
                onSnoozeReminder={handleSnoozeReminder}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <DateTimePickerModal
        isVisible={showTodayTime}
        mode="time"
        locale={Platform.OS === "ios" ? "fa-IR" : undefined}
        onConfirm={(d) => {
          setTodayTime(d);
          setShowTodayTime(false);
        }}
        onCancel={() => setShowTodayTime(false)}
      />
      <DateTimePickerModal
        isVisible={showRemTime}
        mode="time"
        locale={Platform.OS === "ios" ? "fa-IR" : undefined}
        onConfirm={(d) => {
          setRemTime(d);
          setShowRemTime(false);
        }}
        onCancel={() => setShowRemTime(false)}
      />
      <DateModal
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        jy={jy}
        jm={jm}
        jd={jd}
        setJy={setJy}
        setJm={setJm}
        setJd={setJd}
      />

      {/* ✅ THEMED ALERT RENDER */}
      <ThemedAlert
        visible={tAlertOpen}
        title={tAlertTitle}
        message={tAlertMsg}
        onClose={() => setTAlertOpen(false)}
      />
    </SafeAreaView>
  );
}

function sortToday(arr: TodayItem[]) {
  return [...arr].sort((a, b) => {
    // انجام‌نشده‌ها اول
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }

    // اگر هر دو ساعت دارند، بر اساس ساعت مرتب شوند
    if (a.time && b.time && a.time !== b.time) {
      return a.time < b.time ? -1 : 1;
    }

    // آیتم دارای ساعت قبل از آیتم بدون ساعت
    if (a.time && !b.time) {
      return -1;
    }

    if (!a.time && b.time) {
      return 1;
    }

    // اگر وضعیت ساعت برابر بود، عنوان
    if (a.title !== b.title) {
      return a.title.localeCompare(b.title, "fa");
    }

    return a.createdAt - b.createdAt;
  });
}

function sortReminders(arr: ReminderItem[]) {
  return [...arr].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.when !== b.when) return a.when - b.when;
    return a.title.localeCompare(b.title, "fa");
  });
}

/* ===================== styles ===================== */
const styles = {
  bgGlowTop: {
    position: "absolute" as const,
    top: -260,
    left: -240,
    width: 480,
    height: 480,
    borderRadius: 999,
    backgroundColor: "rgba(212,175,55,.14)",
  },
  bgGlowBottom: {
    position: "absolute" as const,
    bottom: -280,
    right: -260,
    width: 560,
    height: 560,
    borderRadius: 999,
    backgroundColor: "rgba(233,138,21,.10)",
  },

  headerBar: {
    backgroundColor: UI.BAR,
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  headerTitle: {
    color: UI.TEXT,
    fontSize: 18,
    fontWeight: "900" as const,
    textAlign: "right" as const,
  },
  headerSub: {
    color: UI.MUTED,
    fontSize: 12,
    fontWeight: "800" as const,
    marginTop: 2,
    textAlign: "right" as const,
  },
  headerIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: UI.CARD,
    borderWidth: 1,
    borderColor: UI.BORDER,
  },

  card: {
    backgroundColor: UI.CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.BORDER,
    gap: 12,
  },

  helperText: {
    color: UI.MUTED,
    fontSize: 12,
    textAlign: "right" as const,
    fontWeight: "800" as const,
  },
  emptyText: {
    color: UI.MUTED,
    fontSize: 12,
    textAlign: "center" as const,
    fontWeight: "800" as const,
  },

  segmentWrap: {
    backgroundColor: UI.CARD2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: UI.BORDER,
    padding: 6,
    flexDirection: "row-reverse" as const,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  segmentBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderColor: "rgba(212,175,55,.45)",
  },
  segmentText: {
    color: UI.TEXT,
    fontWeight: "900" as const,
    opacity: 0.9,
  },
  segmentTextActive: {
    color: "#111827",
    opacity: 1,
  },

  inputBox: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: "center" as const,
    backgroundColor: "rgba(255,255,255,.02)",
  },

  timeBtn: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 46,
    backgroundColor: "rgba(255,255,255,.02)",
  },
  addBtn: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 46,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },

  rowCard: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "rgba(255,255,255,.02)",
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    gap: 10,
  },

  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: UI.BORDER,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: "transparent",
  },
  checkBoxDone: {
    borderColor: "rgba(212,175,55,.65)",
    backgroundColor: "rgba(212,175,55,.92)",
  },

  chip: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    margin: 4,
    gap: 6,
  },
  chipSelected: {
    borderColor: "rgba(212,175,55,.65)",
    backgroundColor: "rgba(212,175,55,.92)",
  },

  snoozeBtn: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center" as const,
    flexDirection: "row-reverse" as const,
    gap: 6,
    backgroundColor: "rgba(255,255,255,.02)",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  modalCard: {
    width: "92%" as const,
    maxHeight: "84%" as const,
    borderRadius: 16,
    backgroundColor: UI.BAR,
    borderWidth: 1,
    borderColor: UI.BORDER,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    color: UI.TEXT,
    fontWeight: "900" as const,
    textAlign: "right" as const,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 8,
    backgroundColor: UI.CARD,
  },

  // ✅ Themed alert styles
  alertCard: {
    width: "92%" as const,
    borderRadius: 16,
    backgroundColor: UI.BAR,
    borderWidth: 1,
    borderColor: UI.BORDER,
    padding: 16,
    gap: 12,
  },
  alertTitle: {
    color: UI.TEXT,
    fontWeight: "900" as const,
    fontSize: 16,
    textAlign: "right" as const,
  },
  alertMsg: {
    color: UI.MUTED2,
    fontWeight: "800" as const,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right" as const,
  },

  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  btnPrimary: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,.45)",
  },
  btnPrimaryText: {
    color: "#111827",
    fontWeight: "900" as const,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  btnOutlineText: {
    color: UI.TEXT,
    fontWeight: "900" as const,
  },

  yearRow: {
    flexDirection: "row-reverse" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    borderRadius: 12,
    padding: 10,
    backgroundColor: UI.CARD,
  },

  monthBtn: {
    width: "31%" as const,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: UI.BORDER,
    backgroundColor: "transparent",
  },
  monthBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
    borderColor: "rgba(212,175,55,.45)",
  },

  dayBtn: {
    width: `${100 / 7}%` as const,
    aspectRatio: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayBtnActive: {
    backgroundColor: "rgba(212,175,55,.92)",
  },
} as const;
