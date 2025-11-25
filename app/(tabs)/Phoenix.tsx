// app/(tabs)/Phoenix.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { toJalaali } from "jalaali-js";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  LayoutChangeEvent,
} from "react";
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
  KeyboardAvoidingView,
  ScrollView,
  Keyboard,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Screen from "../../components/Screen";
import { usePhoenix } from "../../hooks/PhoenixContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { saveReminders, saveTags, saveToday } from "../../lib/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as LinkingExpo from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import { startPay, verifyPay } from "../../api/pay";
import { useUser } from "../../hooks/useUser";
import JalaliSelect from "../../components/JalaliSelect";
import { getPlanStatus } from "../../lib/plan";

const PRO_FLAG_KEY = "phoenix_is_pro";

type PlanView = "free" | "pro" | "expiring" | "expired";

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
      <View
        style={{ width: size, height: size, transform: [{ rotate: "-90deg" }] }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={track}
            strokeWidth={strokeWidth}
            fill="none"
          />
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
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
          height: size,
        }}
      >
        <Text style={{ fontWeight: "800", fontSize: 13 }}>
          {toPersianDigits(Math.round(pct))}%
        </Text>
        {!!label && (
          <Text style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ---------- NoContactCard ---------- */
function NoContactCard() {
  const { colors } = useTheme();
  const { noContactStreak, canLogNoContactToday, incNoContact, resetNoContact } =
    usePhoenix();

  const onLogToday = () => {
    const ok = incNoContact();
    if (!ok) console.log("امروز قبلاً ثبت شده است.");
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        شمارنده قطع تماس
      </Text>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
        }}
      >
        {toPersianDigits(noContactStreak)} روز
      </Text>
      <View
        style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}
      >
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
          <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
            امروز انجام شد (+۱)
          </Text>
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
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            ریست به صفر
          </Text>
        </TouchableOpacity>
      </View>
      <Text
        style={{
          fontSize: 12,
          color: "#8E8E93",
          textAlign: "center",
        }}
      >
        هر روز که تماس/چک نکردی، «امروز انجام شد» را بزن. اگر شکستی، «ریست به
        صفر».
        {canLogNoContactToday ? "" : " (امروز ثبت شده—فردا دوباره فعال می‌شود)"}
      </Text>
    </View>
  );
}

