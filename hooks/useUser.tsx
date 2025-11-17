import React from 'react';
import { fetchMe, Me } from '@/api/user';

type UserState = {
  me: Me | null;
  loading: boolean;
  refreshing: boolean;
  error?: string | null;
  refresh: () => Promise<void>;
};

const Ctx = React.createContext<UserState | null>(null);

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
      setError(e?.message || 'ME_FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const refresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      const m = await fetchMe();
      setMe(m);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <Ctx.Provider value={{ me, loading, refreshing, error, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUser() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useUser must be used within <UserProvider>');
  return ctx;
}