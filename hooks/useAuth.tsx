// hooks/useAuth.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SECURE_KEYS } from "@/constants/storage";
import {
  sendCode as apiSendCode,
  verifyCode as apiVerifyCode,
} from "@/api/otp";
/* ==============================
   🔹 TYPES
============================== */
type AuthState = {
  loading: boolean;
  token: string | null; // session token (بدون فیلد code)
  isAuthenticated: boolean;
  phone: string | null; // آخرین شماره در OTP flow
  otpToken: string | null; // توکن کوتاه‌عمر از /sendCode (در صورت وجود)
};
type AuthContextValue = AuthState & {
  setToken: (t: string | null) => Promise<void>;
  setPhone: (p: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFromStore: () => Promise<void>;
  /** OTP flow */
  requestCode: (phone: string) => Promise<{ ok: true }>;
  verifyOtp: (code: string) => Promise<{ ok: true }>;
};
/* ==============================
   🔹 CONTEXT
============================== */
const AuthCtx = createContext<AuthContextValue | undefined>(undefined);
/* ==============================
   🔹 SAFE SECURESTORE HELPERS
============================== */
function assertValidKey(key: string) {
  if (!key || !/^[A-Za-z0-9._-]+$/.test(key)) {
    if (__DEV__) console.warn(`⚠️ Invalid SecureStore key: "${key}"`);
    throw new Error(`Invalid SecureStore key: "${key}"`);
  }
}
async function safeGet(key: string) {
  assertValidKey(key);
  try {
    const val = await SecureStore.getItemAsync(key);
    if (__DEV__) console.log(`[useAuth] get(${key}) →`, val);
    return val;
  } catch (err) {
    console.warn(`[useAuth] Failed to get key "${key}":`, err);
    return null;
  }
}
async function safeSet(key: string, value: string | null) {
  assertValidKey(key);
  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
      if (__DEV__) console.log(`[useAuth] delete(${key})`);
    } else {
      await SecureStore.setItemAsync(key, value);
      if (__DEV__) console.log(`[useAuth] set(${key}) →`, value);
    }
  } catch (err) {
    console.warn(`[useAuth] Failed to set key "${key}":`, err);
  }
}
async function safeDel(key: string) {
  assertValidKey(key);
  try {
    await SecureStore.deleteItemAsync(key);
    if (__DEV__) console.log(`[useAuth] delete(${key})`);
  } catch (err) {
    console.warn(`[useAuth] Failed to delete key "${key}":`, err);
  }
}
/* ==============================
   🔹 ONE-OFF CLEANUP
============================== */
async function migrateBadKeysOnce() {
  const maybeBadKeys = ["auth token", "auth:token", " session", "otp token"];
  for (const k of maybeBadKeys) {
    try {
      await SecureStore.deleteItemAsync(k as any);
      if (__DEV__) console.log(`[useAuth] deleted bad key "${k}"`);
    } catch {}
  }
}
/* ==============================
   🔹 Helpers
============================== */
// Base64Url → JSON (برای تشخیص OTP-token که فیلد code دارد)
function parseJwtPayload(t?: string | null): any | null {
  try {
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length < 2) return null;
    const b64url = parts[1];
    const b64 = b64url
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(b64url.length / 4) * 4, "=");
    // @ts-ignore
    const atobFn = (globalThis as any).atob;
    if (!atobFn) return null;
    const json = atobFn(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function looksLikeOtpToken(t?: string | null) {
  const payload = parseJwtPayload(t);
  return payload && typeof payload.code !== "undefined";
}
// timeout ساده برای درخواست‌ها
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
/* ==============================
   🔹 PROVIDER
============================== */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    token: null,
    isAuthenticated: false,
    phone: null,
    otpToken: null,
  });
  const signingOutRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      await migrateBadKeysOnce();
      let [token, phone, otpToken] = await Promise.all([
        safeGet(SECURE_KEYS.SESSION),
        safeGet(SECURE_KEYS.OTP_PHONE),
        SECURE_KEYS.OTP_TOKEN ? safeGet(SECURE_KEYS.OTP_TOKEN) : Promise.resolve(null),
      ]);
      // ⛔️ اگر اشتباهاً OTP-token (دارای فیلد code) در SESSION ذخیره شده، پاکش کن
      if (looksLikeOtpToken(token)) {
        await safeDel(SECURE_KEYS.SESSION);
        token = null;
      }

      // ✅ همگام‌سازی session برای api/user.ts (که از AsyncStorage می‌خواند)
      try {
        if (token) await AsyncStorage.setItem("session_v1", token);
        else await AsyncStorage.removeItem("session_v1");
      } catch (e) {
        if (__DEV__) console.warn("[useAuth] AsyncStorage session sync error:", e);
      }

      if (!mountedRef.current) return;
      setState({
        loading: false,
        token: token || null,
        isAuthenticated: !!token,
        phone: phone || null,
        otpToken: otpToken || null,
      });
      if (__DEV__) console.log("[useAuth] initial state →", { token, phone, otpToken });
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFromStore = async () => {
    const [token, phone, otpToken] = await Promise.all([
      safeGet(SECURE_KEYS.SESSION),
      safeGet(SECURE_KEYS.OTP_PHONE),
      SECURE_KEYS.OTP_TOKEN ? safeGet(SECURE_KEYS.OTP_TOKEN) : Promise.resolve(null),
    ]);

    // ✅ sync token to AsyncStorage as well
    try {
      if (token) await AsyncStorage.setItem("session_v1", token);
      else await AsyncStorage.removeItem("session_v1");
    } catch (e) {
      if (__DEV__) console.warn("[useAuth] AsyncStorage session sync error:", e);
    }

    if (!mountedRef.current) return;
    setState((s) => ({
      ...s,
      token: token || null,
      isAuthenticated: !!token,
      phone: phone || null,
      otpToken: otpToken || null,
    }));
  };

  const setToken = async (t: string | null) => {
    // هرگز OTP-token را به عنوان سشن ذخیره نکن
    if (looksLikeOtpToken(t)) {
      if (__DEV__) console.warn("[useAuth] refused to store an OTP token in session");
      return;
    }
    if (state.token === t) return;

    // ✅ SecureStore
    await safeSet(SECURE_KEYS.SESSION, t);

    // ✅ AsyncStorage (برای doJson در api/user.ts)
    try {
      if (t) await AsyncStorage.setItem("session_v1", t);
      else await AsyncStorage.removeItem("session_v1");
      if (__DEV__) console.log("[useAuth] sync AsyncStorage(session_v1) →", t);
    } catch (e) {
      if (__DEV__) console.warn("[useAuth] AsyncStorage session error:", e);
    }

    if (!mountedRef.current) return;
    setState((s) => ({ ...s, token: t, isAuthenticated: !!t }));
  };

  const setPhone = async (p: string | null) => {
    if (state.phone === p) return;
    await safeSet(SECURE_KEYS.OTP_PHONE, p);
    // 👇 برای fetchMe، شماره را در AsyncStorage هم نگه می‌داریم
    try {
      if (p) {
        await AsyncStorage.setItem(SECURE_KEYS.OTP_PHONE, p);
      } else {
        await AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE);
      }
    } catch (e) {
      if (__DEV__) console.warn("[useAuth] AsyncStorage phone error:", e);
    }
    if (!mountedRef.current) return;
    setState((s) => ({ ...s, phone: p }));
  };

  const setOtpToken = async (t: string | null) => {
    if (!SECURE_KEYS.OTP_TOKEN) return; // اگر کلید تعریف نشده
    await safeSet(SECURE_KEYS.OTP_TOKEN, t);
    if (!mountedRef.current) return;
    setState((s) => ({ ...s, otpToken: t }));
  };

  const signOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      await Promise.all([
        safeDel(SECURE_KEYS.SESSION),
        SECURE_KEYS.REFRESH_TOKEN ? safeDel(SECURE_KEYS.REFRESH_TOKEN) : Promise.resolve(),
        SECURE_KEYS.OTP_TOKEN ? safeDel(SECURE_KEYS.OTP_TOKEN) : Promise.resolve(),
        safeDel(SECURE_KEYS.OTP_PHONE),

        // 👇 کلیدهای AsyncStorage هم پاک شوند
        AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE),
        AsyncStorage.removeItem("session_v1"), // ✅ مهم
      ]);

      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        token: null,
        isAuthenticated: false,
        phone: null,
        otpToken: null,
      }));
    } finally {
      signingOutRef.current = false;
    }
  };

  /* ==============================
      🔹 OTP ACTIONS
   ============================== */
  // 1) ارسال کد
  const requestCode: AuthContextValue["requestCode"] = async (phone) => {
    if (!/^09\d{9}$/.test(phone)) throw new Error("INVALID_PHONE");
    const resp = await withTimeout(apiSendCode(phone), 15000);
    // سرور ما ok برمی‌گردونه؛ ممکنه token نده
    if (!resp?.ok) throw new Error("SEND_CODE_FAILED");
    await setPhone(phone);
    // اگر سرور token داد ذخیره می‌کنیم، وگرنه null
    const maybeToken = (resp as any).token ?? null;
    await setOtpToken(maybeToken);
    return { ok: true };
  };

  // 2) وریفای کد
  const verifyOtp: AuthContextValue["verifyOtp"] = async (code) => {
    const phone = state.phone || (await safeGet(SECURE_KEYS.OTP_PHONE));
    const otpToken =
      state.otpToken ||
      (SECURE_KEYS.OTP_TOKEN ? await safeGet(SECURE_KEYS.OTP_TOKEN) : null);

    if (!phone) throw new Error("OTP_FLOW_NOT_STARTED");
    if (!/^\d{5,6}$/.test(String(code))) throw new Error("INVALID_CODE");

    const v = await withTimeout(
      apiVerifyCode(String(phone), String(code), String(otpToken ?? "")),
      15000
    );
    if (!v?.ok) throw new Error((v as any)?.error || "VERIFY_FAILED");

    // ✅ سشن واقعی از سرور
    const session = (v as any).sessionToken;
    if (!session) throw new Error("NO_SESSION_FROM_BACKEND");

    // ✅ ریس مهم: اول phone رو ست کن که ProfileWizard سریعاً آن را ببیند
    await setPhone(String(phone));

    // ✅ سپس token
    await setToken(session);

    // ✅ otpToken پاک
    await setOtpToken(null);

    // 👇 این‌جا هم مطمئن می‌شویم شماره در AsyncStorage برای fetchMe ذخیره شده
    try {
      await AsyncStorage.setItem(SECURE_KEYS.OTP_PHONE, String(phone));
      if (__DEV__)
        console.log("[useAuth] stored phone in AsyncStorage for fetchMe:", phone);
    } catch (e) {
      if (__DEV__) console.warn("[useAuth] failed to store phone in AsyncStorage:", e);
    }

    return { ok: true };
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setToken,
      setPhone,
      signOut,
      refreshFromStore,
      requestCode,
      verifyOtp,
    }),
    [state]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/* ==============================
   🔹 HOOK
============================== */
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};