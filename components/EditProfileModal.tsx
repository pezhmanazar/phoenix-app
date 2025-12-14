// components/EditProfileModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  I18nManager,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { usePhoenix } from "../hooks/PhoenixContext";
import { useUser } from "../hooks/useUser";
import { useAuth } from "../hooks/useAuth";
import JalaliSelect from "./JalaliSelect";
import { saveReminders, saveTags, saveToday } from "../lib/storage";
import { upsertUserByPhone, deleteMeByPhone } from "../api/user";

type Props = { onClose: () => void };
type Gender = "male" | "female" | "other";

/* ---------------- Colors / Tokens (همسان با profile-wizard) ---------------- */
const P = {
  pageBg: "#0b0f14",
  cardBg: "#0b0f14",
  cardBg2: "rgba(255,255,255,.02)",
  text: "#e8eef7",
  muted: "rgba(231,238,247,.72)",
  muted2: "rgba(231,238,247,.55)",
  line: "rgba(255,255,255,.10)",
  inputBg: "rgba(255,255,255,.04)",
  gold: "#D4AF37",
  goldBorder: "rgba(212,175,55,.35)",
  goldSoft: "rgba(212,175,55,.16)",
  ok: "#22c55e",
  okSoft: "rgba(34,197,94,.16)",
  danger: "rgba(248,113,113,1)",
  dangerSoft: "rgba(248,113,113,.14)",
};

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  android: { elevation: 10 },
});

/* ---------------- Avatar presets ---------------- */
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

const normalizeAvatar = (v?: string | null) =>
  v && typeof v === "string" && v.trim().length > 0 ? v : null;

function normalizeIsoDateOnly(value?: string | null): string | undefined {
  const v = String(value || "").trim();
  if (!v) return undefined;
  if (v.includes("T")) return v.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (v.length >= 10) return v.slice(0, 10);
  return undefined;
}

/* ---------------- Phoenix Toast / Dialog ---------------- */
type ToastType = "ok" | "danger" | "info";
type ToastState = { visible: boolean; type: ToastType; text: string };

type DialogBtn = {
  text: string;
  kind?: "primary" | "secondary" | "danger";
  onPress?: () => void | Promise<void>;
};

type DialogState = {
  visible: boolean;
  tone?: "neutral" | "danger" | "ok";
  title?: string;
  message?: string;
  buttons?: DialogBtn[];
};

function toneIcon(tone?: DialogState["tone"]) {
  if (tone === "danger") return "warning-outline";
  if (tone === "ok") return "checkmark-circle-outline";
  return "information-circle-outline";
}

function toneColor(tone?: DialogState["tone"]) {
  if (tone === "danger") return P.danger;
  if (tone === "ok") return P.ok;
  return P.gold;
}

