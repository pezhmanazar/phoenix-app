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
  const { phone, isAuthenticated } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedPhoneRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (opts?: RefreshOptions) => {
      const force = opts?.force === true;

      if (!phone) {
        if (__DEV__) {
          console.log("[useUser.refresh] no phone, skip");
        }
        return;
      }

      // اگر قبلاً load شده و force=false → هیچی
      if (!force && lastLoadedPhoneRef.current === phone && me) {
        if (__DEV__) {
          console.log("[useUser.refresh] skip (cached)");
        }
        return;
      }

      // هم‌زمان فقط یک رفرش
      if (loadingRef.current) {
        if (__DEV__) console.log("[useUser.refresh] skip (already loading)");
        return;
      }
      loadingRef.current = true;

      if (!mountedRef.current) return;
      setRefreshing(true);

      try {
        if (__DEV__)
          console.log("[useUser.refresh] fetching me for", phone);

        const resp = await getMeByPhone(phone);

        // اگر خطاست، me را دست نمی‌زنیم (وضعیت قبلی را حفظ می‌کنیم)
        if (!resp.ok) {
          if (__DEV__)
            console.warn("[useUser.refresh] ERROR but keep previous me", resp.error);

          lastLoadedPhoneRef.current = phone;
          return;
        }

        // اگر داده OK بود
        setMe(resp.data || null);
        lastLoadedPhoneRef.current = phone;

        if (__DEV__) {
          console.log("[useUser.refresh] new me =", resp.data);
        }
      } catch (e) {
        if (__DEV__)
          console.warn("[useUser.refresh] EXCEPTION but keep previous me", e);
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) setRefreshing(false);
      }
    },
    [phone, me]
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