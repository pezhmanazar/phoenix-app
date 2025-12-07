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
  force?: boolean; // اگر true باشد، حتی اگر me برای این شماره داریم، دوباره از سرور می‌خوانیم
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

      // ❗ تغییر اصلی اینجاست:
      // فقط اگر "شماره" نداریم، چیزی انجام نده
      // دیگه me رو نال نمی‌کنیم و lastLoadedPhone رو پاک نمی‌کنیم
      if (!phone) {
        if (__DEV__) {
          console.log("[useUser.refresh] no phone yet, skip", {
            isAuthenticated,
            phone,
          });
        }
        return;
      }

      // اگر قبلاً برای همین شماره داده داریم و force نیست، هیچی نکن
      if (!force && lastLoadedPhoneRef.current === phone && me) {
        if (__DEV__) {
          console.log(
            "[useUser.refresh] skip (same phone & already have me, no force)"
          );
        }
        return;
      }

      // اگر ریکوئست قبلی هنوز در حال اجراست، دوباره نرو
      if (loadingRef.current) {
        if (__DEV__) console.log("[useUser.refresh] skip (already loading)");
        return;
      }

      loadingRef.current = true;

      if (!mountedRef.current) return;
      setRefreshing(true);

      try {
        if (__DEV__) {
          console.log("[useUser.refresh] getMeByPhone(", phone, ")");
        }

        const resp = await getMeByPhone(phone);

        if (!mountedRef.current) return;

        if (resp.ok) {
          setMe(resp.data || null);
          lastLoadedPhoneRef.current = phone;

          if (__DEV__) {
            console.log("[useUser.refresh] new me =", resp.data || null);
          }
        } else {
          if (__DEV__) console.warn("[useUser.refresh] error:", resp.error);
          setMe(null);
          lastLoadedPhoneRef.current = phone;
        }
      } catch (e) {
        if (__DEV__) console.warn("[useUser.refresh] exception:", e);
        if (mountedRef.current) {
          setMe(null);
        }
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) {
          setRefreshing(false);
        }
      }
    },
    [isAuthenticated, phone, me]
  );

  // هنگام تغییر شماره/وضعیت auth، فقط یک بار رفرش کن
  useEffect(() => {
    refresh({ force: false });
  }, [isAuthenticated, phone, refresh]);

  const value: UserContextValue = {
    me,
    refreshing,
    refresh,
  };

  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserCtx);
  if (!ctx) {
    throw new Error("useUser must be used within <UserProvider>");
  }
  return ctx;
}