export default function EditProfileModal({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
    setPelekanProgress,
    setDayProgress,
    resetStreak,
    resetNoContact,
    addPoints,
    points,
  } = usePhoenix();

  const { me, refresh } = useUser() as any;
  const { phone, signOut } = useAuth();

  const initialAvatar =
    normalizeAvatar(me?.avatarUrl as string | null) ??
    normalizeAvatar(avatarUrl as string | null) ??
    "avatar:phoenix";

  const [name, setName] = useState<string>(me?.fullName ?? profileName ?? "");
  const [photo, setPhoto] = useState<string | null>(initialAvatar);
  const [saving, setSaving] = useState(false);

  const [gender, setGender] = useState<Gender>(
    ((me?.gender as any) ?? "male") as Gender
  );
  const [birthDate, setBirthDate] = useState<string | undefined>(
    normalizeIsoDateOnly(me?.birthDate as any) ?? undefined
  );

  // Dialog / Toast
  const [dialog, setDialog] = useState<DialogState>({ visible: false });
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: "info",
    text: "",
  });

  const showToast = (type: ToastType, text: string) => {
    setToast({ visible: true, type, text });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  };

  const openDialog = (cfg: Omit<DialogState, "visible">) => {
    setDialog({ visible: true, ...cfg });
  };

  const closeDialog = () => setDialog((d) => ({ ...d, visible: false }));

  // sync با me
  useEffect(() => {
    if (me?.fullName) setName(String(me.fullName));
    if (me?.avatarUrl) setPhoto(String(me.avatarUrl));
    if (me?.gender) setGender(me.gender as any);
    if (me?.birthDate) setBirthDate(normalizeIsoDateOnly(String(me.birthDate)));
  }, [me?.fullName, me?.avatarUrl, me?.gender, me?.birthDate]);

  // fallback از phoenix_profile
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
        if (!me?.birthDate && p.birthDate)
          setBirthDate(normalizeIsoDateOnly(String(p.birthDate)));
      } catch {
        // ignore
      }
    })();
  }, [
    me?.fullName,
    me?.avatarUrl,
    me?.gender,
    me?.birthDate,
    avatarUrl,
    setAvatarUrl,
  ]);

  const safeSetPhoto = (uri: string) => {
    if (mountedRef.current) setPhoto(uri);
  };

  /* ---------------- keyboard scroll ---------------- */
  const scrollRef = useRef<ScrollView | null>(null);
  const [lastFocusKey, setLastFocusKey] = useState<"name" | "birth">("name");
  const posRef = useRef<{ [k: string]: number }>({});

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      requestAnimationFrame(() => {
        const y = posRef.current[lastFocusKey] ?? 0;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
      });
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {});
    return () => {
      showSub.remove();
      hideSub.remove();
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
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, 80);
  };

  /* ---------------- Image pickers ---------------- */
  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        openDialog({
          tone: "danger",
          title: "اجازه دسترسی لازم است",
          message: "برای انتخاب عکس از گالری، اجازهٔ دسترسی را فعال کن.",
          buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
        });
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
      openDialog({
        tone: "danger",
        title: "خطا",
        message: "هنگام باز کردن گالری مشکلی پیش آمد.",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    }
  };

  const pickFromCamera = async () => {
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        openDialog({
          tone: "danger",
          title: "اجازهٔ دوربین لازم است",
          message: "برای گرفتن عکس با دوربین، اجازهٔ دسترسی را فعال کن.",
          buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
        });
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
      openDialog({
        tone: "danger",
        title: "خطا",
        message: "هنگام باز کردن دوربین مشکلی پیش آمد.",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    }
  };

  /* ---------------- Avatar renderer ---------------- */
  const renderModalAvatar = () => {
    const current = photo || "avatar:phoenix";

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
              borderColor: P.gold,
            }}
          />
        );
      }
    }

    const isValidUri =
      typeof current === "string" && /^(file:|content:|https?:)/.test(current);
    if (isValidUri) {
      return (
        <Image
          source={{ uri: current }}
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderWidth: 2,
            borderColor: P.goldBorder,
          }}
        />
      );
    }

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
            borderColor: P.gold,
          }}
        />
      );
    }

    return (
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: P.goldSoft,
          borderWidth: 1,
          borderColor: P.goldBorder,
        }}
      >
        <Ionicons name="person" size={54} color={P.text} />
      </View>
    );
  };

  /* ---------------- Save profile ---------------- */
  const save = async () => {
    const safeName = (name || "").trim() || "کاربر";
    const safeAvatar = photo || "avatar:phoenix";
    const safeBirth = birthDate ? normalizeIsoDateOnly(birthDate) : undefined;

    if (!phone) {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: "شماره موبایل پیدا نشد. دوباره وارد شو.",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
      return;
    }

    try {
      setSaving(true);

      const body = {
        fullName: safeName,
        avatarUrl: safeAvatar,
        gender,
        birthDate: safeBirth ?? null,
        profileCompleted: true,
      };

      const res = await upsertUserByPhone(phone, body);

      if (!res.ok) {
        openDialog({
          tone: "danger",
          title: "ذخیره نشد",
          message: res.error || "ثبت در سرور ناموفق بود.",
          buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
        });
        return;
      }

      setProfileName(safeName);
      setAvatarUrl(safeAvatar);

      await AsyncStorage.setItem(
        "phoenix_profile",
        JSON.stringify({
          id: me?.id ?? "",
          fullName: safeName,
          avatarUrl: safeAvatar,
          gender,
          birthDate: safeBirth ?? null,
        })
      );

      await refresh({ force: true }).catch(() => {});
      showToast("ok", "ذخیره شد ✅");
      setTimeout(() => onClose(), 350);
    } catch (e: any) {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: e?.message || "مشکل شبکه",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- Reset "Pelekan + Points" and go onboarding ---------------- */
  const doResetAll = async () => {
    try {
      await Promise.all([saveToday([]), saveReminders([]), saveTags([])]);

      setPelekanProgress(0);
      setDayProgress(0);
      resetStreak();
      resetNoContact();
      if (typeof points === "number" && points !== 0) addPoints(-points);

      await AsyncStorage.multiRemove([
  "profile_completed_flag",
  "hasOnboarded_v1",
]);

      showToast("ok", "ریست انجام شد. از نو شروع کن ✨");

      onClose();
      setTimeout(() => {
        router.replace("/onboarding");
      }, 180);
    } catch {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: "در پاک‌سازی داده‌ها مشکلی پیش آمد.",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    }
  };

  const confirmResetAll = () => {
    openDialog({
      tone: "danger",
      title: "شروع از صفر",
      message:
        "فقط «تمرین‌ها، استمرار روزها و امتیازها» صفر میشه و به صفحه شروع منتقل میشی. ادامه میدی؟",
      buttons: [
        { text: "انصراف", kind: "secondary", onPress: closeDialog },
        {
          text: "بله، شروع از نو",
          kind: "danger",
          onPress: async () => {
            closeDialog();
            await doResetAll();
          },
        },
      ],
    });
  };

  /* ---------------- Sign out only (NO DATA DELETE) ---------------- */
  const AUTH_KEYS_TO_CLEAR = ["session_v1", "otp_phone_v1", "otp_token_v1"] as const;

  const clearAuthOnly = async () => {
    try {
      await AsyncStorage.multiRemove([...AUTH_KEYS_TO_CLEAR]);
    } catch {
      await Promise.all(
        AUTH_KEYS_TO_CLEAR.map((k) => AsyncStorage.removeItem(k).catch(() => {}))
      );
    }
  };

  const doSignOutOnly = async () => {
    if (saving) return;

    try {
      setSaving(true);

      // ✅ فقط خروج: هیچ چیز دیگری پاک نشود (نه phoenix_profile، نه profile_completed_flag، نه تمرین‌ها)
      await clearAuthOnly();

      // ✅ استیت auth هم null شود
      await signOut().catch(() => {});

      // ✅ استیت user هم به‌روز شود که جایی گیر نکند
      await refresh?.({ force: true }).catch(() => {});

      showToast("ok", "خارج شدی. ✅");

      onClose();

      // ✅ مهم: بعد از خروج باید برود صفحه لاگین (نه onboarding)
      // اگر روت شما متفاوت است این را مطابق پروژه‌ات عوض کن (مثلاً "/(auth)/login")
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 200);
    } catch (e: any) {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: e?.message || "مشکل شبکه",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOutOnly = () => {
    if (saving) return;

    openDialog({
      tone: "danger",
      title: "خروج از حساب",
      message:
        "فقط از حسابت خارج میشی. هیچ اطلاعاتی پاک نمیشه. ادامه میدی؟",
      buttons: [
        { text: "انصراف", kind: "secondary", onPress: closeDialog },
        {
          text: "بله، خارج شو",
          kind: "danger",
          onPress: async () => {
            closeDialog();
            await doSignOutOnly();
          },
        },
      ],
    });
  };

  /* ---------------- Delete account (DB) with double confirmation ---------------- */

  const LOCAL_KEYS_TO_CLEAR = [
    "phoenix_profile",
    "profile_completed_flag",
    "hasOnboarded_v1",
    "otp_phone_v1",
    "session_v1",
    "tags_v1",
    "reminders_v1",
    "today_v1",
  ] as const;

  const clearLocalUserData = async () => {
    try {
      await AsyncStorage.multiRemove([...LOCAL_KEYS_TO_CLEAR]);
    } catch {
      await Promise.all(
        LOCAL_KEYS_TO_CLEAR.map((k) => AsyncStorage.removeItem(k).catch(() => {}))
      );
    }
  };

  const deleteAccount = async () => {
    if (saving) return;
    const p = String(phone || "").trim();

    if (!p) {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: "شماره موبایل پیدا نشد.",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
      return;
    }

    try {
      setSaving(true);

      const res = await deleteMeByPhone(p);

      if (!res || typeof res !== "object" || (res as any).ok !== true) {
        const err = (res as any)?.error || "حذف حساب ناموفق بود.";
        openDialog({
          tone: "danger",
          title: "حذف نشد",
          message: String(err),
          buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
        });
        return;
      }

      const deleted = (res as any)?.data?.deleted;
      if (deleted === false) {
        showToast("danger", "حساب روی سرور پیدا نشد (یا قبلاً حذف شده).");
      }

      await clearLocalUserData();
      await signOut().catch(() => {});
      await refresh?.({ force: true }).catch(() => {});

      showToast("ok", "حساب حذف شد.");
      onClose();

      setTimeout(() => {
        router.replace("/onboarding");
      }, 200);
    } catch (e: any) {
      openDialog({
        tone: "danger",
        title: "خطا",
        message: e?.message || "مشکل شبکه",
        buttons: [{ text: "باشه", kind: "primary", onPress: closeDialog }],
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (saving) return;

    const isPro =
      String(me?.plan || "").toLowerCase() === "pro" ||
      String(me?.plan || "").toLowerCase() === "vip";

    openDialog({
      tone: "danger",
      title: "حذف حساب کاربری",
      message: "این کار غیرقابل بازگشته و همهٔ اطلاعاتت پاک میشه. ادامه میدی؟",
      buttons: [
        { text: "انصراف", kind: "secondary", onPress: closeDialog },
        {
          text: "ادامه",
          kind: "danger",
          onPress: () => {
            closeDialog();
            openDialog({
              tone: "danger",
              title: "تأیید نهایی",
              message: isPro
                ? "هشدار: اشتراک فعال داری و با حذف حساب، اشتراک هم پاک میشه. مطمئنی؟"
                : "مطمئنی که می‌خوای حسابت رو حذف کنی؟",
              buttons: [
                { text: "انصراف", kind: "secondary", onPress: closeDialog },
                {
                  text: "بله، حذف کن",
                  kind: "danger",
                  onPress: async () => {
                    closeDialog();
                    await deleteAccount();
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  /* ---------------- Dialog component ---------------- */
  const PhoenixDialog = useMemo(() => {
    if (!dialog.visible) return null;

    const icon = toneIcon(dialog.tone);
    const toneC = toneColor(dialog.tone);

    return (
      <Modal transparent animationType="fade" statusBarTranslucent>
        <View style={styles.dialogBackdrop}>
          <View style={[styles.dialogCard, { borderColor: P.line }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Ionicons name={icon as any} size={22} color={toneC} />
                <Text style={styles.dialogTitle}>
                  {dialog.title || "پیام"}
                </Text>
              </View>

              <TouchableOpacity onPress={closeDialog} hitSlop={12}>
                <Ionicons name="close" size={20} color={P.muted} />
              </TouchableOpacity>
            </View>

            {!!dialog.message && (
              <Text style={styles.dialogMessage}>{dialog.message}</Text>
            )}

            <View style={styles.dialogBtnRow}>
              {(dialog.buttons || [{ text: "باشه", kind: "primary" }]).map(
                (b, idx) => {
                  const kind = b.kind || "primary";

                  const base = [styles.dialogBtn];
                  const textStyle = [styles.dialogBtnText];

                  if (kind === "secondary") {
                    base.push({
                      backgroundColor: P.cardBg2,
                      borderColor: P.line,
                    } as any);
                    textStyle.push({ color: P.text } as any);
                  } else if (kind === "danger") {
                    base.push({
                      backgroundColor: "rgba(248,113,113,.10)",
                      borderColor: "rgba(248,113,113,.55)",
                    } as any);
                    textStyle.push({ color: P.danger } as any);
                  } else {
                    base.push({
                      backgroundColor: P.goldSoft,
                      borderColor: P.goldBorder,
                    } as any);
                    textStyle.push({ color: P.text } as any);
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.9}
                      style={base as any}
                      onPress={async () => {
                        try {
                          await b.onPress?.();
                        } catch {
                          showToast("danger", "خطای غیرمنتظره");
                        }
                      }}
                      disabled={saving}
                    >
                      <Text style={textStyle as any}>{b.text}</Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [dialog, saving]);

  /* ---------------- Toast UI ---------------- */
  const ToastView = () => {
    if (!toast.visible) return null;

    const t = toast.type;
    const bg =
      t === "ok"
        ? "rgba(34,197,94,.14)"
        : t === "danger"
        ? "rgba(248,113,113,.14)"
        : "rgba(212,175,55,.14)";
    const border =
      t === "ok"
        ? "rgba(34,197,94,.45)"
        : t === "danger"
        ? "rgba(248,113,113,.45)"
        : "rgba(212,175,55,.35)";
    const icon =
      t === "ok" ? "checkmark-circle-outline" : t === "danger" ? "warning-outline" : "information-circle-outline";
    const iconC = t === "ok" ? P.ok : t === "danger" ? P.danger : P.gold;

    return (
      <View
        pointerEvents="none"
        style={[
          styles.toastWrap,
          { top: 12, left: 16, right: 16, borderColor: border, backgroundColor: bg },
        ]}
      >
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Ionicons name={icon as any} size={18} color={iconC} />
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      </View>
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
            {
              backgroundColor: P.pageBg,
              borderColor: P.line,
              ...shadow,
            },
          ]}
        >
          {/* toast */}
          <ToastView />

          {/* glows */}
          <View
            style={{
              position: "absolute",
              top: -220,
              left: -220,
              width: 420,
              height: 420,
              borderRadius: 999,
              backgroundColor: "rgba(212,175,55,.14)",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: -240,
              right: -240,
              width: 480,
              height: 480,
              borderRadius: 999,
              backgroundColor: "rgba(233,138,21,.10)",
            }}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={(Platform.select({ ios: 8, android: 0 }) as number) || 0}
            style={{ maxHeight: "88%" }}
          >
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={{ width: 32 }} />
                <View style={styles.headerCenter}>
                  <Ionicons name="person-circle-outline" size={22} color={P.gold} />
                  <Text style={styles.headerTitle}>ویرایش پروفایل</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={10}>
                  <Ionicons name="close" size={22} color={P.text} />
                </TouchableOpacity>
              </View>

              <View style={{ alignItems: "center", marginTop: 6 }}>
                {renderModalAvatar()}
              </View>

              {/* Name */}
              <View style={{ gap: 10, marginTop: 16 }} onLayout={onLayoutCapture("name")}>
                <View style={styles.labelRow}>
                  <Text style={styles.labelText}>نام</Text>
                  <Ionicons name="person-outline" size={16} color={P.muted} />
                </View>

                <TextInput
                  value={name}
                  onChangeText={(t) => mountedRef.current && setName(t)}
                  onFocus={onFocusScroll("name")}
                  placeholder="نام شما"
                  placeholderTextColor="rgba(231,238,247,.45)"
                  style={[styles.input, { color: P.text }]}
                  textAlign={I18nManager.isRTL ? "right" : "right"}
                  returnKeyType="done"
                />
              </View>

              {/* Photo buttons */}
              <View style={{ marginTop: 18 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.labelText}>تصویر پروفایل</Text>
                  <Ionicons name="image-outline" size={16} color={P.muted} />
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity onPress={pickFromGallery} style={[styles.secondaryBtn, { flexDirection: "row", gap: 6 }]} activeOpacity={0.9}>
                    <Ionicons name="images-outline" size={18} color={P.text} />
                    <Text style={styles.btnText}>از گالری</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={pickFromCamera} style={[styles.secondaryBtn, { flexDirection: "row", gap: 6 }]} activeOpacity={0.9}>
                    <Ionicons name="camera-outline" size={18} color={P.text} />
                    <Text style={styles.btnText}>دوربین</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Preset avatars */}
              <View style={{ marginTop: 18 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.labelText}>آواتارهای آماده</Text>
                  <Ionicons name="sparkles-outline" size={16} color={P.muted} />
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, marginTop: 10 }}>
                  {PRESET_AVATARS.slice(0, 4).map((av) => {
                    const selected = (photo || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity key={av.id} onPress={() => setPhoto(av.id)} activeOpacity={0.85}>
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? P.gold : P.line,
                            backgroundColor: P.cardBg2,
                          }}
                        >
                          <Image source={av.src} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-evenly" }}>
                  {PRESET_AVATARS.slice(4).map((av) => {
                    const selected = (photo || "avatar:phoenix") === av.id;
                    return (
                      <TouchableOpacity key={av.id} onPress={() => setPhoto(av.id)} activeOpacity={0.85}>
                        <View
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            overflow: "hidden",
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected ? P.gold : P.line,
                            backgroundColor: P.cardBg2,
                          }}
                        >
                          <Image source={av.src} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Gender */}
              <View style={{ marginTop: 18 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.labelText}>جنسیت</Text>
                  <Ionicons name="male-female-outline" size={16} color={P.muted} />
                </View>

                <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 10 }}>
                  {[
                    { key: "male", label: "مرد", icon: "male" },
                    { key: "female", label: "زن", icon: "female" },
                    { key: "other", label: "سایر", icon: "person" },
                  ].map((g) => {
                    const selected = gender === (g.key as Gender);
                    return (
                      <TouchableOpacity
                        key={g.key}
                        onPress={() => setGender(g.key as Gender)}
                        activeOpacity={0.85}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: selected ? P.goldSoft : P.inputBg,
                          borderWidth: 2,
                          borderColor: selected ? P.gold : P.line,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        <Ionicons name={g.icon as any} size={18} color={selected ? P.gold : P.muted} />
                        <Text style={{ color: P.text, fontWeight: "800" }}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Birthdate */}
              <View style={{ marginTop: 18 }} onLayout={onLayoutCapture("birth")}>
                <View style={styles.labelRow}>
                  <Text style={styles.labelText}>تاریخ تولد (اختیاری)</Text>
                  <Ionicons name="calendar-outline" size={16} color={P.muted} />
                </View>

                <View style={{ marginTop: 10 }}>
                  <JalaliSelect
                    key={birthDate || "no-birth"}
                    initial={birthDate}
                    onChange={(iso) => setBirthDate(normalizeIsoDateOnly(iso))}
                    minYear={1330}
                    maxYear={1390}
                    grid
                    styleContainer={{
                      borderColor: P.line,
                      backgroundColor: P.inputBg,
                      minHeight: 56,
                      borderRadius: 14,
                    }}
                    stylePicker={{
                      backgroundColor: P.pageBg,
                      borderColor: P.line,
                    }}
                    textColor={P.text}
                    accentColor={P.gold}
                    dark
                  />
                </View>

                {!!birthDate && (
                  <Text style={{ color: P.muted2, fontSize: 12, marginTop: 8, textAlign: "right" }}>
                    تاریخ انتخابی (میلادی):{" "}
                    <Text style={{ color: P.text, fontWeight: "800" }}>
                      {normalizeIsoDateOnly(birthDate)}
                    </Text>
                  </Text>
                )}
              </View>

              {/* Reset */}
              <View style={{ marginTop: 18 }}>
                <TouchableOpacity
                  onPress={confirmResetAll}
                  activeOpacity={0.9}
                  style={{
                    borderWidth: 1,
                    borderColor: P.danger,
                    backgroundColor: P.dangerSoft,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="refresh-outline" size={18} color={P.danger} />
                  <Text style={{ color: P.danger, fontWeight: "900" }}>
                    شروع از صفر
                  </Text>
                </TouchableOpacity>

                <Text style={{ color: P.muted2, fontSize: 11, textAlign: "center", marginTop: 6 }}>
                  با این کار تمرین‌های پلکان و امتیازها صفر میشه و به صفحه شروع منتقل میشی.
                </Text>
              </View>

              {/* Sign out only */}
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  onPress={confirmSignOutOnly}
                  activeOpacity={0.9}
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(212,175,55,.55)",
                    backgroundColor: "rgba(212,175,55,.08)",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="log-out-outline" size={18} color={P.gold} />
                  <Text style={{ color: P.text, fontWeight: "900" }}>
                    خروج از حساب
                  </Text>
                </TouchableOpacity>

                <Text style={{ color: P.muted2, fontSize: 11, textAlign: "center", marginTop: 6 }}>
                  فقط از حساب خارج میشی. هیچ اطلاعاتی پاک نمیشه و دوباره با شماره وارد میشی.
                </Text>
              </View>

              {/* Delete account */}
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  onPress={confirmDeleteAccount}
                  activeOpacity={0.9}
                  style={{
                    borderWidth: 1,
                    borderColor: "rgba(248,113,113,.55)",
                    backgroundColor: "rgba(248,113,113,.08)",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons name="trash-bin-outline" size={18} color={P.danger} />
                  <Text style={{ color: P.danger, fontWeight: "900" }}>
                    حذف حساب کاربری
                  </Text>
                </TouchableOpacity>

                <Text style={{ color: P.muted2, fontSize: 11, textAlign: "center", marginTop: 6 }}>
                  هشدار: حذف حساب غیرقابل بازگشته و اگر کاربر پرو باشی، اشتراکت هم حذف میشه.
                </Text>
              </View>

              {/* Buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={save}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: saving ? "rgba(255,255,255,.06)" : P.goldSoft,
                      borderColor: saving ? P.line : P.goldBorder,
                    },
                  ]}
                  disabled={saving}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: P.text, fontWeight: "900" }}>
                    {saving ? "در حال ذخیره…" : "ذخیره"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.secondaryBtn, { borderColor: P.line }]}
                  disabled={saving}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: P.text, fontWeight: "800" }}>
                    انصراف
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: insets.bottom + 10 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>

        {/* custom dialog */}
        {PhoenixDialog}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.80)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#0b0f14",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
  },
  headerTitle: {
    color: P.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
  },
  labelText: {
    color: P.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: P.inputBg,
    borderColor: P.line,
  },
  primaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  secondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: P.cardBg2,
  },
  btnText: {
    color: P.text,
    fontWeight: "800",
  },

  /* toast */
  toastWrap: {
    position: "absolute",
    zIndex: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toastText: {
    color: P.text,
    fontWeight: "800",
    textAlign: "right",
  },

  /* dialog */
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  dialogCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: P.pageBg,
    padding: 14,
  },
  dialogHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dialogTitle: {
    color: P.text,
    fontWeight: "900",
    fontSize: 15,
    textAlign: "right",
  },
  dialogMessage: {
    color: P.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
    marginBottom: 12,
  },
  dialogBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  dialogBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogBtnText: {
    fontWeight: "900",
  },
});