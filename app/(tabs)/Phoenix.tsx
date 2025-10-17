// app/(tabs)/Phoenix.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { toJalaali } from "jalaali-js";
import React, { useState } from "react";
import {
  Alert,
  I18nManager,
  Image,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Screen from "../../components/Screen";
import { usePhoenix } from "../../hooks/PhoenixContext";
/* ⬇️ افزوده: برای Safe Area مودال */
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* 🔹 برای گالری/دوربین */
import * as ImagePicker from "expo-image-picker";

/* 🔹 برای پاک‌کردن داده‌های روزنگار/یادآورها/تگ‌ها */
import { saveReminders, saveTags, saveToday } from "../../lib/storage";

/* 🔹 جدید: ذخیره‌ی پروفایل برای استفاده در تیکت‌ها (openedByName) */
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------- helpers ---------- */
const toPersianDigits = (s: string | number) =>
  String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

function ProgressBar({
  value = 0,
  color = "#FF6B00",
  track = "#ECEEF2",
}: {
  value: number;
  color?: string;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height: 10, borderRadius: 999, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

/* ---------- Circular Gauge ---------- */
function CircularGauge({
  value = 0,
  size = 64,
  strokeWidth = 7,
  color = "#FF6B00",
  track = "#E4E6EB",
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  track?: string;
  label?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = C * (1 - pct / 100);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, transform: [{ rotate: "-90deg" }] }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center", height: size }}>
        <Text style={{ fontWeight: "800", fontSize: 13 }}>{toPersianDigits(Math.round(pct))}%</Text>
        {!!label && <Text style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>{label}</Text>}
      </View>
    </View>
  );
}

/* ---------- NoContactCard ---------- */
function NoContactCard() {
  const { colors } = useTheme();
  const { noContactStreak, canLogNoContactToday, incNoContact, resetNoContact } = usePhoenix();

  const onLogToday = () => {
    const ok = incNoContact();
    if (!ok) console.log("امروز قبلاً ثبت شده است.");
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>شمارنده قطع تماس</Text>
      <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, textAlign: "center" }}>{toPersianDigits(noContactStreak)} روز</Text>

      <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
        <TouchableOpacity
          onPress={onLogToday}
          disabled={!canLogNoContactToday}
          activeOpacity={0.85}
          style={{
            backgroundColor: canLogNoContactToday ? colors.primary : "#5B5D63",
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            minWidth: 150,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>امروز انجام شد (+۱)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={resetNoContact}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.background,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 12,
            minWidth: 120,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>ریست به صفر</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 12, color: "#8E8E93", textAlign: "center" }}>
        هر روز که تماس/چک نکردی، «امروز انجام شد» را بزن. اگر شکستی، «ریست به صفر».
        {canLogNoContactToday ? "" : " (امروز ثبت شده—فردا دوباره فعال می‌شود)"}
      </Text>
    </View>
  );
}

/* ---------- TechniqueStreakCard ---------- */
function TechniqueStreakCard() {
  const { colors } = useTheme();
  const { streakDays, bestStreak, incrementStreak, resetStreak } = usePhoenix();

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>استریک تکنیک‌ها</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: "900", color: colors.text }}>{toPersianDigits(streakDays)} روز</Text>
          <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>بهترین رکورد: {toPersianDigits(bestStreak)} روز</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={incrementStreak}
            activeOpacity={0.85}
            style={{ backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, minWidth: 110, alignItems: "center" }}
          >
            <Text style={{ color: "#FFF", fontWeight: "800" }}>امروز انجام شد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={resetStreak}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.background,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              minWidth: 80,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>ریست</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ---------- BadgesCard ---------- */
