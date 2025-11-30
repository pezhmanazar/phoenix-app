// phoenix-app/hooks/useUser.tsx
import React from "react";
import { fetchMe, Me } from "@/api/user";

type UserPlan = "free" | "pro" | "vip";

type UserState = {
  me: Me | null;
  loading: boolean;
  refreshing: boolean;
  error?: string | null;
  refresh: () => Promise<void>;

  // فلگ‌های اشتراک
  plan: UserPlan;
  planExpiresAt: string | null;
  isPro: boolean;
  isExpired: boolean;
  daysLeft: number | null;

  // فلگ پروفایل
  hasCompletedProfile: boolean;
};

const Ctx = React.createContext<UserState | null>(null);

function calcPlanFlags(rawPlan: any, rawExpiresAt: any) {
  const plan = (rawPlan as UserPlan) || "free";

  const expiresAt =
    typeof rawExpiresAt === "string" && rawExpiresAt.trim().length > 0
      ? rawExpiresAt
      : null;

  if (!expiresAt) {
    return {
      plan,
      planExpiresAt: null as string | null,
      isPro: plan === "pro" || plan === "vip",
      isExpired: false,
      daysLeft: null as number | null,
    };
  }

  const expMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expMs)) {
    return {
      plan,
      planExpiresAt: expiresAt,
      isPro: plan === "pro" || plan === "vip",
      isExpired: false,
      daysLeft: null as number | null,
    };
  }

  const now = Date.now();
  const diffMs = expMs - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isExpired = diffMs <= 0;

  return {
    plan,
    planExpiresAt: expiresAt,
    isPro: !isExpired && (plan === "pro" || plan === "vip"),
    isExpired,
    daysLeft: isExpired ? 0 : diffDays,
  };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const m = await fetchMe();
      setMe(m);
    } catch (e: any) {
      setError(e?.message || "ME_FETCH_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const refresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const m = await fetchMe();
      setMe(m);
    } catch (e: any) {
      setError(e?.message || "ME_REFRESH_FAILED");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const flags = React.useMemo(
    () => calcPlanFlags((me as any)?.plan, (me as any)?.planExpiresAt),
    [me]
  );

  const hasCompletedProfile = !!(me as any)?.profileCompleted;

  return (
    <Ctx.Provider
      value={{
        me,
        loading,
        refreshing,
        error,
        refresh,
        ...flags,
        hasCompletedProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUser() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}