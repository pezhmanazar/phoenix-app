// hooks/useUser.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./useAuth";
import { getMeByPhone, type Me } from "../api/user";

type RefreshOptions = {
  force?: boolean;
};

type UserContextValue = {
  me: Me | null;
  refreshing: boolean;
  refresh: (opts?: RefreshOptions) => Promise<void>;
};

const UserCtx = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { phone, isAuthenticated, signOut } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedPhoneRef = useRef<string | null>(null);

  // ✅ NEW: زمان آخرین fetch برای TTL کش
  const lastFetchAtRef = useRef<number>(0);
  const CACHE_TTL_MS = 2000;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (opts?: RefreshOptions) => {
      const force = opts?.force === true;

      // اگر لاگین نیستیم، me رو پاک کن و کش رو ریست کن
      if (!isAuthenticated || !phone) {
        if (__DEV__) {
          console.log("[useUser.refresh] not authenticated or no phone, skip");
        }
        lastLoadedPhoneRef.current = null;
        lastFetchAtRef.current = 0;
        if (mountedRef.current) setMe(null);
        return;
      }

      const now = Date.now();
      const cacheFresh =
        lastLoadedPhoneRef.current === phone &&
        !!me &&
        now - lastFetchAtRef.current < CACHE_TTL_MS;

      if (!force && cacheFresh) {
        if (__DEV__) console.log("[useUser.refresh] skip (cached ttl)");
        return;
      }

      if (loadingRef.current) {
        if (__DEV__) console.log("[useUser.refresh] skip (already loading)");
        return;
      }

      loadingRef.current = true;
      if (mountedRef.current) setRefreshing(true);

      try {
        if (__DEV__) console.log("[useUser.refresh] fetching me for", phone);

        const resp = await getMeByPhone(phone);

        // ❗️ok:false
        if (!resp.ok) {
          // ✅ USER_NOT_FOUND در onboarding طبیعی است → نباید signOut کند
          if (resp.error === "USER_NOT_FOUND") {
            if (__DEV__) {
              console.warn(
                "[useUser.refresh] USER_NOT_FOUND → keep auth/phone, just clear me"
              );
            }
            lastLoadedPhoneRef.current = null;
            lastFetchAtRef.current = 0;
            if (mountedRef.current) setMe(null);
            return;
          }

          // ✅ اگر status هم داشته باشیم (401/403) => signOut
          const status = (resp as any)?.status;
          if (status === 401 || status === 403) {
            if (__DEV__)
              console.warn("[useUser.refresh] AUTH_STATUS → signOut", status);
            lastLoadedPhoneRef.current = null;
            lastFetchAtRef.current = 0;
            if (mountedRef.current) setMe(null);
            await signOut();
            return;
          }

          // ✅ فقط خطاهای احراز هویت → signOut
          if (
            resp.error === "UNAUTHORIZED" ||
            resp.error === "INVALID_SESSION" ||
            resp.error === "TOKEN_EXPIRED"
          ) {
            if (__DEV__)
              console.warn(
                "[useUser.refresh] AUTH_ERROR → signOut",
                resp.error
              );
            lastLoadedPhoneRef.current = null;
            lastFetchAtRef.current = 0;
            if (mountedRef.current) setMe(null);
            await signOut();
            return;
          }

          // سایر خطاها: me قبلی رو نگه می‌داریم (یا null می‌مونه)
          if (__DEV__)
            console.warn(
              "[useUser.refresh] ERROR but keep previous me",
              resp.error
            );
          return;
        }

        // ok:true
        if (mountedRef.current) setMe(resp.data || null);
        lastLoadedPhoneRef.current = phone;
        lastFetchAtRef.current = Date.now();
        if (__DEV__) console.log("[useUser.refresh] new me =", resp.data);
      } catch (e) {
        if (__DEV__)
          console.warn("[useUser.refresh] EXCEPTION but keep previous me", e);
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) setRefreshing(false);
      }
    },
    [phone, me, isAuthenticated, signOut]
  );

  // هنگام تغییر auth → یک بار رفرش
  useEffect(() => {
    refresh({ force: false });
  }, [isAuthenticated, phone]);

  const value: UserContextValue = {
    me,
    refreshing,
    refresh,
  };

  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserCtx);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}