import { toAppApi } from "@/constants/env";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

type CompleteTaskPayload = {
  taskId: string;
  done?: boolean;
  result?: Record<string, unknown>;
};

type UseCompleteTaskOptions = {
  stageCode: string;
};

export function useCompleteTask({ stageCode }: UseCompleteTaskOptions) {
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const completeTask = async (payload: CompleteTaskPayload) => {
    try {
      setLoading(true);

      const safeStageCode = encodeURIComponent(stageCode);
      const url = toAppApi(`/api/pelekan/stage/${safeStageCode}/task/complete`);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskId: payload.taskId,
          done: payload.done !== false,
          result: payload.result ?? undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const backendError = json?.error || json?.message;

        if (backendError === "INVALID_TASK_FOR_CURRENT_DAY") {
          throw new Error(
            "این روز، روز فعال فعلی تو نیست. برای انجام تمرین‌ها باید وارد روز فعال مسیرت بشی."
          );
        }

        if (backendError === "INVALID_STAGE_CODE") {
          throw new Error("کد مرحله معتبر نیست.");
        }

        if (backendError === "TASK_ID_REQUIRED") {
          throw new Error("شناسه تمرین ارسال نشده است.");
        }

        throw new Error(backendError || `خطای ${res.status}`);
      }

      return json;
    } catch (e: any) {
      console.warn("BACKEND LOG:", e?.message);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { loading, completeTask };
}
