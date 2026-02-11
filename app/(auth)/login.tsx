// app/(auth)/login.tsx
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking, // ✅ NEW
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendCode } from "../../api/otp";
import { APP_API_URL } from "../../constants/env";

/* تبدیل اعداد فارسی/عربی به انگلیسی */
function toEnDigits(input: string) {
  const fa = "۰۱۲۳۴۵۶۷۸۹",
    ar = "٠١٢٣٤٥٦٧٨٩";
  return String(input || "").replace(/[0-9۰-۹٠-٩]/g, (d) => {
    const iFa = fa.indexOf(d);
    if (iFa > -1) return String(iFa);
    const iAr = ar.indexOf(d);
    if (iAr > -1) return String(iAr);
    return d;
  });
}

/* نرمال‌سازی شماره ایران */
function normalizeIranPhone(value: string) {
  const only = toEnDigits(value).replace(/\D/g, "");
  if (only.startsWith("0098")) return "0" + only.slice(3);
  if (only.startsWith("098")) return "0" + only.slice(3);
  if (only.startsWith("98")) return "0" + only.slice(2);
  if (only.startsWith("9") && only.length === 10) return "0" + only;
  return only;
}

/* بخش‌های بیانیه استفاده و حریم خصوصی با آیکون */
const TERMS_SECTIONS = [
  {
    icon: "heart-dislike-outline",
    title: "این اپلیکیشن تشویق به جدایی نمی‌کند",
    body:
      "ققنوس هیچ کاربری را به جدایی از همسر یا شریک عاطفی ترغیب نمی‌کند. تصمیم برای ادامه یا پایان رابطه کاملاً شخصی و بر عهده کاربر است. ققنوس صرفاً ابزارها و آموزش‌هایی برای مدیریت پیامدهای عاطفی و روانی رابطه یا جدایی ارائه می‌دهد.",
  },

  {
    icon: "chatbox-ellipses-outline",
    title: "کاربرد واژه «درمان» در اپلیکیشن",
    body:
      "در برخی بخش‌های اپلیکیشن از واژه «درمان» یا اصطلاحات مشابه استفاده شده است. این واژه صرفاً برای ساده‌سازی فهم مسیر رشد، بازسازی روانی و بهبود فردی به کار رفته و به هیچ عنوان به معنای ارائه خدمات درمانی، روان‌درمانی، تشخیص، مداخله بالینی یا جایگزینی درمان حضوری توسط متخصص سلامت روان نیست.\n\n" +
      "استفاده از این واژه هیچ تعهد حرفه‌ای، پزشکی یا درمانی برای ققنوس ایجاد نمی‌کند و مسئولیت تصمیم‌گیری و نحوه استفاده از محتوا کاملاً بر عهده کاربر است.",
  },

  {
    icon: "medkit-outline",
    title: "ماهیت خدمات ققنوس",
    body:
      "ققنوس یک ابزار آموزشی و کمک‌درمانی در حوزه روان‌شناسی و به‌ویژه ترمیم شکست عاطفی است. این خدمات جایگزین مشاوره تخصصی، روان‌درمانی یا درمان پزشکی نیستند و برای مدیریت شرایط بالینی شدید یا بحران‌های حاد طراحی نشده‌اند.",
  },

  {
    icon: "people-circle-outline",
    title: "محتوا عمومی است و نسخه اختصاصی محسوب نمی‌شود",
    body:
      "تمام آموزش‌ها، تکنیک‌ها و ارزیابی‌ها بر اساس پژوهش‌های علمی و الگوهای رایج رفتاری ارائه شده‌اند و برای هر فرد، نسخه درمانی اختصاصی محسوب نمی‌شوند. در صورت نیاز به ارزیابی دقیق یا مداخله تخصصی، مراجعه به متخصص سلامت روان ضروری است.",
  },

  {
    icon: "alert-circle-outline",
    title: "مسئولیت کاربر و حدود مسئولیت ققنوس",
    body:
      "کاربر متعهد است اطلاعات صحیح و واقعی (به‌ویژه شماره موبایل) ثبت کند. حفاظت از اطلاعات ورود، کدهای پیامکی و حساب کاربری بر عهده خود کاربر است.\n\n" +
      "ققنوس پرونده درمانی تشکیل نمی‌دهد، تشخیص بالینی صادر نمی‌کند و نسخه درمانی ارائه نمی‌دهد. مسئولیت استفاده از محتوا، تصمیم‌گیری‌های شخصی و مراجعه به متخصص کاملاً بر عهده کاربر است.",
  },

  {
    icon: "bandage-outline",
    title: "خدمات فوریت‌های روانی ارائه نمی‌شود",
    body:
      "در صورت وجود افکار خودآسیبی یا دیگرآسیبی، علائم شدید افسردگی یا اضطراب، تجربه خشونت یا بی‌ثباتی شدید روانی، کاربر باید فوراً با اورژانس یا متخصص سلامت روان تماس بگیرد. ققنوس خدمات بحران یا مداخله فوری ارائه نمی‌دهد.",
  },

  {
    icon: "trending-up-outline",
    title: "نتیجه قطعی وعده داده نمی‌شود",
    body:
      "بهبود روانی، فرآیندی فردی، تدریجی و وابسته به شرایط هر شخص است. ققنوس هیچ نتیجه قطعی یا یکسانی برای همه کاربران تضمین نمی‌کند.",
  },

  {
    icon: "card-outline",
    title: "اشتراک‌ها و پرداخت",
    body:
      "دسترسی به بخش‌های پریمیوم ققنوس از طریق خرید اشتراک زمان‌دار انجام می‌شود. مدت، مبلغ و شرایط هر اشتراک در صفحه جزئیات اشتراک‌، به‌طور شفاف اعلام شده است.\n\n" +
      "پرداخت‌ها از طریق درگاه‌های پرداخت معتبر، انجام می‌شود و مسئولیت صحت اطلاعات پرداخت بر عهده کاربر است.",
  },

  {
    icon: "return-down-back-outline",
    title: "انصراف و بازگشت وجه",
    body:
      "به دلیل ماهیت دیجیتال خدمات و فعال‌سازی فوری پس از خرید، بازگشت وجه صرفاً در شرایط مشخص امکان‌پذیر است.\n\n" +
      "بازگشت وجه فقط در صورتی بررسی می‌شود که: \n" +
      "۱) اشتراک خریداری‌شده ظرف حداکثر ۲۴ ساعت فعال نشده باشد.\n" +
      "۲) اختلال فنی جدی و قابل‌اثباتی در دسترسی به خدمات وجود داشته باشد که توسط پشتیبانی تأیید شود.\n\n" +
      "در سایر موارد، پس از فعال‌سازی اشتراک و امکان استفاده از محتوا، بازگشت وجه امکان‌پذیر نخواهد بود.",
  },

  {
    icon: "lock-closed-outline",
    title: "حریم خصوصی و محرمانگی داده‌ها",
    body:
      "اطلاعات کاربران با رعایت اصول محرمانگی و استانداردهای امنیتی نگهداری می‌شود و بدون حکم مراجع قانونی در اختیار شخص یا سازمان دیگری قرار نخواهد گرفت.\n\n" +
      "داده‌ها صرفاً برای بهبود تجربه کاربری، تحلیل آماری ناشناس و پشتیبانی استفاده می‌شوند و به اشخاص ثالث فروخته نمی‌شوند.\n\n" +
      "کاربر می‌تواند درخواست حذف کامل داده‌های خود را ثبت کند. دسترسی به اطلاعات کاربران محدود به تیم فنی و پشتیبانی مجاز است و فقط در چارچوب وظایف حرفه‌ای انجام می‌شود.",
  },

  {
    icon: "document-text-outline",
    title: "مالکیت معنوی",
    body:
      "تمام محتوا، ساختار، آزمون‌ها، آموزش‌ها و طراحی‌های اپلیکیشن متعلق به برند ققنوس است و مالیکت مادی و معنوی آن در اختیار آقای مسعود احمدی آذر به عنوان موسس و صاحب اثر است و هرگونه تکثیر، انتشار یا استفاده تجاری بدون مجوز کتبی ممنوع است.",
  },

  {
    icon: "shield-checkmark-outline",
    title: "حد و مرزهای اخلاقی و قانونی",
    body:
      "کاربر متعهد می‌شود از اپلیکیشن به‌صورت اخلاقی و قانونی استفاده کند، از تکنیک‌ها برای آسیب به خود یا دیگران بهره نگیرد و قوانین کشور محل اقامت خود را رعایت کند. هرگونه استفاده غیرقانونی از محتوا یا تلاش برای سوءاستفاده از سیستم ممنوع است.",
  },

  {
    icon: "refresh-circle-outline",
    title: "تغییر قوانین و دسترسی به نسخه رسمی",
    body:
      "ققنوس این حق را دارد که قوانین و شرایط استفاده را در هر زمان، به‌روزرسانی کند. نسخه به‌روز و رسمی این قوانین همواره از طریق این لینک در دسترس است:\n\n" +
      "https://qoqnoos.app/terms.html\n\n" +
      "ادامه استفاده از اپلیکیشن به معنای پذیرش نسخه جاری قوانین است.",
  },
] as const;

