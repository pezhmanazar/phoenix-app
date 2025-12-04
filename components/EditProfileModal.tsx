// components/EditProfileModal.tsx
import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  I18nManager,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { usePhoenix } from "../hooks/PhoenixContext";
import { useUser } from "../hooks/useUser";
import { useAuth } from "../hooks/useAuth";
import JalaliSelect from "./JalaliSelect";
import { saveReminders, saveTags, saveToday } from "../lib/storage";
import { upsertUserByPhone } from "../api/user";

type Props = {
  onClose: () => void;
};

// 🔹 آواتارهای آماده
const PRESET_AVATARS: { id: string; src: any }[] = [
  { id: "avatar:phoenix", src: require("../assets/avatars/phoenix.png") },
  { id: "avatar:1", src: require("../assets/avatars/man1.png") },
  { id: "avatar:2", src: require("../assets/avatars/woman1.png") },
  { id: "avatar:3", src: require("../assets/avatars/man2.png") },
  { id: "avatar:4", src: require("../assets/avatars/woman2.png") },
  { id: "avatar:5", src: require("../assets/avatars/neutral1.png") },
  { id: "avatar:6", src: require("../assets/avatars/neutral2.png") },
];

const getPresetAvatarSource = (id: string | null) => {
  if (!id) return null;
  const found = PRESET_AVATARS.find((a) => a.id === id);
  return found?.src ?? null;
};

// نرمال‌سازی آواتار (جلوگیری از رشته‌ی خالی و null)
const normalizeAvatar = (v?: string | null) =>
  v && typeof v === "string" && v.trim().length > 0 ? v : null;