function BadgesCard() {
  const { colors } = useTheme();
  const { points, streakDays, noContactStreak } = usePhoenix();

  const badges = [
    { key: "points50", title: "۵۰ امتیاز", desc: "جمع امتیازها ≥ ۵۰", icon: <Ionicons name="trophy" size={20} color="#FF8A33" />, unlocked: points >= 50 },
    { key: "streak3", title: "استریک ۳ روزه", desc: "تکنیک‌ها ≥ ۳ روز", icon: <Ionicons name="flame" size={20} color="#A855F7" />, unlocked: streakDays >= 3 },
    { key: "nocontact3", title: "قطع‌تماس ۳ روزه", desc: "قطع تماس ≥ ۳ روز", icon: <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />, unlocked: noContactStreak >= 3 },
  ];

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>امتیازها و مدال‌ها</Text>
        <Text style={{ fontSize: 12, color: "#8E8E93" }}>
          مجموع امتیاز: <Text style={{ color: colors.text, fontWeight: "800" }}>{toPersianDigits(points)}</Text>
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {badges.map((b) => (
          <View
            key={b.key}
            style={{
              width: "31.5%",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
              paddingVertical: 12,
              opacity: b.unlocked ? 1 : 0.45,
            }}
          >
            <View style={{ height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: 6 }}>
              {b.icon}
            </View>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{b.title}</Text>
            <Text style={{ color: "#8E8E93", fontSize: 10, marginTop: 2, textAlign: "center" }}>{b.desc}</Text>
            {!b.unlocked && (
              <View style={{ marginTop: 6, backgroundColor: "#E2E3E8", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, color: "#5B5D63", fontWeight: "800" }}>قفل</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- Modal: ویرایش پروفایل + تغییر تم + شروع از صفر ---------- */
function EditProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  /* ⬇️ افزوده: رعایت safe area پایین برای مودال */
  const insets = useSafeAreaInsets();

  const {
    profileName,
    avatarUrl,
    setProfileName,
    setAvatarUrl,
    isDark,
    toggleTheme,

    /* ⬇️ برای «شروع از صفر» */
    setPelekanProgress,
    setDayProgress,
    resetStreak,
    resetNoContact,
    addPoints,
    points,
  } = usePhoenix();

  const [name, setName] = useState(profileName);
  const [photo, setPhoto] = useState(avatarUrl); // "icon:man" / "icon:woman" یا file://

  React.useEffect(() => {
    if (visible) {
      setName(profileName);
      setPhoto(avatarUrl);
    }
  }, [visible, profileName, avatarUrl]);

  const save = async () => {
    const safeName = (name || "").trim() || "کاربر";
    const safeAvatar = photo || "icon:man";

    setProfileName(safeName);
    setAvatarUrl(safeAvatar);

    // ⬇️ جدید: ذخیره برای استفاده‌ی بَک‌اند (openedByName / openedById)
    try {
      await AsyncStorage.setItem(
        "phoenix_profile",
        JSON.stringify({
          id: "",           // اگر شناسه‌ای مثل phone/email داری اینجا set کن
          fullName: safeName,
          avatarUrl: safeAvatar,
        })
      );
    } catch {}

    onClose();
  };

  // انتخاب از گالری
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("اجازه دسترسی لازم است", "برای انتخاب عکس از گالری، اجازهٔ دسترسی را فعال کن.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });
      if (!res.canceled) {
        const uri = res.assets?.[0]?.uri;
        if (uri) setPhoto(uri);
      }
    } catch (e) {
      Alert.alert("خطا", "هنگام باز کردن گالری مشکلی پیش آمد.");
    }
  };

  // عکس‌گرفتن با دوربین
  const pickFromCamera = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert("اجازهٔ دوربین لازم است", "برای گرفتن عکس با دوربین، اجازهٔ دسترسی را فعال کن.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });
      if (!res.canceled) {
        const uri = res.assets?.[0]?.uri;
        if (uri) setPhoto(uri);
      }
    } catch (e) {
      Alert.alert("خطا", "هنگام باز کردن دوربین مشکلی پیش آمد.");
    }
  };

  // آواتار انتخابی در مودال
  const renderModalAvatar = () => {
    if (photo?.startsWith("icon:")) {
      const which = photo.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", backgroundColor: color + "22", borderWidth: 1, borderColor: color }}>
          <Ionicons name={iconName as any} size={60} color={color} />
        </View>
      );
    }
    return <Image source={{ uri: photo }} style={{ width: 84, height: 84, borderRadius: 42 }} />;
  };

  /* ⬇️ شروع از صفر: پاک‌کردن تمام داده‌ها + ریست وضعیت‌ها */
  const confirmResetAll = () => {
    Alert.alert(
      "شروع از صفر",
      "همهٔ تمرین‌ها، برنامه‌ها، یادآورها، تگ‌ها و امتیازها صفر می‌شود و از اول شروع می‌کنی. ادامه می‌دهی؟",
      [
        { text: "انصراف", style: "cancel" },
        {
          text: "بله، پاک کن",
          style: "destructive",
          onPress: async () => {
            try {
              // خالی‌کردن داده‌های روزنگار/یادآورها/تگ‌ها
              await Promise.all([saveToday([]), saveReminders([]), saveTags([])]);

              // ریست وضعیت‌های ققنوس
              setPelekanProgress(0);
              setDayProgress(0);
              resetStreak();
              resetNoContact();

              // صفر کردن امتیاز (با کم‌کردن مقدار فعلی)
              if (points > 0) addPoints(-points);

              // ریست پروفایل
              setProfileName("کاربر");
              setAvatarUrl("icon:man");

              Alert.alert("پاک‌سازی انجام شد", "همه‌چیز صفر شد. از نو شروع کن ✨");
              onClose();
            } catch (e) {
              Alert.alert("خطا", "در پاک‌سازی داده‌ها مشکلی پیش آمد.");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>ویرایش پروفایل</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: "center", marginTop: 10 }}>
            {renderModalAvatar()}
          </View>

          {/* نام */}
          <View style={{ gap: 10, marginTop: 12 }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>نام</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="نام شما"
              placeholderTextColor="#8E8E93"
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              textAlign={I18nManager.isRTL ? "right" : "left"}
            />
          </View>

          {/* انتخاب منبع تصویر */}
          <Text style={{ marginTop: 14, color: colors.text, fontWeight: "700" }}>تصویر پروفایل</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TouchableOpacity onPress={pickFromGallery} style={[styles.secondaryBtn, { borderColor: colors.border, flexDirection: "row", gap: 6 }]}>
              <Ionicons name="images-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800" }}>از گالری</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromCamera} style={[styles.secondaryBtn, { borderColor: colors.border, flexDirection: "row", gap: 6 }]}>
              <Ionicons name="camera-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800" }}>دوربین</Text>
            </TouchableOpacity>
          </View>

          {/* انتخاب آیکن مرد/زن */}
          <Text style={{ marginTop: 12, marginBottom: 6, color: colors.text, fontWeight: "700" }}>یا انتخاب آیکن</Text>
          <View style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>
            {(["man", "woman"] as const).map((which) => {
              const selected = photo === `icon:${which}`;
              const color = which === "woman" ? "#A855F7" : "#3B82F6";
              return (
                <TouchableOpacity
                  key={which}
                  onPress={() => setPhoto(`icon:${which}`)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: color + "22",
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? color : colors.border,
                  }}
                >
                  <Ionicons name={which as any} size={44} color={color} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* تغییر تم */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>حالت تیره</Text>
              <Text style={{ color: "#8E8E93", fontSize: 12, marginTop: 2 }}>ظاهر اپلیکیشن</Text>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>

          {/* ⬇️ شروع از صفر */}
          <View style={{ marginTop: 14 }}>
            <TouchableOpacity
              onPress={confirmResetAll}
              style={{
                borderWidth: 1,
                borderColor: "#ef4444",
                backgroundColor: Platform.OS === "ios" ? "#ef444420" : "#ef444410",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="trash-bin-outline" size={18} color="#ef4444" />
              <Text style={{ color: "#ef4444", fontWeight: "800" }}>شروع از صفر (پاک‌سازی کامل)</Text>
            </TouchableOpacity>
            <Text style={{ color: "#8E8E93", fontSize: 11, textAlign: "center", marginTop: 6 }}>
              با این کار تمام تمرین‌ها، برنامه‌ها، یادآورها، تگ‌ها و امتیازها صفر می‌شود.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={save} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>ذخیره</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>انصراف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- AboutCard ---------- */
function AboutCard() {
  const { colors } = useTheme();
  const version =
    (Constants?.expoConfig as any)?.version ||
    (Constants?.manifest as any)?.version ||
    "1.0.0";

  const openSite = () => {
    Linking.openURL("https://example.com/phoenix");
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>دربارهٔ برنامه</Text>
      <Text style={{ color: "#8E8E93", fontSize: 12 }}>
        ققنوس — ابزار خودیاری و رشد فردی.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12 }}>نسخه: {toPersianDigits(version)}</Text>
        <TouchableOpacity onPress={openSite} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>وب‌سایت</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ================== Phoenix Screen ================== */
export default function Phoenix() {
  const rtl = I18nManager.isRTL;
  const { colors } = useTheme();
  const {
    profileName,
    avatarUrl,
    pelekanProgress,
    dayProgress,
    points,
    streakDays,
    setPelekanProgress,
    setDayProgress,
    addPoints,
    incrementStreak,
    isDark,
  } = usePhoenix();

  const [editVisible, setEditVisible] = useState(false);

  const g = new Date();
  const { jy, jm, jd } = toJalaali(g);
  const weekdays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const months = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
  const dateText = `${weekdays[g.getDay()]} ${toPersianDigits(jd)} ${months[jm - 1]} ${toPersianDigits(jy)}`;

  const bumpPelekan = () => setPelekanProgress(pelekanProgress + 5);
  const bumpDay = () => setDayProgress(dayProgress + 10);
  const onDoneTechnique = () => {
    incrementStreak();
    addPoints(10);
    setDayProgress(Math.min(100, dayProgress + 20));
  };

  // آواتار پروفایل (آیکن مرد/زن یا عکس فایل)
  const renderProfileAvatar = () => {
    if (avatarUrl?.startsWith("icon:")) {
      const which = avatarUrl.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: color + "22", borderWidth: 1, borderColor: color }}>
          <Ionicons name={iconName as any} size={44} color={color} />
        </View>
      );
    }
    return <Image source={{ uri: avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} animated />

      <Screen contentContainerStyle={{ rowGap: 12, direction: rtl ? "rtl" : "ltr" }} backgroundColor={colors.background}>
        {/* هدر */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>سلام، {profileName}</Text>
          <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>{dateText}</Text>
        </View>

        {/* کارت پروفایل */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          {renderProfileAvatar()}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{profileName}</Text>
            <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
              استریک تکنیک‌ها: {toPersianDigits(streakDays)} روز • امتیاز: {toPersianDigits(points)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setEditVisible(true)}
            activeOpacity={0.8}
            style={{ backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="create" size={16} color="#fff" />
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>ویرایش</Text>
          </TouchableOpacity>
        </View>

        {/* نمودار پیشرفت */}
        <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>نمودار پیشرفت</Text>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>پیشرفت پلکان</Text>
              <Text style={{ fontSize: 12, color: "#8E8E93" }}>{toPersianDigits(pelekanProgress)}٪</Text>
            </View>
            <ProgressBar value={pelekanProgress} color={colors.primary} track={colors.border} />
            <TouchableOpacity onPress={bumpPelekan} style={{ alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>+۵٪ تست</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>پیشرفت امروز</Text>
              <Text style={{ fontSize: 12, color: "#8E8E93" }}>{toPersianDigits(dayProgress)}٪</Text>
            </View>
            <ProgressBar value={dayProgress} color={colors.primary} track={colors.border} />
            <TouchableOpacity onPress={bumpDay} style={{ alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>+۱۰٪ تست</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <CircularGauge value={pelekanProgress} label="پلکان" color={colors.primary} track={colors.border} size={72} strokeWidth={7} />
            <CircularGauge value={dayProgress} label="امروز" color={colors.primary} track={colors.border} size={72} strokeWidth={7} />
            <View style={{ width: 72 }} />
          </View>
        </View>

        <NoContactCard />
        <TechniqueStreakCard />
        <BadgesCard />
        <AboutCard />

        <TouchableOpacity onPress={onDoneTechnique} style={{ backgroundColor: colors.text, borderRadius: 16, paddingVertical: 14, alignItems: "center" }} activeOpacity={0.8}>
          <Text style={{ color: colors.background, fontWeight: "800" }}>✅ انجام یک تکنیک (تست)</Text>
        </TouchableOpacity>
      </Screen>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});