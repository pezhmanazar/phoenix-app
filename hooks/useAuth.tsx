// hooks/useAuth.tsx
import {
  sendCode as apiSendCode,
  verifyCode as apiVerifyCode,
} from "@/api/otp";
import { SECURE_KEYS } from "@/constants/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
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

type JwtPayload = {
  id?: string | number;
  userId?: string | number;
  sub?: string | number;
  phone?: string;
  mobile?: string;
  name?: string;
  fullName?: string;
  exp?: number;
  [key: string]: any;
};

type AuthState = {
  loading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  phone: string | null;

  // برای استفاده‌های بعدی مثل تیکت، پروفایل و دیباگ
  userId: string | null;
  name: string | null;
};

type AuthContextValue = AuthState & {
  setToken: (t: string | null) => Promise<void>;
  setPhone: (p: string | null) => Promise<void>;
  signOut: (opts?: { keepPhone?: boolean }) => Promise<void>;
  refreshFromStore: () => Promise<void>;
  requestCode: (
    phone: string
  ) => Promise<{
    ok: true;
    expiresInSec?: number;
    devHint?: string;
    smsSent?: boolean;
    smsError?: string | null;
  }>;
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
   🔹 HELPERS
============================== */

function cleanString(value: any): string | null {
  if (value === undefined || value === null) return null;

  const s = String(value).trim();
  return s ? s : null;
}

function parseJwtPayload(t?: string | null): JwtPayload | null {
  try {
    if (!t) return null;
    return jwtDecode<JwtPayload>(t);
  } catch {
    return null;
  }
}

function isJwtExpired(payload: JwtPayload | null) {
  if (!payload?.exp) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSec;
}

function deriveAuthStateFromToken(
  token: string | null,
  storedPhone: string | null,
  loading: boolean
): AuthState {
  const payload = parseJwtPayload(token);

  const usableToken = !!token && !!payload && !isJwtExpired(payload);

  if (!usableToken) {
    return {
      loading,
      token: null,
      isAuthenticated: false,
      phone: storedPhone || null,
      userId: null,
      name: null,
    };
  }

  const userId =
    cleanString(payload?.id) ||
    cleanString(payload?.userId) ||
    cleanString(payload?.sub);

  const phone =
    cleanString(payload?.phone) ||
    cleanString(payload?.mobile) ||
    cleanString(storedPhone);

  const name =
    cleanString(payload?.name) ||
    cleanString(payload?.fullName);

  return {
    loading,
    token,
    isAuthenticated: true,
    phone,
    userId,
    name,
  };
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
    userId: null,
    name: null,
  });

  const signingOutRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      await migrateBadKeysOnce();

      let [token, phone] = await Promise.all([
        safeGet(SECURE_KEYS.SESSION),
        safeGet(SECURE_KEYS.OTP_PHONE),
      ]);

      const payload = parseJwtPayload(token);

      // اگر توکن خراب یا منقضی بود، نگهش ندار
      if (token && (!payload || isJwtExpired(payload))) {
        token = null;

        try {
          await safeDel(SECURE_KEYS.SESSION);
          await AsyncStorage.removeItem("session_v1");
        } catch {
          // intentionally ignored
        }
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

      setState(deriveAuthStateFromToken(token || null, phone || null, false));
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshFromStore = async () => {
    let [token, phone] = await Promise.all([
      safeGet(SECURE_KEYS.SESSION),
      safeGet(SECURE_KEYS.OTP_PHONE),
    ]);

    const payload = parseJwtPayload(token);

    if (token && (!payload || isJwtExpired(payload))) {
      token = null;

      try {
        await safeDel(SECURE_KEYS.SESSION);
        await AsyncStorage.removeItem("session_v1");
      } catch {
        // intentionally ignored
      }
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

    setState((s) => ({
      ...deriveAuthStateFromToken(token || null, phone || null, false),
      loading: s.loading ? false : s.loading,
    }));
  };

  const setToken = async (t: string | null) => {
    let nextToken = t ? String(t) : null;

    const payload = parseJwtPayload(nextToken);

    if (nextToken && (!payload || isJwtExpired(payload))) {
      nextToken = null;
    }

    await safeSet(SECURE_KEYS.SESSION, nextToken);

    try {
      if (nextToken) {
        await AsyncStorage.setItem("session_v1", nextToken);
      } else {
        await AsyncStorage.removeItem("session_v1");
      }
    } catch {
      throw new Error("SESSION_STORAGE_SYNC_FAILED");
    }

    if (!mountedRef.current) return;

    setState((s) => {
      const derived = deriveAuthStateFromToken(
        nextToken,
        s.phone,
        false
      );

      return {
        ...s,
        ...derived,
      };
    });
  };

  const setPhone = async (p: string | null) => {
    const nextPhone = p ? String(p) : null;

    await safeSet(SECURE_KEYS.OTP_PHONE, nextPhone);

    try {
      if (nextPhone) {
        await AsyncStorage.setItem(SECURE_KEYS.OTP_PHONE, nextPhone);
      } else {
        await AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE);
      }
    } catch {
      throw new Error("PHONE_STORAGE_SYNC_FAILED");
    }

    if (!mountedRef.current) return;

    setState((s) => ({
      ...s,
      phone: nextPhone,
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

        AsyncStorage.removeItem("session_v1"),

        keepPhone ? Promise.resolve() : safeDel(SECURE_KEYS.OTP_PHONE),

        keepPhone
          ? Promise.resolve()
          : AsyncStorage.removeItem(SECURE_KEYS.OTP_PHONE),
      ]);

      if (!mountedRef.current) return;

      setState((s) => ({
        loading: false,
        token: null,
        isAuthenticated: false,
        phone: keepPhone ? s.phone : null,
        userId: null,
        name: null,
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

    await setPhone(phone);

    return {
      ok: true,
      expiresInSec: resp.expiresInSec,
      devHint: resp.devHint,
      smsSent: resp.smsSent,
      smsError: resp.smsError ?? null,
    };
  };

  const verifyOtp: AuthContextValue["verifyOtp"] = async (code) => {
    const phone = state.phone || (await safeGet(SECURE_KEYS.OTP_PHONE));

    if (!phone) {
      throw new Error("OTP_FLOW_NOT_STARTED");
    }

    if (!/^\d{5,6}$/.test(String(code))) {
      throw new Error("INVALID_CODE");
    }

    try {
      const v = await withTimeout(
        apiVerifyCode(String(phone), String(code)),
        15000
      );

      console.log("VERIFY_OTP_RESPONSE:", v);

      if (!v?.ok) {
        throw new Error((v as any)?.error || "VERIFY_FAILED");
      }

      const session =
        (v as any)?.sessionToken ||
        (v as any)?.token ||
        (v as any)?.data?.sessionToken ||
        (v as any)?.data?.token;

      if (!session) {
        throw new Error("NO_SESSION_FROM_BACKEND");
      }

      await setPhone(String(phone));
      await setToken(String(session));

      return { ok: true };
    } catch (e: any) {
      console.log("VERIFY_OTP_ERROR_RAW:", e);
      console.log("VERIFY_OTP_ERROR_MESSAGE:", e?.message);

      const raw = String(
        e?.message ||
          e?.error ||
          "VERIFY_FAILED"
      );

      if (
        raw === "INVALID_CODE" ||
        /invalid code/i.test(raw) ||
        /code.*invalid/i.test(raw) ||
        /not match/i.test(raw) ||
        /mismatch/i.test(raw)
      ) {
        throw new Error("INVALID_CODE");
      }

      if (
        raw === "TOKEN_INVALID_OR_EXPIRED" ||
        /expired/i.test(raw)
      ) {
        throw new Error("TOKEN_INVALID_OR_EXPIRED");
      }

      if (
        raw === "NO_SESSION_FROM_BACKEND" ||
        /session/i.test(raw) ||
        /token/i.test(raw)
      ) {
        throw new Error("NO_SESSION_FROM_BACKEND");
      }

      if (
        raw === "REQUEST_TIMEOUT" ||
        /timeout/i.test(raw)
      ) {
        throw new Error("REQUEST_TIMEOUT");
      }

      if (raw === "OTP_FLOW_NOT_STARTED") {
        throw new Error("OTP_FLOW_NOT_STARTED");
      }

      throw new Error(raw);
    }
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
