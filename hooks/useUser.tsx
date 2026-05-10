// hooks/useUser.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getMeByPhone, type Me } from "../api/user";
import { useAuth } from "./useAuth";

type RefreshOptions = {
  force?: boolean;
};

type UserContextValue = {
  me: Me | null;
  refreshing: boolean;
  refresh: (opts?: RefreshOptions) => Promise<void>;
};

const UserCtx = createContext<UserContextValue | undefined>(undefined);

const CACHE_TTL_MS = 2000;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { phone, isAuthenticated, signOut } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadedPhoneRef = useRef<string | null>(null);
  const lastFetchAtRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetUserState = useCallback(() => {
    lastLoadedPhoneRef.current = null;
    lastFetchAtRef.current = 0;

    if (mountedRef.current) {
      setMe(null);
    }
  }, []);

  const refresh = useCallback(
    async (opts?: RefreshOptions) => {
      const force = opts?.force === true;

      if (!isAuthenticated || !phone) {
        resetUserState();
        return;
      }

      const now = Date.now();
      const cacheFresh =
        lastLoadedPhoneRef.current === phone &&
        !!me &&
        now - lastFetchAtRef.current < CACHE_TTL_MS;

      if (!force && cacheFresh) {
        return;
      }

      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;

      if (mountedRef.current) {
        setRefreshing(true);
      }

      try {
        const resp = await getMeByPhone(phone);

        if (!resp.ok) {
          if (resp.error === "USER_NOT_FOUND") {
            resetUserState();

            try {
              await AsyncStorage.setItem("force_profile_wizard_v1", "1");
              await AsyncStorage.setItem("force_profile_phone_v1", phone);
            } catch {
              // intentionally ignored
            }

            return;
          }

          if (
            resp.error === "UNAUTHORIZED" ||
            resp.error === "INVALID_SESSION" ||
            resp.error === "TOKEN_EXPIRED"
          ) {
            resetUserState();
            await signOut();
            return;
          }

          return;
        }

        if (mountedRef.current) {
          setMe(resp.data || null);
        }

        lastLoadedPhoneRef.current = phone;
        lastFetchAtRef.current = Date.now();
      } catch {
        // keep previous me on transient/network errors
      } finally {
        loadingRef.current = false;

        if (mountedRef.current) {
          setRefreshing(false);
        }
      }
    },
    [phone, me, isAuthenticated, signOut, resetUserState]
  );

  useEffect(() => {
    refresh({ force: false });
  }, [refresh]);

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
