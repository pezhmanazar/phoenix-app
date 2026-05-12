// hooks/useAuth.tsx
import {
  sendCode as apiSendCode,
  verifyCode as apiVerifyCode,
} from "@/api/otp";
import { SECURE_KEYS } from "@/constants/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ==============================
   🔹 TYPES
============================== */

type AuthState = {
  loading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  phone: string | null;
  otpToken: string | null;
};

type AuthContextValue = AuthState & {
  setToken: (t: string | null) => Promise<void>;
  setPhone: (p: string | null) => Promise<void>;
  signOut: (opts?: { keepPhone?: boolean }) => Promise<void>;
  refreshFromStore: () => Promise<void>;
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
    throw new Error(`Invalid SecureStore key: "${key}"`);
  }
}

async function safeGet(key: string) {
  assertValidKey(key);

  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string | null) {
  assertValidKey(key);

  try {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    throw new Error("SECURE_STORE_WRITE_FAILED");
  }
}

async function safeDel(key: string) {
  assertValidKey(key);

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    throw new Error("SECURE_STORE_DELETE_FAILED");
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
    } catch {
      // intentionally ignored
    }
  }
}

/* ==============================
   🔹 Helpers
============================== */

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

function looksLikeOtpToken(_t?: string | null) {
  return false;
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
        SECURE_KEYS.OTP_TOKEN
          ? safeGet(SECURE_KEYS.OTP_TOKEN)
          : Promise.resolve(null),
      ]);

      if (looksLikeOtpToken(token)) {
        await safeDel(SECURE_KEYS.SESSION);
        token = null;
      }

      try {
        if (token) {
          await AsyncStorage.setItem("session_v1", token);
        } else {
          await AsyncStorage.removeItem("session_v1");
        }
      } catch {
        // intentionally ignored
      }

      if (!mountedRef.current) return;

      setState({
        loading: false,
        token: token || null,
        isAuthenticated: !!token,
        phone: phone || null,
        otpToken: otpToken || null,
      });
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFromStore = async () => {
    const [token, phone, otpToken] = await Promise.all([
      safeGet(SECURE_KEYS.SESSION),
      safeGet(SECURE_KEYS.OTP_PHONE),
      SECURE_KEYS.OTP_TOKEN
        ? safeGet(SECURE_KEYS.OTP_TOKEN)
        : Promise.resolve(null),
    ]);

    try {
      if (token) {
        await AsyncStorage.setItem("session_v1", token);
      } else {
        await AsyncStorage.removeItem("session_v1");
      }
    } catch {
      // intentionally ignored
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
    if (looksLikeOtpToken(t)) {
      return;
    }

    if (state.token === t) return;

    await safeSet(SECURE_KEYS.SESSION, t);

    try {
      if (t) {
        await AsyncStorage.setItem("session_v1", t);
      } else {
        await AsyncStorage.removeItem("session_v1");
      }
    } catch {
      throw new Error("SESSION_STORAGE_SYNC_FAILED");
    }

    if (!mountedRef.current) return;

    console.log("AUTH_SET_TOKEN", t);

setState((s) => ({
  ...s,
  token: t,
  isAuthenticated: !!t,
}));
  };

  const setPhone = async (p: string | null) => {
    if (state.phone === p) return;

    await safeSet(SECURE_KEYS.OTP_PHONE, p);

    try {
      if (p) {
        await AsyncStorage.setItem(SECURE_KEYS.OTP_PHONE, p);
      } else {
        await AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE);
      }
    } catch {
      throw new Error("PHONE_STORAGE_SYNC_FAILED");
    }

    if (!mountedRef.current) return;

    setState((s) => ({
      ...s,
      phone: p,
    }));
  };

  const setOtpToken = async (t: string | null) => {
    if (!SECURE_KEYS.OTP_TOKEN) return;

    await safeSet(SECURE_KEYS.OTP_TOKEN, t);

    if (!mountedRef.current) return;

    setState((s) => ({
      ...s,
      otpToken: t,
    }));
  };

  const signOut = async (opts?: { keepPhone?: boolean }) => {
    if (signingOutRef.current) return;

    signingOutRef.current = true;

    const keepPhone = opts?.keepPhone === true;

    try {
      await Promise.all([
        safeDel(SECURE_KEYS.SESSION),
        SECURE_KEYS.REFRESH_TOKEN
          ? safeDel(SECURE_KEYS.REFRESH_TOKEN)
          : Promise.resolve(),
        SECURE_KEYS.OTP_TOKEN
          ? safeDel(SECURE_KEYS.OTP_TOKEN)
          : Promise.resolve(),

        AsyncStorage.removeItem("session_v1"),

        keepPhone ? Promise.resolve() : safeDel(SECURE_KEYS.OTP_PHONE),
        keepPhone
          ? Promise.resolve()
          : AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE),
      ]);

      if (!mountedRef.current) return;

      setState((s) => ({
        ...s,
        token: null,
        isAuthenticated: false,
        phone: keepPhone ? s.phone : null,
        otpToken: null,
      }));
    } finally {
      signingOutRef.current = false;
    }
  };

  /* ==============================
      🔹 OTP ACTIONS
   ============================== */

 const requestCode: AuthContextValue["requestCode"] = async (phone) => {
  if (!/^09\d{9}$/.test(phone)) {
    throw new Error("INVALID_PHONE");
  }

  const resp = await withTimeout(apiSendCode(phone), 15000);

  if (!resp?.ok) {
    throw new Error("SEND_CODE_FAILED");
  }

  await setOtpToken(null);
  await setPhone(phone);

  return { ok: true };
};

  const verifyOtp: AuthContextValue["verifyOtp"] = async (code) => {
    const phone = state.phone || (await safeGet(SECURE_KEYS.OTP_PHONE));

    if (!phone) {
      throw new Error("OTP_FLOW_NOT_STARTED");
    }

    if (!/^\d{5,6}$/.test(String(code))) {
      throw new Error("INVALID_CODE");
    }

    const v = await withTimeout(
  apiVerifyCode(String(phone), String(code)),
  15000
);

    if (!v?.ok) {
      throw new Error((v as any)?.error || "VERIFY_FAILED");
    }

    const session = (v as any).sessionToken;

    if (!session) {
      throw new Error("NO_SESSION_FROM_BACKEND");
    }

    await setPhone(String(phone));
    await setToken(session);
    console.log("AUTH_VERIFY_SESSION", session);
    await setOtpToken(null);


    try {
      await AsyncStorage.setItem(SECURE_KEYS.OTP_PHONE, String(phone));
    } catch {
      throw new Error("PHONE_STORAGE_SYNC_FAILED");
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

  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }

  return ctx;
};
