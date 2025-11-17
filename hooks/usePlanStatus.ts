// hooks/usePlanStatus.ts
import { useUser } from "../hooks/useUser";
import { getPlanStatus } from "../lib/plan";

export function usePlanStatus() {
  const { me } = useUser();
  const status = getPlanStatus(me);

  return {
    ...status,
    me, // اگر لازم شد جزئیات خود کاربر را هم داشته باشی
  };
}