/* ---------- TechniqueStreakCard ---------- */
function TechniqueStreakCard() {
  const { colors } = useTheme();
  const { streakDays, bestStreak, incrementStreak, resetStreak } =
    usePhoenix();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        استریک تکنیک‌ها
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            {toPersianDigits(streakDays)} روز
          </Text>
          <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>
            بهترین رکورد: {toPersianDigits(bestStreak)} روز
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={incrementStreak}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              minWidth: 110,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "800" }}>
              امروز انجام شد
            </Text>
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
    {
      key: "points50",
      title: "۵۰ امتیاز",
      desc: "جمع امتیازها ≥ ۵۰",
      icon: <Ionicons name="trophy" size={20} color="#FF8A33" />,
      unlocked: points >= 50,
    },
    {
      key: "streak3",
      title: "استریک ۳ روزه",
      desc: "تکنیک‌ها ≥ ۳ روز",
      icon: <Ionicons name="flame" size={20} color="#A855F7" />,
      unlocked: streakDays >= 3,
    },
    {
      key: "nocontact3",
      title: "قطع‌تماس ۳ روزه",
      desc: "قطع تماس ≥ ۳ روز",
      icon: <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />,
      unlocked: noContactStreak >= 3,
    },
  ];

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
          امتیازها و مدال‌ها
        </Text>
        <Text style={{ fontSize: 12, color: "#8E8E93" }}>
          مجموع امتیاز:{" "}
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {toPersianDigits(points)}
          </Text>
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
            <View
              style={{
                height: 44,
                width: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 6,
              }}
            >
              {b.icon}
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {b.title}
            </Text>
            <Text
              style={{
                color: "#8E8E93",
                fontSize: 10,
                marginTop: 2,
                textAlign: "center",
              }}
            >
              {b.desc}
            </Text>
            {!b.unlocked && (
              <View
                style={{
                  marginTop: 6,
                  backgroundColor: "#E2E3E8",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#5B5D63",
                    fontWeight: "800",
                  }}
                >
                  قفل
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- EditProfileModal ---------- */
function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const {
    profileName,
    avatarUrl,
    setProfileName,
    setAvatarUrl,
    isDark,
    toggleTheme,
    setPelekanProgress,
    setDayProgress,
    resetStreak,
    resetNoContact,
    addPoints,
    points,
  } = usePhoenix();

  const { me, upsert, refresh } = useUser() as any;

  const [name, setName] = useState(me?.fullName ?? profileName);
  const [photo, setPhoto] = useState<string | null>(
    (me?.avatarUrl as string | null) ?? (avatarUrl as string | null)
  );
  const [saving, setSaving] = useState(false);

  const [gender, setGender] = useState<"male" | "female" | "other">(
    (me?.gender as any) ?? "male"
  );
  const [birthDate, setBirthDate] = useState<string | undefined>(
    (me?.birthDate as string | undefined) ?? undefined
  );

  useEffect(() => {
    if (me?.fullName) setName(me.fullName as string);
    if (me?.avatarUrl) setPhoto(me.avatarUrl as string);
    if (me?.gender) setGender(me.gender as any);
    if (me?.birthDate) setBirthDate(me.birthDate as string);
  }, [me?.fullName, me?.avatarUrl, me?.gender, me?.birthDate]);

  const safeSetPhoto = (uri: string) => {
    if (mountedRef.current) setPhoto(uri);
  };

  const scrollRef = useRef<ScrollView | null>(null);
  const [lastFocusKey, setLastFocusKey] = useState<"name" | "birth">("name");
  const posRef = useRef<{ [k: string]: number }>({});

  useEffect(() => {
    const sh = Keyboard.addListener("keyboardDidShow", () => {
      requestAnimationFrame(() => {
        const y = posRef.current[lastFocusKey] ?? 0;
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - 24),
          animated: true,
        });
      });
    });
    const hd = Keyboard.addListener("keyboardDidHide", () => {});
    return () => {
      sh.remove();
      hd.remove();
    };
  }, [lastFocusKey]);

  const onLayoutCapture =
    (key: "name" | "birth") =>
    (e: LayoutChangeEvent) => {
      posRef.current[key] = e.nativeEvent.layout.y;
    };

  const onFocusScroll = (key: "name" | "birth") => () => {
    setLastFocusKey(key);
    setTimeout(() => {
      const y = posRef.current[key] ?? 0;
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - 24),
        animated: true,
      });
    }, 80);
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "اجازه دسترسی لازم است",
          "برای انتخاب عکس از گالری، اجازهٔ دسترسی را فعال کن."
        );
        return;
      }
      const galleryMediaField =
        (ImagePicker as any).MediaType
          ? { mediaTypes: [(ImagePicker as any).MediaType.Image] }
          : {
              mediaTypes: (ImagePicker as any).MediaTypeOptions.Images,
            };

      const res = await ImagePicker.launchImageLibraryAsync({
        ...(galleryMediaField as any),
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
        selectionLimit: 1,
      });

      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) safeSetPhoto(uri);
      }
    } catch {
      Alert.alert("خطا", "هنگام باز کردن گالری مشکلی پیش آمد.");
    }
  };

  const pickFromCamera = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert(
          "اجازهٔ دوربین لازم است",
          "برای گرفتن عکس با دوربین، اجازهٔ دسترسی را فعال کن."
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [1, 1],
      });
      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) safeSetPhoto(uri);
      }
    } catch {
      Alert.alert("خطا", "هنگام باز کردن دوربین مشکلی پیش آمد.");
    }
  };

  const renderModalAvatar = () => {
    if (typeof photo === "string" && photo.startsWith("icon:")) {
      const which = photo.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "22",
            borderWidth: 1,
            borderColor: color,
          }}
        >
          <Ionicons name={iconName as any} size={60} color={color} />
        </View>
      );
    }
    const isValidUri =
      typeof photo === "string" && /^(file:|content:|https?:)/.test(photo);
    if (isValidUri) {
      return (
        <Image
          source={{ uri: photo! }}
          style={{ width: 84, height: 84, borderRadius: 42 }}
        />
      );
    }
    return (
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3B82F622",
          borderWidth: 1,
          borderColor: "#3B82F6",
        }}
      >
        <Ionicons name="person" size={60} color="#3B82F6" />
      </View>
    );
  };

  const save = async () => {
    const safeName = (name || "").trim() || "کاربر";
    const safeAvatar = photo || "icon:man";
    try {
      setSaving(true);
      const res = await upsert({
        fullName: safeName,
        avatarUrl: safeAvatar,
        gender,
        birthDate: birthDate ?? null,
      });
      if (!res.ok) {
        Alert.alert("خطا", "ثبت در سرور ناموفق بود.");
      } else {
        setProfileName(safeName);
        setAvatarUrl(safeAvatar);
        await AsyncStorage.setItem(
          "phoenix_profile",
          JSON.stringify({
            id: "",
            fullName: safeName,
            avatarUrl: safeAvatar,
          })
        );
        await refresh().catch(() => {});
      }
      onClose();
    } catch (e: any) {
      Alert.alert("خطا", e?.message || "مشکل شبکه");
    } finally {
      setSaving(false);
    }
  };

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
              await Promise.all([saveToday([]), saveReminders([]), saveTags([])]);
              setPelekanProgress(0);
              setDayProgress(0);
              resetStreak();
              resetNoContact();
              if (points > 0) addPoints(-points);
              setProfileName("کاربر");
              setAvatarUrl("icon:man");
              Alert.alert(
                "پاک‌سازی انجام شد",
                "همه‌چیز صفر شد. از نو شروع کن ✨"
              );
              onClose();
            } catch {
              Alert.alert("خطا", "در پاک‌سازی داده‌ها مشکلی پیش آمد.");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      key="edit-profile-modal"
      animationType="slide"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      hardwareAccelerated
      avoidKeyboard
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={
              (Platform.select({ ios: 8, android: 0 }) as number) || 0
            }
            style={{ maxHeight: "86%" }}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingBottom: insets.bottom + 24,
              }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: "800",
                  }}
                >
                  ویرایش پروفایل
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: "center", marginTop: 10 }}>
                {renderModalAvatar()}
              </View>

              {/* نام */}
              <View
                style={{ gap: 10, marginTop: 12 }}
                onLayout={onLayoutCapture("name")}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  نام
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(t) => mountedRef.current && setName(t)}
                  onFocus={onFocusScroll("name")}
                  placeholder="نام شما"
                  placeholderTextColor="#8E8E93"
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  textAlign={I18nManager.isRTL ? "right" : "right"}
                  returnKeyType="done"
                />
              </View>

              {/* منبع تصویر */}
              <Text
                style={{
                  marginTop: 14,
                  color: colors.text,
                  fontWeight: "700",
                }}
              >
                تصویر پروفایل
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={pickFromGallery}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: colors.border,
                      flexDirection: "row",
                      gap: 6,
                    },
                  ]}
                >
                  <Ionicons
                    name="images-outline"
                    size={18}
                    color={colors.text}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                    }}
                  >
                    از گالری
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromCamera}
                  style={[
                    styles.secondaryBtn,
                    {
                      borderColor: colors.border,
                      flexDirection: "row",
                      gap: 6,
                    },
                  ]}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color={colors.text}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                    }}
                  >
                    دوربین
                  </Text>
                </TouchableOpacity>
              </View>

              {/* آیکن مرد / زن */}
              <Text
                style={{
                  marginTop: 12,
                  marginBottom: 6,
                  color: colors.text,
                  fontWeight: "700",
                }}
              >
                یا انتخاب آیکن
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 14,
                  justifyContent: "center",
                }}
              >
                {(["man", "woman"] as const).map((which) => {
                  const selected = photo === `icon:${which}`;
                  const color = which === "woman" ? "#A855F7" : "#3B82F6";
                  return (
                    <TouchableOpacity
                      key={which}
                      onPress={() =>
                        mountedRef.current && setPhoto(`icon:${which}`)
                      }
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

              {/* جنسیت */}
              <Text
                style={{
                  marginTop: 16,
                  color: colors.text,
                  fontWeight: "700",
                }}
              >
                جنسیت
              </Text>
              <View
                style={{
                  flexDirection: "row-reverse",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                {[
                  { key: "male", label: "مرد", icon: "male" },
                  { key: "female", label: "زن", icon: "female" },
                  { key: "other", label: "سایر", icon: "person" },
                ].map((g) => {
                  const selected = gender === (g.key as any);
                  return (
                    <TouchableOpacity
                      key={g.key}
                      onPress={() => setGender(g.key as any)}
                      activeOpacity={0.85}
                      style={{
                        flex: 1,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: selected
                          ? "#ECFEFF"
                          : colors.background,
                        borderWidth: 2,
                        borderColor: selected ? colors.primary : colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <Ionicons
                        name={g.icon as any}
                        size={18}
                        color={selected ? colors.primary : "#8E8E93"}
                      />
                      <Text
                        style={{
                          color: selected ? colors.primary : colors.text,
                          fontWeight: "800",
                        }}
                      >
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* تاریخ تولد */}
              <View style={{ marginTop: 16 }} onLayout={onLayoutCapture("birth")}>
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                  }}
                >
                  تاریخ تولد (اختیاری)
                </Text>
                <View style={{ marginTop: 6 }}>
                  <JalaliSelect
                    initial={birthDate}
                    onChange={(iso) => setBirthDate(iso)}
                    minYear={1330}
                    maxYear={1390}
                    grid
                    styleContainer={{
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      minHeight: 56,
                      borderRadius: 12,
                    }}
                    stylePicker={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }}
                    textColor={colors.text}
                    accentColor={colors.primary}
                    dark
                  />
                </View>
                {!!birthDate && (
                  <Text
                    style={{
                      color: "#B8BBC2",
                      fontSize: 12,
                      marginTop: 6,
                    }}
                  >
                    تاریخ انتخابی (میلادی):{" "}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "800",
                      }}
                    >
                      {birthDate}
                    </Text>
                  </Text>
                )}
              </View>

              {/* حالت تیره */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 14,
                }}
              >
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    حالت تیره
                  </Text>
                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    ظاهر اپلیکیشن
                  </Text>
                </View>
                <Switch value={isDark} onValueChange={toggleTheme} />
              </View>

              {/* شروع از صفر */}
              <View style={{ marginTop: 14 }}>
                <TouchableOpacity
                  onPress={confirmResetAll}
                  style={{
                    borderWidth: 1,
                    borderColor: "#ef4444",
                    backgroundColor:
                      Platform.OS === "ios" ? "#ef444420" : "#ef444410",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="trash-bin-outline"
                    size={18}
                    color="#ef4444"
                  />
                  <Text
                    style={{
                      color: "#ef4444",
                      fontWeight: "800",
                    }}
                  >
                    شروع از صفر (پاک‌سازی کامل)
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    color: "#8E8E93",
                    fontSize: 11,
                    textAlign: "center",
                    marginTop: 6,
                  }}
                >
                  با این کار تمام تمرین‌ها، برنامه‌ها، یادآورها، تگ‌ها و
                  امتیازها صفر می‌شود.
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <TouchableOpacity
                  onPress={save}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: colors.primary },
                  ]}
                  disabled={saving}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "800",
                    }}
                  >
                    {saving ? "در حال ذخیره…" : "ذخیره"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.secondaryBtn,
                    { borderColor: colors.border },
                  ]}
                  disabled={saving}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "800",
                    }}
                  >
                    انصراف
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
        دربارهٔ برنامه
      </Text>
      <Text style={{ color: "#8E8E93", fontSize: 12 }}>
        ققنوس — ابزار خودیاری و رشد فردی.
      </Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 12 }}>
          نسخه: {toPersianDigits(version)}
        </Text>
        <TouchableOpacity
          onPress={openSite}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <Text
            style={{
              color: colors.primary,
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            وب‌سایت
          </Text>
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
    setProfileName,
    setAvatarUrl,
  } = usePhoenix();
  const router = useRouter();
  const { phone, isAuthenticated, signOut } = useAuth();
  const { me, refresh } = useUser() as any;

  // پرداخت
  const payingRef = useRef(false);

  const openProPay = async () => {
    if (payingRef.current) return;
    try {
      payingRef.current = true;
      if (!phone) {
        Alert.alert("نیاز به ورود", "با شماره موبایل وارد شو.");
        payingRef.current = false;
        return;
      }
      const start = await startPay({ phone: phone!, amount: 199000 });
      if (!(start as any)?.gatewayUrl) {
        payingRef.current = false;
        Alert.alert("خطا", "gatewayUrl دریافت نشد.");
        return;
      }
      const gatewayUrl = (start as any).gatewayUrl;
      const redirectUrl = makeRedirectUri({ path: "pay" });
      const sub = LinkingExpo.addEventListener("url", async (ev) => {
        try {
          const u = LinkingExpo.parse(ev.url);
          const qAuthority = String(
            (u.queryParams as any)?.Authority ||
              (u.queryParams as any)?.authority ||
              ""
          );
          const qStatus = String(
            (u.queryParams as any)?.Status ||
              (u.queryParams as any)?.status ||
              ""
          );
          if (!qAuthority) return;
          const ver = await verifyPay({
            authority: qAuthority,
            status: (qStatus || "NOK") as any,
            phone: phone!,
            amount: 199000,
          });
          if (!(ver as any)?.ok) {
            Alert.alert(
              "ناموفق",
              String((ver as any).error || "VERIFY_FAILED")
            );
            return;
          }
          const refId =
            (ver as any).refId || (ver as any).data?.refId || "—";
          Alert.alert("پرداخت موفق", `کد رهگیری:\n${refId}`);
          await refresh().catch(() => {});
        } finally {
          sub.remove();
          payingRef.current = false;
        }
      });
      await WebBrowser.openBrowserAsync(
        `${gatewayUrl}?cb=${encodeURIComponent(redirectUrl)}`
      );
    } catch (e: any) {
      payingRef.current = false;
      Alert.alert("خطا", e?.message || "اشکال در پرداخت");
    }
  };

  // وضعیت پلن: مثل پلکان
  const [planView, setPlanView] = useState<PlanView>("free");
  const [expiringDaysLeft, setExpiringDaysLeft] = useState<number | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);

  const syncPlanView = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(PRO_FLAG_KEY);
      const status = getPlanStatus(me);
      const flagIsPro = flag === "1";

      let view: PlanView = "free";
      let expDays: number | null = null;

      if (status.rawExpiresAt) {
        if (status.isExpired) {
          view = "expired";
          expDays = 0;
        } else if (status.isPro || flagIsPro) {
          const d =
            typeof status.daysLeft === "number" ? status.daysLeft : null;
          if (d != null && d > 0 && d <= 7) {
            view = "expiring";
            expDays = d;
          } else {
            view = "pro";
            expDays = d;
          }
        } else {
          view = "free";
        }
      } else {
        if (status.isPro || flagIsPro) {
          view = "pro";
        } else {
          view = "free";
        }
      }

      setPlanView(view);
      setExpiringDaysLeft(expDays);

      console.log("PHOENIX PLAN", {
        plan: status.rawPlan,
        rawExpiresAt: status.rawExpiresAt,
        isExpired: status.isExpired,
        daysLeft: status.daysLeft,
        flag,
        planView: view,
        expiringDaysLeft: expDays,
      });
    } catch (e) {
      console.log("PHOENIX PLAN ERR", e);
      setPlanView("free");
      setExpiringDaysLeft(null);
    } finally {
      setPlanLoaded(true);
    }
  }, [me]);

  useEffect(() => {
    refresh().catch(() => {});
    syncPlanView();
  }, [refresh, syncPlanView]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
      syncPlanView();
      return () => {};
    }, [refresh, syncPlanView])
  );

  // سینک نام/آواتار با سرور
  useEffect(() => {
    if (me?.fullName && me.fullName !== profileName)
      setProfileName(me.fullName as string);
    if (me?.avatarUrl && me.avatarUrl !== avatarUrl)
      setAvatarUrl(me.avatarUrl as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.fullName, me?.avatarUrl]);

  const [editVisible, setEditVisible] = useState(false);
  useEffect(() => {
    return () => setEditVisible(false);
  }, []);

  const g = new Date();
  const { jy, jm, jd } = toJalaali(g);
  const weekdays = [
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنجشنبه",
    "جمعه",
    "شنبه",
  ];
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
  const dateText = `${weekdays[g.getDay()]} ${toPersianDigits(
    jd
  )} ${months[jm - 1]} ${toPersianDigits(jy)}`;

  const bumpPelekan = () => setPelekanProgress(pelekanProgress + 5);
  const bumpDay = () => setDayProgress(dayProgress + 10);

  const onDoneTechnique = () => {
    incrementStreak();
    addPoints(10);
    setDayProgress(Math.min(100, dayProgress + 20));
  };

  const renderProfileAvatar = () => {
    if (typeof avatarUrl === "string" && avatarUrl.startsWith("icon:")) {
      const which = avatarUrl.split(":")[1];
      const iconName = which === "woman" ? "woman" : "man";
      const color = which === "woman" ? "#A855F7" : "#3B82F6";
      return (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color + "22",
            borderWidth: 1,
            borderColor: color,
          }}
        >
          <Ionicons name={iconName as any} size={44} color={color} />
        </View>
      );
    }
    const isValidUri =
      typeof avatarUrl === "string" &&
      /^(file:|content:|https?:)/.test(avatarUrl);
    if (isValidUri) {
      return (
        <Image
          source={{ uri: avatarUrl! }}
          style={{ width: 64, height: 64, borderRadius: 32 }}
        />
      );
    }
    return (
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#3B82F622",
          borderWidth: 1,
          borderColor: "#3B82F6",
        }}
      >
        <Ionicons name="person" size={44} color="#3B82F6" />
      </View>
    );
  };

  async function onSignOut() {
    try {
      if (editVisible) {
        setEditVisible(false);
        await new Promise((r) => setTimeout(r, 0));
      }
      await signOut();
      router.replace("/(auth)/login");
    } catch (e: any) {
      Alert.alert("خطا", e?.message || "خروج ناموفق بود.");
    }
  }

  // دیباگ پلن در خود تب ققنوس
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugPlanView, setDebugPlanView] = useState<PlanView>("free");
  const [debugDaysLeft, setDebugDaysLeft] = useState<number | null>(3);

  const uiPlanView: PlanView = debugEnabled ? debugPlanView : planView;
  const uiDaysLeft: number | null = debugEnabled
    ? debugDaysLeft
    : expiringDaysLeft;

  const isProLikePlan =
    uiPlanView === "pro" || uiPlanView === "expiring";

  // استایل بج مثل پلکان
  const badgeBg =
    uiPlanView === "pro"
      ? "#F59E0B"
      : uiPlanView === "expiring"
      ? "#F97316"
      : uiPlanView === "expired"
      ? "#DC2626"
      : "#4B5563";

  const badgeLabel =
    uiPlanView === "pro" || uiPlanView === "expiring"
      ? "PRO"
      : uiPlanView === "expired"
      ? "EXPIRED"
      : "FREE";

  const showExpiring =
    uiPlanView === "expiring" && uiDaysLeft != null && uiDaysLeft > 0;

  console.log("PHOENIX RENDER", {
    mePlan: me?.plan,
    planView,
    expiringDaysLeft,
    debugEnabled,
    debugPlanView,
    debugDaysLeft,
    uiPlanView,
    uiDaysLeft,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={colors.background}
        animated
      />

      <Screen
        contentContainerStyle={{
          rowGap: 12,
          direction: rtl ? "rtl" : "ltr",
        }}
        backgroundColor={colors.background}
      >
        {/* هدر بالا */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: colors.text,
              }}
            >
              سلام، {profileName}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#8E8E93",
                marginTop: 2,
              }}
            >
              {dateText}
            </Text>
          </View>
        </View>

        {/* پنل دیباگ پلن مخصوص تب ققنوس */}
        {__DEV__ && (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: colors.card,
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  fontWeight: "700",
                }}
              >
                DEBUG PLAN — Phoenix tab
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: debugEnabled ? colors.primary : "#9ca3af",
                  }}
                >
                  {debugEnabled ? "فعال" : "خاموش"}
                </Text>
                <Switch
                  value={debugEnabled}
                  onValueChange={setDebugEnabled}
                />
              </View>
            </View>

            <Text
              style={{
                fontSize: 10,
                color: "#6b7280",
              }}
            >
              {`serverPlan=${me?.plan ?? "none"} | planView=${planView} | daysLeft=${expiringDaysLeft ?? "-"} | debugView=${debugPlanView} | debugDays=${debugDaysLeft ?? "-"} | uiView=${uiPlanView}`}
            </Text>

            {debugEnabled && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {(["free", "pro", "expiring", "expired"] as PlanView[]).map(
                    (pv) => {
                      const selected = debugPlanView === pv;
                      return (
                        <TouchableOpacity
                          key={pv}
                          onPress={() => setDebugPlanView(pv)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                            backgroundColor: selected
                              ? colors.primary + "22"
                              : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.text,
                              fontWeight: "700",
                            }}
                          >
                            {pv}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                {debugPlanView === "expiring" && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                      }}
                    >
                      روز باقی‌مانده (برای تست expiring):
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 4,
                      }}
                    >
                      {[1, 2, 3, 5, 7].map((n) => {
                        const sel = debugDaysLeft === n;
                        return (
                          <TouchableOpacity
                            key={n}
                            onPress={() => setDebugDaysLeft(n)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: sel
                                ? colors.primary
                                : colors.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.text,
                              }}
                            >
                              {toPersianDigits(n)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* کارت پروفایل */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            {renderProfileAvatar()}

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  {profileName}
                </Text>

                {/* بج پلن مثل پلکان */}
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: badgeBg,
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontWeight: "900",
                      fontSize: 11,
                    }}
                  >
                    {badgeLabel}
                  </Text>
                </View>

                {showExpiring && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#F97316",
                      fontWeight: "900",
                    }}
                  >
                    {toPersianDigits(uiDaysLeft!)} روز تا پایان اشتراک
                  </Text>
                )}
              </View>

              {/* اینجا دیگه متن «پروفایل ناقص / استریک‌ها» که گفته بودی، حذف شده */}
            </View>
          </View>

          {/* دکمه‌ها */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/Subscription")}
              activeOpacity={0.8}
              style={{
                backgroundColor: isProLikePlan ? "#0f766e" : "#10b981",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="card" size={16} color="#fff" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {isProLikePlan ? "مدیریت / تمدید اشتراک" : "ارتقا به PRO"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEditVisible(true)}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name="create" size={16} color="#fff" />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                ویرایش
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* نمودار پیشرفت */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: colors.text,
            }}
          >
            نمودار پیشرفت
          </Text>

          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space_between" as any,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                پیشرفت پلکان
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#8E8E93",
                }}
              >
                {toPersianDigits(pelekanProgress)}٪
              </Text>
            </View>
            <ProgressBar
              value={pelekanProgress}
              color={colors.primary}
              track={colors.border}
            />
            <TouchableOpacity
              onPress={bumpPelekan}
              style={{
                alignSelf: "flex-end",
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                +۵٪ تست
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space_between" as any,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                پیشرفت امروز
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#8E8E93",
                }}
              >
                {toPersianDigits(dayProgress)}٪
              </Text>
            </View>
            <ProgressBar
              value={dayProgress}
              color={colors.primary}
              track={colors.border}
            />
            <TouchableOpacity
              onPress={bumpDay}
              style={{
                alignSelf: "flex-end",
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                +۱۰٪ تست
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <CircularGauge
              value={pelekanProgress}
              label="پلکان"
              color={colors.primary}
              track={colors.border}
              size={72}
              strokeWidth={7}
            />
            <CircularGauge
              value={dayProgress}
              label="امروز"
              color={colors.primary}
              track={colors.border}
              size={72}
              strokeWidth={7}
            />
            <View style={{ width: 72 }} />
          </View>
        </View>

        <NoContactCard />
        <TechniqueStreakCard />
        <BadgesCard />
        <AboutCard />

        {/* خروج */}
        <TouchableOpacity
          onPress={onSignOut}
          style={{
            backgroundColor: "#ef4444",
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
          }}
          activeOpacity={0.85}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "800",
            }}
          >
            خروج از حساب
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDoneTechnique}
          style={{
            backgroundColor: colors.text,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
          }}
          activeOpacity={0.8}
        >
          <Text
            style={{
              color: colors.background,
              fontWeight: "800",
            }}
          >
            ✅ انجام یک تکنیک (تست)
          </Text>
        </TouchableOpacity>
      </Screen>

      {editVisible && <EditProfileModal onClose={() => setEditVisible(false)} />}
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