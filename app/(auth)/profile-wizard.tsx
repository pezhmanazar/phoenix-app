// app/(auth)/profile-wizard.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "../../hooks/useAuth";
import { upsertUserByPhone, getMeByPhone } from "../../api/user";
import JalaliSelect from "../../components/JalaliSelect";
import { usePhoenix } from "../../hooks/PhoenixContext";
import type { UserRecord } from "../../api/user";
import { useUser } from "../../hooks/useUser";

type Gender = "male" | "female" | "other";

/* ---------------- Colors / Tokens (Orange theme) ---------------- */
const P = {
  pageBg: "#05070C",
  cardBg: "#0B0F16",
  textDark: "#FFFFFF",
  textMuted: "#9AA0A6",
  border: "#262B33",
  inputBg: "#111827",
  primary: "#FF6A00",
  primaryDark: "#CC5600",
  primarySoft: "#FFE6D5",
};
const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 8 },
});

/* ---------------- Avatar presets (همسان با EditProfile / Phoenix) ---------------- */
const PRESET_AVATARS: { id: string; src: any }[] = [
  { id: "avatar:phoenix", src: require("../../assets/avatars/phoenix.png") },
  { id: "avatar:1", src: require("../../assets/avatars/man1.png") },
  { id: "avatar:2", src: require("../../assets/avatars/woman1.png") },
  { id: "avatar:3", src: require("../../assets/avatars/man2.png") },
  { id: "avatar:4", src: require("../../assets/avatars/woman2.png") },
  { id: "avatar:5", src: require("../../assets/avatars/neutral1.png") },
  { id: "avatar:6", src: require("../../assets/avatars/neutral2.png") },
];

const getPresetAvatarSource = (id: string | null) => {
  if (!id) return null;
  const found = PRESET_AVATARS.find((a) => a.id === id);
  return found?.src ?? null;
};

