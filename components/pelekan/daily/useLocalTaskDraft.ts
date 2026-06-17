//phoenix-app\components\pelekan\gosastan\useLocalTaskDraft.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalTaskDraft } from "./types";

const DRAFT_VERSION = 1;

function getDraftKey(dayCode: string, taskCode: string) {
  return `pelekan:draft:${dayCode}:${taskCode}`;
}

export async function clearAllPelekanDrafts() {
  const keys = await AsyncStorage.getAllKeys();

  const draftKeys = keys.filter((key) =>
    key.startsWith("pelekan:draft:")
  );

  if (draftKeys.length > 0) {
    await AsyncStorage.multiRemove(draftKeys);
  }

  console.log("Cleared pelekan draft keys:", draftKeys);

  return draftKeys;
}

export function useLocalTaskDraft(dayCode: string, taskCode: string) {
  const storageKey = useMemo(() => getDraftKey(dayCode, taskCode), [dayCode, taskCode]);

  const [draft, setDraft] = useState<LocalTaskDraft>({
    dayCode,
    taskCode,
    version: DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    values: {},
    completedSteps: [],
  });

  const [loading, setLoading] = useState(true);

  const loadDraft = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await AsyncStorage.getItem(storageKey);

      if (!raw) {
        setDraft({
          dayCode,
          taskCode,
          version: DRAFT_VERSION,
          updatedAt: new Date().toISOString(),
          values: {},
          completedSteps: [],
        });
        return;
      }

      const parsed = JSON.parse(raw);
      setDraft({
        dayCode,
        taskCode,
        version: parsed?.version || DRAFT_VERSION,
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
        values: parsed?.values || {},
        completedSteps: parsed?.completedSteps || [],
      });
    } catch (error) {
      console.warn("useLocalTaskDraft load error", error);
    } finally {
      setLoading(false);
    }
  }, [storageKey, dayCode, taskCode]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const saveDraft = useCallback(
    async (nextPartial: Partial<LocalTaskDraft>) => {
      const nextDraft: LocalTaskDraft = {
        ...draft,
        ...nextPartial,
        values: {
          ...draft.values,
          ...(nextPartial.values || {}),
        },
        completedSteps: nextPartial.completedSteps || draft.completedSteps || [],
        updatedAt: new Date().toISOString(),
      };

      setDraft(nextDraft);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextDraft));
      return nextDraft;
    },
    [draft, storageKey]
  );

  const setValue = useCallback(
    async (key: string, value: any) => {
      const nextValues = {
        ...draft.values,
        [key]: value,
      };

      const nextDraft: LocalTaskDraft = {
        ...draft,
        values: nextValues,
        updatedAt: new Date().toISOString(),
      };

      setDraft(nextDraft);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextDraft));
      return nextDraft;
    },
    [draft, storageKey]
  );

  const markStepCompleted = useCallback(
    async (stepKey: string) => {
      const current = draft.completedSteps || [];
      if (current.includes(stepKey)) return draft;

      const nextDraft: LocalTaskDraft = {
        ...draft,
        completedSteps: [...current, stepKey],
        updatedAt: new Date().toISOString(),
      };

      setDraft(nextDraft);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextDraft));
      return nextDraft;
    },
    [draft, storageKey]
  );

  const removeStepCompleted = useCallback(
    async (stepKey: string) => {
      const nextDraft: LocalTaskDraft = {
        ...draft,
        completedSteps: (draft.completedSteps || []).filter((x) => x !== stepKey),
        updatedAt: new Date().toISOString(),
      };

      setDraft(nextDraft);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextDraft));
      return nextDraft;
    },
    [draft, storageKey]
  );

  const clearDraft = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey);
    const emptyDraft: LocalTaskDraft = {
      dayCode,
      taskCode,
      version: DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      values: {},
      completedSteps: [],
    };
    setDraft(emptyDraft);
    return emptyDraft;
  }, [storageKey, dayCode, taskCode]);

  return {
    loading,
    draft,
    loadDraft,
    saveDraft,
    setValue,
    markStepCompleted,
    removeStepCompleted,
    clearDraft,
  };
}