type NoticeType = "error" | "warn" | "info" | "success";
type NoticeState = null | { type: NoticeType; title: string; message?: string };

export default function LoginScreen() {
  const router = useRouter();
  const { dark } = useTheme(); // فقط برای StatusBar، تم ما ثابتِ onboarding است

  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // نوتیف تم‌دار (جای Alert)
  const [notice, setNotice] = useState<NoticeState>(null);

  const phone = useMemo(() => normalizeIranPhone(rawPhone), [rawPhone]);
  const isValid = /^09\d{9}$/.test(phone);

  const runningRef = useRef(false);

  function showNotice(n: NoticeState) {
    setNotice(n);
  }

  function withTimeout<T>(p: Promise<T>, ms = 15000) {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
      p.then((v) => {
        clearTimeout(id);
        resolve(v);
      }).catch((e) => {
        clearTimeout(id);
        reject(e);
      });
    });
  }

  async function safePing() {
    try {
      const url = `${APP_API_URL}/api/ping`;
      console.log("[ENV] APP_API_URL =", APP_API_URL, " → ", url);
      await withTimeout(fetch(url, { method: "GET" }), 3000).catch(() => {});
    } catch {}
  }

  async function onSend() {
    if (loading || runningRef.current) return;

    // هر بار تلاش جدید = پیام قبلی جمع شود
    setNotice(null);

    if (!isValid) {
      showNotice({
        type: "warn",
        title: "شماره نامعتبر است",
        message: "شماره باید ۱۱ رقم و با 09 شروع شود.",
      });
      return;
    }

    if (!agree) {
      showNotice({
        type: "error",
        title: "تأیید قوانین لازم است",
        message: "برای ادامه، باید شرایط استفاده و حریم خصوصی را بپذیری.",
      });
      return;
    }

    runningRef.current = true;
    setLoading(true);
    try {
      await safePing();

      const res = (await withTimeout(sendCode(phone), 15000)) as {
        ok: true;
        token: string;
        expiresInSec: number;
      };

      router.push({
        pathname: "/(auth)/verify",
        params: {
          phone,
          token: res.token,
          exp: String(res.expiresInSec ?? 120),
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("429") || msg === "TOO_MANY_REQUESTS") {
        showNotice({
          type: "warn",
          title: "لطفاً کمی صبر کن",
          message: "تعداد درخواست‌ها زیاد بوده. کمی بعد دوباره تلاش کن.",
        });
      } else if (msg === "SERVER_MISCONFIGURED") {
        showNotice({
          type: "error",
          title: "خطای سرور",
          message: "پیکربندی سرویس ارسال پیامک کامل نیست.",
        });
      } else if (msg === "REQUEST_TIMEOUT") {
        showNotice({
          type: "warn",
          title: "کندی شبکه",
          message: "پاسخی دریافت نشد. اینترنت را چک کن و دوباره امتحان کن.",
        });
      } else {
        showNotice({
          type: "error",
          title: "ارسال کد ناموفق بود",
          message: "دوباره تلاش کن.",
        });
      }
    } finally {
      setLoading(false);
      runningRef.current = false;
    }
  }

  const disableButton = loading || !isValid || !agree;

  // پالت ثابت مثل onboarding
  const BG = "#0b0f14";
  const TEXT = "#e8eef7";
  const MUTED = "rgba(231,238,247,.72)";
  const LINE = "rgba(255,255,255,.10)";
  const GOLD = "#D4AF37";
  const OK = "#22c55e";
  const INPUT_BG = "rgba(255,255,255,.04)";

  const BAD = "rgba(248,113,113,1)";
  const WARN = "rgba(251,191,36,1)";
  const INFO = "rgba(96,165,250,1)";

  function noticeStyle(type: NoticeType) {
    if (type === "success")
      return {
        border: "rgba(34,197,94,.35)",
        bg: "rgba(34,197,94,.10)",
        icon: "checkmark-circle-outline" as const,
        iconColor: OK,
      };
    if (type === "warn")
      return {
        border: "rgba(251,191,36,.38)",
        bg: "rgba(251,191,36,.10)",
        icon: "alert-circle-outline" as const,
        iconColor: WARN,
      };
    if (type === "info")
      return {
        border: "rgba(96,165,250,.35)",
        bg: "rgba(96,165,250,.10)",
        icon: "information-circle-outline" as const,
        iconColor: INFO,
      };
    return {
      border: "rgba(248,113,113,.40)",
      bg: "rgba(248,113,113,.10)",
      icon: "close-circle-outline" as const,
      iconColor: BAD,
    };
  }

  // ✅ این متن همیشه قابل دیدن باشد؛ فقط وقتی خطاست قرمز شود
  const helperColor =
    rawPhone.length === 0 || isValid ? "rgba(231,238,247,.65)" : "rgba(248,113,113,.95)";

  // ✅ NEW: لینک رسمی قوانین
  const TERMS_URL = "https://qoqnoos.app/terms.html";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style={dark ? "light" : "light"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1 }}>
          {/* گلوها */}
          <View
            style={{
              position: "absolute",
              top: -220,
              left: -220,
              width: 420,
              height: 420,
              borderRadius: 999,
              backgroundColor: "rgba(212,175,55,.16)",
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
              backgroundColor: "rgba(233,138,21,.12)",
            }}
          />

          <View
            style={{
              flex: 1,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 18,
              gap: 14,
            }}
          >
            {/* هدر */}
            <View style={{ alignItems: "center", gap: 6, marginTop: 6 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(212,175,55,.10)",
                  borderWidth: 1,
                  borderColor: "rgba(212,175,55,.28)",
                }}
              >
                <Ionicons name="flame-outline" size={26} color={GOLD} />
              </View>

              <Text
                style={{
                  color: TEXT,
                  fontSize: 20,
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                ورود | ثبت‌نام
              </Text>

              <Text
                style={{
                  color: MUTED,
                  fontSize: 12.5,
                  lineHeight: 20,
                  textAlign: "center",
                  paddingHorizontal: 12,
                }}
              >
                شماره موبایل خودت رو وارد کن تا کد تأیید برات پیامک بشه.
              </Text>
            </View>

            {/* نوتیف تم‌دار */}
            {notice && (
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: noticeStyle(notice.type).border,
                  backgroundColor: noticeStyle(notice.type).bg,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row-reverse",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Ionicons
                  name={noticeStyle(notice.type).icon}
                  size={20}
                  color={noticeStyle(notice.type).iconColor}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: TEXT,
                      fontSize: 13,
                      fontWeight: "900",
                      textAlign: "right",
                      marginBottom: notice.message ? 4 : 0,
                    }}
                  >
                    {notice.title}
                  </Text>
                  {!!notice.message && (
                    <Text
                      style={{
                        color: "rgba(231,238,247,.78)",
                        fontSize: 12.5,
                        lineHeight: 20,
                        textAlign: "right",
                      }}
                    >
                      {notice.message}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => setNotice(null)}
                  hitSlop={10}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="close" size={18} color="rgba(231,238,247,.75)" />
                </Pressable>
              </View>
            )}

            {/* کارت اصلی */}
            <View
              style={{
                marginTop: 4,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: LINE,
                backgroundColor: "rgba(255,255,255,.03)",
                padding: 16,
                gap: 12,
              }}
            >
              {/* فیلد شماره */}
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: MUTED,
                    fontSize: 12,
                    fontWeight: "800",
                    textAlign: "right",
                  }}
                >
                  شماره موبایل
                </Text>

                <View
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor: rawPhone.length === 0 || isValid ? LINE : "rgba(248,113,113,.35)",
                    borderRadius: 16,
                    backgroundColor: INPUT_BG,
                    paddingHorizontal: 12,
                    height: 52,
                  }}
                >
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color="rgba(231,238,247,.75)"
                  />
                  <TextInput
                    value={rawPhone}
                    onChangeText={(t) => {
                      setRawPhone(toEnDigits(t));
                      if (notice) setNotice(null); // با تایپ کردن پیام‌ها جمع شوند
                    }}
                    keyboardType="phone-pad"
                    placeholder="مثلاً 09123456789"
                    placeholderTextColor="rgba(231,238,247,.45)"
                    maxLength={14}
                    onSubmitEditing={onSend}
                    returnKeyType="done"
                    style={{
                      flex: 1,
                      color: TEXT,
                      fontSize: 14,
                      textAlign: "right",
                      paddingVertical: 0,
                    }}
                  />
                </View>

                <Text
                  style={{
                    color: helperColor,
                    fontSize: 11.5,
                    textAlign: "right",
                  }}
                >
                  شماره باید ۱۱ رقم و با 09 شروع بشه.
                </Text>
              </View>

              {/* قوانین */}
              <View
                style={{
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: LINE,
                  backgroundColor: "rgba(255,255,255,.02)",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 8,
                }}
              >
                <Pressable
                  onPress={() => {
                    setAgree((p) => !p);
                    if (notice) setNotice(null);
                  }}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={agree ? "checkbox-outline" : "square-outline"}
                    size={20}
                    color={agree ? OK : "rgba(231,238,247,.70)"}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: TEXT,
                      fontSize: 11.5,
                      lineHeight: 18,
                      textAlign: "right",
                    }}
                  >
                    تأیید می‌کنم که شرایط استفاده، محدودیت‌ها و حریم خصوصی اپ ققنوس رو خوندم و می‌پذیرم.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowTerms(true)}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={GOLD}
                  />
                  <Text
                    style={{
                      color: GOLD,
                      fontSize: 12.5,
                      fontWeight: "900",
                      textAlign: "right",
                    }}
                  >
                    مشاهده متن کامل
                  </Text>
                </Pressable>
              </View>

              {/* دکمه ادامه */}
              <Pressable
                onPress={onSend}
                disabled={disableButton}
                style={{
                  height: 54,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: disableButton
                    ? "rgba(255,255,255,.06)"
                    : "rgba(212,175,55,.16)",
                  borderWidth: 1,
                  borderColor: disableButton ? LINE : "rgba(212,175,55,.35)",
                }}
              >
                {loading ? (
                  <ActivityIndicator color={TEXT} />
                ) : (
                  <View
                    style={{
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Ionicons
                      name="arrow-forward-outline"
                      size={18}
                      color={TEXT}
                    />
                    <Text
                      style={{
                        color: TEXT,
                        fontSize: 14,
                        fontWeight: "900",
                      }}
                    >
                      ادامه
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text
                style={{
                  color: "rgba(231,238,247,.55)",
                  fontSize: 11,
                  lineHeight: 18,
                  textAlign: "center",
                }}
              >
                با ادامه دادن، وارد مرحله دریافت کد تأیید می‌شی.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* مودال قوانین */}
      <Modal
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: LINE,
              backgroundColor: "rgba(255,255,255,.03)",
            }}
          >
            <View
              style={{
                flexDirection: "row-reverse",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color={GOLD} />
              <Text style={{ fontSize: 16, fontWeight: "900", color: TEXT }}>
                شرایط استفاده و حریم خصوصی
              </Text>
            </View>

            <Pressable onPress={() => setShowTerms(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={TEXT} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {TERMS_SECTIONS.map((item, idx) => {
              const isTermsLinkSection = item.title === "تغییر قوانین و دسترسی به نسخه رسمی";
              const bodyWithoutUrl = isTermsLinkSection
                ? String(item.body || "").replace(TERMS_URL, "").replace(/\n{3,}/g, "\n\n").trim()
                : item.body;

              return (
                <View
                  key={item.title}
                  style={{
                    flexDirection: "row-reverse",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: idx === TERMS_SECTIONS.length - 1 ? 0 : 18,
                  }}
                >
                  <View style={{ marginTop: 3 }}>
                    <Ionicons name={item.icon as any} size={20} color={GOLD} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: "900",
                        textAlign: "right",
                        marginBottom: 4,
                      }}
                    >
                      {`${idx + 1}) ${item.title}`}
                    </Text>

                    <Text
                      style={{
                        color: MUTED,
                        fontSize: 12.5,
                        lineHeight: 21,
                        textAlign: "right",
                      }}
                    >
                      {bodyWithoutUrl}
                    </Text>

                    {isTermsLinkSection && (
                      <Pressable
                        onPress={() => Linking.openURL(TERMS_URL)}
                        hitSlop={10}
                        style={({ pressed }) => ({
                          marginTop: 10,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "rgba(212,175,55,.35)",
                          backgroundColor: pressed ? "rgba(212,175,55,.14)" : "rgba(212,175,55,.10)",
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          flexDirection: "row-reverse",
                          alignItems: "center",
                          gap: 8,
                          alignSelf: "center",
                          minWidth: 220,
                          justifyContent: "center",
                        })}
                      >
                        <Ionicons name="link-outline" size={18} color={GOLD} />
                        <Text
                          style={{
                            color: GOLD,
                            fontSize: 12.5,
                            fontWeight: "900",
                            textAlign: "center",
                          }}
                        >
                          مشاهده نسخه رسمی قوانین
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Pressable
              onPress={() => setShowTerms(false)}
              style={{
                height: 52,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(212,175,55,.16)",
                borderWidth: 1,
                borderColor: "rgba(212,175,55,.35)",
              }}
            >
              <Text style={{ color: TEXT, fontSize: 14, fontWeight: "900" }}>
                بستن
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}