export default function ProfileWizard() {
  const { phone } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { setProfileName, setAvatarUrl } = usePhoenix();
  const { refresh } = useUser() as any;

  const [fullName, setFullName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState<string | undefined>(undefined); // yyyy-mm-dd
  const [avatarUrl, setAvatarUrlState] = useState<string>("avatar:phoenix");
  const [saving, setSaving] = useState(false);

  const mounted = useRef(true);
  const submittingRef = useRef(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // اگر قبلاً پروفایل تکمیل شده (فلگ محلی)، همین ابتدا برو تب‌ها
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem("profile_completed_flag");
        if (__DEV__) console.log("[profile-wizard] local flag =", flag);
        if (flag === "1" && !redirectedRef.current) {
          redirectedRef.current = true;
          if (__DEV__) console.log("[profile-wizard] redirect via local flag");
          router.replace("/(tabs)");
        }
      } catch (e) {
        if (__DEV__) console.log("[profile-wizard] local flag error:", e);
      }
    })();
  }, [router]);

  // پیش‌پر کردن فیلدها از سرور (بر اساس شماره)
  useEffect(() => {
    if (!phone || redirectedRef.current) return;
    (async () => {
      try {
        const r = await getMeByPhone(phone);
        if (__DEV__) console.log("[profile-wizard] getMeByPhone →", r);

        if (r.ok && r.data) {
          const d = r.data as any;

          if (d.profileCompleted === true && !redirectedRef.current) {
            await AsyncStorage.setItem("profile_completed_flag", "1");
            redirectedRef.current = true;
            if (__DEV__) console.log("[profile-wizard] redirect via server flag");
            router.replace("/(tabs)");
            return;
          }

          if (d.fullName) setFullName(String(d.fullName));
          if (d.gender) setGender(d.gender as Gender);
          if (d.birthDate) setBirthDate(String(d.birthDate));

          let safeAvatar: string | null =
            (d.avatarUrl as string | undefined) ??
            (avatarUrl || undefined) ??
            null;

          if (!safeAvatar && d.gender) {
            safeAvatar =
              d.gender === "male"
                ? "icon:male"
                : d.gender === "female"
                ? "icon:female"
                : "avatar:phoenix";
          }
          if (!safeAvatar) safeAvatar = "avatar:phoenix";

          setAvatarUrlState(safeAvatar);

          const safeName = (d.fullName as string) || "کاربر";

          setProfileName(safeName);
          setAvatarUrl(safeAvatar);

          await AsyncStorage.setItem(
            "phoenix_profile",
            JSON.stringify({
              id: d.id ?? "",
              fullName: safeName,
              avatarUrl: safeAvatar ?? null,
              gender: d.gender ?? null,
              birthDate: d.birthDate ?? null,
            })
          );
        }
      } catch (e) {
        if (__DEV__) console.log("[profile-wizard] getMeByPhone error:", e);
      }
    })();
  }, [phone, router, setAvatarUrl, setProfileName, avatarUrl]);

  /* ---------------- Image Pickers ---------------- */
  async function ensureMediaPermission() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("اجازه لازم است", "برای انتخاب عکس، دسترسی گالری را فعال کن.");
      return false;
    }
    return true;
  }
  async function ensureCameraPermission() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("اجازه لازم است", "برای عکس‌برداری، دسترسی دوربین را فعال کن.");
      return false;
    }
    return true;
  }

  const pickFromGallery = async () => {
    try {
      const ok = await ensureMediaPermission();
      if (!ok) return;
      const mediaField =
        (ImagePicker as any).MediaType
          ? { mediaTypes: [(ImagePicker as any).MediaType.Image] }
          : { mediaTypes: (ImagePicker as any).MediaTypeOptions.Images };

      const res = await ImagePicker.launchImageLibraryAsync({
        ...mediaField,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        selectionLimit: 1,
      });

      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) setAvatarUrlState(uri);
      }
    } catch (e) {
      if (__DEV__) console.log("pickFromGallery error:", e);
      Alert.alert("خطا", "در باز کردن گالری مشکلی پیش آمد.");
    }
  };

  const pickFromCamera = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!res.canceled) {
        const uri = (res as any).assets?.[0]?.uri;
        if (uri) setAvatarUrlState(uri);
      }
    } catch (e) {
      if (__DEV__) console.log("pickFromCamera error:", e);
      Alert.alert("خطا", "در باز کردن دوربین مشکلی پیش آمد.");
    }
  };

  /* ---------------- Avatar (نمایش) ---------------- */
  const Avatar = () => {
    const current =
      (typeof avatarUrl === "string" && avatarUrl.trim().length > 0
        ? avatarUrl
        : null) || "avatar:phoenix";

    if (current.startsWith("avatar:")) {
      const src = getPresetAvatarSource(current);
      if (src) {
        return (
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: P.cardBg,
              borderWidth: 3,
              borderColor: P.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={src}
              style={{ width: 96, height: 96, borderRadius: 48 }}
              resizeMode="cover"
            />
          </View>
        );
      }
    }

    if (typeof current === "string" && current.startsWith("icon:")) {
      const which = current.split(":")[1];
      const color =
        which === "female" ? "#A855F7" : which === "male" ? "#3B82F6" : P.primary;
      const IconName =
        which === "other" ? "account" : (which as "female" | "male");
      return (
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: P.cardBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 3,
            borderColor: P.primarySoft,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: P.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              borderColor: P.primary,
              borderWidth: 2,
            }}
          >
            {IconName === "account" ? (
              <MaterialCommunityIcons name="account" size={52} color={color} />
            ) : (
              <Ionicons name={IconName as any} size={52} color={color} />
            )}
          </View>
        </View>
      );
    }

    const valid =
      typeof current === "string" && /^(file:|content:|https?:)/.test(current);
    if (valid) {
      return (
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: P.cardBg,
            borderWidth: 3,
            borderColor: P.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: current }}
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
        </View>
      );
    }

    const phoenixSrc = getPresetAvatarSource("avatar:phoenix");
    if (phoenixSrc) {
      return (
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: P.cardBg,
            borderWidth: 3,
            borderColor: P.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={phoenixSrc}
            style={{ width: 96, height: 96, borderRadius: 48 }}
            resizeMode="cover"
          />
        </View>
      );
    }

    return (
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: P.cardBg,
          borderWidth: 3,
          borderColor: P.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="person" size={52} color={P.textMuted} />
      </View>
    );
  };

  /* ---------------- Validation ---------------- */
  const validate = () => {
    const n = (fullName || "").trim();
    if (n.length < 2)
      return Alert.alert("خطا", "نام و نام خانوادگی را کامل وارد کن."), false;
    if (!gender) return Alert.alert("خطا", "جنسیت را انتخاب کن."), false;
    return true;
  };

  /* ---------------- Submit ---------------- */
  const onSubmit = async () => {
    if (!phone) return Alert.alert("خطا", "شماره یافت نشد؛ دوباره وارد شو.");
    if (submittingRef.current) return;
    if (!validate()) return;

    const safeName = (fullName || "").trim();
const safeAvatar = avatarUrl || "avatar:phoenix";

const body: Partial<UserRecord> = {
  fullName: safeName,
  gender: gender ?? null,          // ✅ بدون as string
  birthDate: birthDate || null,
  avatarUrl: safeAvatar,
  plan: "free",
  profileCompleted: true,
  lastLoginAt: new Date().toISOString(),
};

    try {
      submittingRef.current = true;
      setSaving(true);
      if (__DEV__)
        console.log("[profile-wizard] upsert by phone →", phone, body);

      let r = await upsertUserByPhone(phone, body);
      if (!r.ok && /NOT_FOUND|404/i.test(String(r.error))) {
        r = await upsertUserByPhone(phone, body);
      }
      if (!r.ok) {
        submittingRef.current = false;
        setSaving(false);
        return Alert.alert("خطا", r.error || "HTTP_400");
      }

      await AsyncStorage.setItem("profile_completed_flag", "1");

      const meResp = await getMeByPhone(phone).catch(
        () => ({ ok: false } as any)
      );

      if ((meResp as any).ok && (meResp as any).data) {
        const d = (meResp as any).data as any;

        const finalName = (d.fullName as string) || safeName || "کاربر";
        const finalAvatar: string =
          (d.avatarUrl as string | undefined) ||
          safeAvatar ||
          "avatar:phoenix";

        setProfileName(finalName);
        setAvatarUrl(finalAvatar);

        await AsyncStorage.setItem(
          "phoenix_profile",
          JSON.stringify({
            id: d.id ?? "",
            fullName: finalName,
            avatarUrl: finalAvatar,
            gender: d.gender ?? gender ?? null,
            birthDate: d.birthDate ?? birthDate ?? null,
          })
        );
      }

      await refresh().catch(() => {});

      if (!redirectedRef.current) {
        redirectedRef.current = true;
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      Alert.alert("خطا", e?.message || "مشکل شبکه");
    } finally {
      if (mounted.current) setSaving(false);
      submittingRef.current = false;
    }
  };

  /* ---- helper برای تأیید نام ---- */
  const confirmName = () => {
    Keyboard.dismiss();
    if ((fullName || "").trim().length > 0) {
      setNameConfirmed(true);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.pageBg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined} // ⬅️ فقط iOS
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 24,
            alignItems: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "92%",
              marginTop: 16,
              borderRadius: 28,
              backgroundColor: P.cardBg,
              ...shadow,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <View
              style={{
                backgroundColor: P.primary,
                height: 150,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ color: "#FFF8F2", fontWeight: "900", fontSize: 18 }}
              >
                تکمیل پروفایل
              </Text>
              <Text
                style={{ color: "#FFE6D5", marginTop: 4, fontSize: 12 }}
              >
                فقط چند قدم تا شروع ققنوس فاصله داری
              </Text>
            </View>

            {/* Floating Avatar & Actions */}
            <View style={{ alignItems: "center" }}>
              <View style={{ marginTop: -40 }}>
                <Avatar />
              </View>

              {/* آواتارهای آماده */}
              <View
                style={{
                  marginTop: 12,
                  paddingHorizontal: 18,
                  width: "100%",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={16}
                    color={P.textMuted}
                  />
                  <Text
                    style={{
                      color: P.textMuted,
                      fontSize: 12,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    انتخاب آواتار آماده
                  </Text>
                </View>

                {/* ردیف اول */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  {PRESET_AVATARS.slice(0, 4).map((av) => {
                    const selected =
                      (avatarUrl || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity
                        key={av.id}
                        onPress={() => setAvatarUrlState(av.id)}
                        activeOpacity={0.9}
                      >
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected
                              ? P.primary
                              : P.border,
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

                {/* ردیف دوم */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-evenly",
                  }}
                >
                  {PRESET_AVATARS.slice(4).map((av) => {
                    const selected =
                      (avatarUrl || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity
                        key={av.id}
                        onPress={() => setAvatarUrlState(av.id)}
                        activeOpacity={0.9}
                      >
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected
                              ? P.primary
                              : P.border,
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

              {/* دکمه‌های گالری / دوربین / ریست */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: 12,
                  marginBottom: 6,
                  paddingHorizontal: 18,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <TouchableOpacity
                  onPress={pickFromGallery}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: P.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="images-outline" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
                    از گالری
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={pickFromCamera}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: "#0F172A10",
                    borderWidth: 1,
                    borderColor: P.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name="camera-outline" size={16} color={P.textDark} />
                  <Text
                    style={{ color: P.textDark, fontWeight: "800", fontSize: 12 }}
                  >
                    دوربین
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setAvatarUrlState("avatar:phoenix")}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: P.inputBg,
                    borderWidth: 1,
                    borderColor: P.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={16}
                    color={P.textMuted}
                  />
                  <Text
                    style={{
                      color: P.textMuted,
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    ققنوس پیش‌فرض
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form */}
            <View
              style={{
                paddingHorizontal: 18,
                paddingBottom: 18,
                paddingTop: 8,
                direction: "rtl",
              }}
            >
              {/* Phone */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  marginTop: 12,
                  marginBottom: 4,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={P.textMuted}
                />
                <Text
                  style={{
                    color: P.textMuted,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  شماره موبایل
                </Text>
              </View>
              <View
                style={{
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: P.inputBg,
                  borderColor: P.border,
                  borderWidth: 1,
                  justifyContent: "center",
                  paddingHorizontal: 14,
                }}
              >
                <Text
                  style={{
                    color: P.textDark,
                    fontWeight: "800",
                    textAlign: "right",
                    writingDirection: "rtl",
                  }}
                >
                  {phone || "-"}
                </Text>
              </View>

              {/* Name */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  marginTop: 14,
                  marginBottom: 6,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={P.textMuted}
                />
                <Text
                  style={{
                    color: P.textMuted,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  نام
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TextInput
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    if (nameConfirmed) setNameConfirmed(false);
                  }}
                  placeholder="مثلاً: پژمان"
                  placeholderTextColor={P.textMuted}
                  style={{
                    flex: 1,
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: P.inputBg,
                    borderColor: P.border,
                    borderWidth: 1,
                    paddingHorizontal: 14,
                    color: P.textDark,
                    fontWeight: "700",
                    textAlign: "right",
                    writingDirection: "rtl",
                  }}
                  returnKeyType="done"
                  onSubmitEditing={confirmName}
                />
                <TouchableOpacity
                  onPress={confirmName}
                  activeOpacity={0.9}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: nameConfirmed ? "#16A34A" : P.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="checkmark" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Gender */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  marginTop: 16,
                  marginBottom: 6,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="male-female-outline"
                  size={14}
                  color={P.textMuted}
                />
                <Text
                  style={{
                    color: P.textMuted,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  جنسیت
                </Text>
              </View>
              <View style={{ flexDirection: "row-reverse", gap: 10 }}>
                {(
                  [
                    { key: "male", label: "مرد", icon: "male" },
                    { key: "female", label: "زن", icon: "female" },
                    { key: "other", label: "سایر", icon: "gender-non-binary" },
                  ] as const
                ).map((g) => {
                  const selected = gender === (g.key as Gender);
                  const IconComp =
                    g.key === "other"
                      ? MaterialCommunityIcons
                      : Ionicons;
                  const iconName =
                    g.key === "other"
                      ? ("gender-non-binary" as any)
                      : (g.icon as any);
                  return (
                    <Pressable
                      key={g.key}
                      onPress={() => {
                        Keyboard.dismiss();
                        setGender(g.key as Gender);
                      }}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: selected
                          ? P.primarySoft
                          : P.inputBg,
                        borderWidth: 2,
                        borderColor: selected ? P.primary : P.border,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <IconComp
                        name={iconName}
                        size={18}
                        color={
                          selected ? P.primaryDark : P.textMuted
                        }
                      />
                      <Text
                        style={{
                          color: selected
                            ? P.primaryDark
                            : P.textDark,
                          fontWeight: "800",
                        }}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Birthdate */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  marginTop: 16,
                  marginBottom: 6,
                  gap: 6,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={P.textMuted}
                />
                <Text
                  style={{
                    color: P.textMuted,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  تاریخ تولد (اختیاری)
                </Text>
              </View>
              <JalaliSelect
                key={birthDate || "no-birth"}
                initial={birthDate}
                onChange={(iso) => {
                  Keyboard.dismiss();
                  setBirthDate(iso);
                }}
                minYear={1330}
                maxYear={1390}
                styleContainer={{
                  borderColor: P.border,
                  backgroundColor: P.inputBg,
                }}
                stylePicker={{
                  backgroundColor: P.cardBg,
                  borderColor: P.border,
                }}
                textColor={P.textDark}
                accentColor={P.primary}
                dark
                grid
              />
              {!!birthDate && (
                <Text
                  style={{
                    color: P.textMuted,
                    fontSize: 12,
                    marginTop: 6,
                    textAlign: "left",
                  }}
                >
                  تاریخ انتخابی (میلادی): {" "}
                  <Text
                    style={{
                      color: P.textDark,
                      fontWeight: "800",
                    }}
                  >
                    {birthDate}
                  </Text>
                </Text>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  onSubmit();
                }}
                disabled={saving}
                activeOpacity={0.9}
                style={{
                  height: 54,
                  borderRadius: 16,
                  backgroundColor: saving
                    ? P.primaryDark
                    : P.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 18,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "900",
                  }}
                >
                  {saving ? "در حال ذخیره…" : "ذخیره و شروع"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}