const EditProfileModal: React.FC<Props> = ({ onClose }) => {
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

  const { me, refresh } = useUser() as any;
  const { phone } = useAuth();

  // ✅ مقدار اولیه آواتار با فالس‌بک روی ققنوس
  const initialAvatar =
    normalizeAvatar(me?.avatarUrl as string | null) ??
    normalizeAvatar(avatarUrl as string | null) ??
    "avatar:phoenix";

  const [name, setName] = useState<string>(me?.fullName ?? profileName);
  const [photo, setPhoto] = useState<string | null>(initialAvatar);
  const [saving, setSaving] = useState(false);

  const [gender, setGender] = useState<"male" | "female" | "other">(
    (me?.gender as any) ?? "male"
  );
  const [birthDate, setBirthDate] = useState<string | undefined>(
    (me?.birthDate as string | undefined) ?? undefined
  );

  // اگر هیچ آواتاری توی سرور و کانتکست نبود، یک بار ققنوس را به عنوان پیش‌فرض ست کن
  useEffect(() => {
    const normalizedMe = normalizeAvatar(me?.avatarUrl as string | null);
    const normalizedCtx = normalizeAvatar(avatarUrl as string | null);

    if (!normalizedMe && !normalizedCtx) {
      if (photo !== "avatar:phoenix") {
        setPhoto("avatar:phoenix");
      }
      if (avatarUrl !== "avatar:phoenix") {
        setAvatarUrl("avatar:phoenix");
      }
    }
  }, [me?.avatarUrl, avatarUrl, photo, setAvatarUrl]);

  useEffect(() => {
    if (me?.fullName) setName(me.fullName as string);
    if (me?.avatarUrl) setPhoto(me.avatarUrl as string);
    if (me?.gender) setGender(me.gender as any);
    if (me?.birthDate) setBirthDate(me.birthDate as string);
  }, [me?.fullName, me?.avatarUrl, me?.gender, me?.birthDate]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("phoenix_profile");
        if (!raw) return;
        const p = JSON.parse(raw);

        if (!me?.fullName && p.fullName) setName(p.fullName);
        if (!me?.avatarUrl && p.avatarUrl) {
          const norm = normalizeAvatar(p.avatarUrl);
          setPhoto(norm ?? "avatar:phoenix");
          if (!avatarUrl && norm) setAvatarUrl(norm);
        }
        if (!me?.gender && p.gender) setGender(p.gender as any);
        if (!me?.birthDate && p.birthDate) setBirthDate(p.birthDate as string);
      } catch {
        // ignore
      }
    })();
  }, [me?.fullName, me?.avatarUrl, me?.gender, me?.birthDate, avatarUrl, setAvatarUrl]);

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
          : { mediaTypes: (ImagePicker as any).MediaTypeOptions.Images };

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

  // 🖼 آواتار بالای صفحه
  const renderModalAvatar = () => {
    const current = photo || "avatar:phoenix";

    // اگر از آواتارهای آماده بود
    if (current.startsWith("avatar:")) {
      const src = getPresetAvatarSource(current);
      if (src) {
        return (
          <Image
            source={src}
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              borderWidth: 2,
              borderColor: "#FACC15",
            }}
          />
        );
      }
    }

    // مقادیر قدیمی icon:man / icon:woman
    if (typeof current === "string" && current.startsWith("icon:")) {
      const which = current.split(":")[1];
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

    // اگر URI عکس کاربر بود
    const isValidUri =
      typeof current === "string" && /^(file:|content:|https?:)/.test(current);
    if (isValidUri) {
      return (
        <Image
          source={{ uri: current }}
          style={{ width: 84, height: 84, borderRadius: 42 }}
        />
      );
    }

    // فالس‌بک ققنوس
    const phoenixSrc = getPresetAvatarSource("avatar:phoenix");
    if (phoenixSrc) {
      return (
        <Image
          source={phoenixSrc}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderWidth: 2,
            borderColor: "#FACC15",
          }}
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
    const safeAvatar = photo || "avatar:phoenix"; // ✅ پیش‌فرض ققنوس

    if (!phone) {
      Alert.alert("خطا", "شماره موبایل پیدا نشد. دوباره وارد شو.");
      return;
    }

    try {
      setSaving(true);

      const body = {
        fullName: safeName,
        avatarUrl: safeAvatar,
        gender,
        birthDate: birthDate ?? null,
        profileCompleted: true,
      };

      const res = await upsertUserByPhone(phone, body);

      if (!res.ok) {
        Alert.alert("خطا", res.error || "ثبت در سرور ناموفق بود.");
      } else {
        setProfileName(safeName);
        setAvatarUrl(safeAvatar);

        await AsyncStorage.setItem(
          "phoenix_profile",
          JSON.stringify({
            id: me?.id ?? "",
            fullName: safeName,
            avatarUrl: safeAvatar,
            gender,
            birthDate: birthDate ?? null,
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
              await Promise.all([
                saveToday([]),
                saveReminders([]),
                saveTags([]),
              ]);
              setPelekanProgress(0);
              setDayProgress(0);
              resetStreak();
              resetNoContact();
              if (points > 0) addPoints(-points);
              setProfileName("کاربر");
              setAvatarUrl("avatar:phoenix");
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
              {/* هدر */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <View style={{ width: 32 }} />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={22}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign: "center",
                    }}
                  >
                    ویرایش پروفایل
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: "center", marginTop: 4 }}>
                {renderModalAvatar()}
              </View>

              {/* نام */}
              <View
                style={{ gap: 10, marginTop: 16 }}
                onLayout={onLayoutCapture("name")}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 12,
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    نام
                  </Text>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={colors.text}
                  />
                </View>
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

              {/* تصویر پروفایل (گالری / دوربین) */}
              <View style={{ marginTop: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    تصویر پروفایل
                  </Text>
                  <Ionicons
                    name="image-outline"
                    size={16}
                    color={colors.text}
                  />
                </View>

                <View
                  style={{ flexDirection: "row", gap: 10, marginTop: 8 }}
                >
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
              </View>

              {/* آواتارهای آماده: ۴ تا بالا، ۳ تا پایین */}
              <View style={{ marginTop: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    آواتارهای آماده
                  </Text>
                  <Ionicons
                    name="sparkles-outline"
                    size={16}
                    color={colors.text}
                  />
                </View>

                {/* ردیف اول (۴ تا) */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  {PRESET_AVATARS.slice(0, 4).map((av) => {
                    const selected = (photo || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity
                        key={av.id}
                        onPress={() => setPhoto(av.id)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                          }}
                        >
                          <Image
                            source={av.src}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ردیف دوم (۳ تا) */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-evenly",
                  }}
                >
                  {PRESET_AVATARS.slice(4).map((av) => {
                    const selected = (photo || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity
                        key={av.id}
                        onPress={() => setPhoto(av.id)}
                        activeOpacity={0.85}
                      >
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                          }}
                        >
                          <Image
                            source={av.src}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* جنسیت */}
              <View style={{ marginTop: 18 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    جنسیت
                  </Text>
                  <Ionicons
                    name="male-female-outline"
                    size={16}
                    color={colors.text}
                  />
                </View>

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
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
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
              </View>

              {/* تاریخ تولد */}
              <View
                style={{ marginTop: 18 }}
                onLayout={onLayoutCapture("birth")}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-end",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      textAlign: "right",
                    }}
                  >
                    تاریخ تولد (اختیاری)
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.text}
                  />
                </View>

                <JalaliSelect
                  key={birthDate || "no-birth"}
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

                {!!birthDate && (
                  <Text
                    style={{
                      color: "#B8BBC2",
                      fontSize: 12,
                      marginTop: 6,
                      textAlign: "right",
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

              {/* حالت روشن */}
              <View
                style={{
                  flexDirection: "row-reverse",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 18,
                }}
              >
                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    حالت روشن
                  </Text>
                  <Text
                    style={{
                      color: "#8E8E93",
                      fontSize: 12,
                      marginTop: 2,
                      textAlign: "right",
                    }}
                  >
                    فعال کردن تم روشن اپلیکیشن
                  </Text>
                </View>
                <Switch value={!isDark} onValueChange={toggleTheme} />
              </View>

              {/* شروع از صفر */}
              <View style={{ marginTop: 18 }}>
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

              {/* دکمه‌ها */}
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
};

export default EditProfileModal;

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