//phoenix-app\app\pelekan\gosastan\[code].tsx
import AppBannerModal from "@/components/ui/AppBannerModal";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCompleteTask } from "@/components/pelekan/daily/useCompleteTask";
import AudioReflectionTemplate from "../../../components/pelekan/daily/templates/AudioReflectionTemplate";
import CommitmentTemplate from "../../../components/pelekan/daily/templates/CommitmentTemplate";
import MoodBoostTemplate from "../../../components/pelekan/daily/templates/MoodBoostTemplate";
import MoodCheckinTemplate from "../../../components/pelekan/daily/templates/MoodCheckinTemplate";
import NoContactCheckTemplate from "../../../components/pelekan/daily/templates/NoContactCheckTemplate";
import QuizAudioTemplate from "../../../components/pelekan/daily/templates/QuizAudioTemplate";
import ReminderTemplate from "../../../components/pelekan/daily/templates/ReminderTemplate";
import RoutineFlowTemplate from "../../../components/pelekan/daily/templates/RoutineFlowTemplate";
import type { BackendDayTask } from "../../../components/pelekan/daily/types";
import { isTaskOfTemplate } from "../../../components/pelekan/daily/types";
import DefaultTaskPlaceholder from "../../../components/pelekan/daily/ui/DefaultTaskPlaceholder";
import { resolveTaskByCode } from "../../../components/pelekan/gosastan/registry";


export default function GosastanTaskScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
  dayCode?: string | string[];
  dayNumber?: string | string[];
  code?: string | string[];
  taskId?: string | string[];
  titleFa?: string | string[];
  isDone?: string | string[];
  isRequired?: string | string[];
  suggestedTimeFa?: string | string[];
  description?: string | string[];
  noContactCurrentDays?: string | string[];
  noContactBestDays?: string | string[];
  noContactWarningState?: string | string[];
  noContactViolationCount?: string | string[];
  noContactResetCount?: string | string[];
}>();

const { completeTask, loading: isSubmitting } = useCompleteTask({
  stageCode: "gosastan",
});

const [noContactResult, setNoContactResult] = useState<Record<string, unknown> | null>(null);
const [banner, setBanner] = useState<{
  visible: boolean;
  kind: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  }>({
  visible: false,
  kind: "info",
  title: "",
});

const shouldNavigateAfterBannerRef = useRef(false);

const handleBackToDailyTasks = useCallback(() => {
  router.back();
}, [router]);


  const code = useMemo(() => {
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  return (rawCode || "").trim();
}, [params.code]);

const dayCode = useMemo(() => {
  const rawDayCode = Array.isArray(params.dayCode)
    ? params.dayCode[0]
    : params.dayCode;
  return (rawDayCode || "").trim();
}, [params.dayCode]);

const dayNumber = useMemo(() => {
  const rawDayNumber = Array.isArray(params.dayNumber)
    ? params.dayNumber[0]
    : params.dayNumber;

  return (rawDayNumber || "1").trim();
}, [params.dayNumber]);


const handleBannerClose = useCallback(() => {

  setBanner((prev) => ({ ...prev, visible: false }));

  if (shouldNavigateAfterBannerRef.current) {
    shouldNavigateAfterBannerRef.current = false;
    router.back();
  }
}, [router]);


  const backendTask = useMemo<BackendDayTask | null>(() => {
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const titleFa = Array.isArray(params.titleFa) ? params.titleFa[0] : params.titleFa;
  const description = Array.isArray(params.description)
    ? params.description[0]
    : params.description;
  const suggestedTimeFa = Array.isArray(params.suggestedTimeFa)
    ? params.suggestedTimeFa[0]
    : params.suggestedTimeFa;
  const isRequired = Array.isArray(params.isRequired)
    ? params.isRequired[0]
    : params.isRequired;
  const isDone = Array.isArray(params.isDone) ? params.isDone[0] : params.isDone;
    const rawNoContactCurrentDays = Array.isArray(params.noContactCurrentDays)
  ? params.noContactCurrentDays[0]
  : params.noContactCurrentDays;

const rawNoContactBestDays = Array.isArray(params.noContactBestDays)
  ? params.noContactBestDays[0]
  : params.noContactBestDays;

const rawNoContactWarningState = Array.isArray(params.noContactWarningState)
  ? params.noContactWarningState[0]
  : params.noContactWarningState;

const rawNoContactViolationCount = Array.isArray(params.noContactViolationCount)
  ? params.noContactViolationCount[0]
  : params.noContactViolationCount;

const rawNoContactResetCount = Array.isArray(params.noContactResetCount)
  ? params.noContactResetCount[0]
  : params.noContactResetCount;


  if (!code || !taskId) return null;

    return {
    id: String(taskId),
    code,
    titleFa: String(titleFa || ""),
    description: description ? String(description) : null,
    suggestedTimeFa: suggestedTimeFa ? String(suggestedTimeFa) : null,
    isRequired: String(isRequired || "") === "true",
    isDone: String(isDone || "") === "true",
    noContactStreak:
  rawNoContactCurrentDays == null ||
  rawNoContactCurrentDays === "" ||
  !Number.isFinite(Number(rawNoContactCurrentDays))
    ? null
    : {
        currentDays: Number(rawNoContactCurrentDays),
        bestDays:
          rawNoContactBestDays != null &&
          rawNoContactBestDays !== "" &&
          Number.isFinite(Number(rawNoContactBestDays))
            ? Number(rawNoContactBestDays)
            : Number(rawNoContactCurrentDays),
        warningState:
          rawNoContactWarningState != null && rawNoContactWarningState !== ""
            ? String(rawNoContactWarningState)
            : "none",
        violationCount:
          rawNoContactViolationCount != null &&
          rawNoContactViolationCount !== "" &&
          Number.isFinite(Number(rawNoContactViolationCount))
            ? Number(rawNoContactViolationCount)
            : 0,
        resetCount:
          rawNoContactResetCount != null &&
          rawNoContactResetCount !== "" &&
          Number.isFinite(Number(rawNoContactResetCount))
            ? Number(rawNoContactResetCount)
            : 0,
      },
  };
}, [
  code,
  params.taskId,
  params.titleFa,
  params.description,
  params.suggestedTimeFa,
  params.isRequired,
  params.isDone,
  params.noContactCurrentDays,
  params.noContactBestDays,
  params.noContactWarningState,
  params.noContactViolationCount,
  params.noContactResetCount,
]
);

  const resolved = useMemo(() => {
  if (!code) return null;
  return resolveTaskByCode(code, backendTask ? [backendTask] : []);
}, [code, backendTask]);



  const handleTaskComplete = useCallback(
  async (data?: unknown) => {
    try {
      const isRoutineFlow = resolved?.config.template === "routine_flow";
      const isMorningRoutine = resolved?.config.variant === "morning";

      if (isRoutineFlow) {
        const payload =
          data && typeof data === "object"
            ? (data as { redirectToJournal?: boolean })
            : undefined;

        if (isMorningRoutine && payload?.redirectToJournal) {
          router.replace("/(tabs)/Rooznegar" as any);
          return;
        }

        router.back();
        return;
      }

      const taskId = resolved?.backendTask?.id;

      if (!taskId) {
        throw new Error("شناسه تسک برای ثبت نهایی پیدا نشد");
      }

const response = await completeTask({
  taskId,
  result:
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : undefined,
});

const noContactMeta =
  response?.meta &&
  typeof response.meta === "object" &&
  "noContact" in response.meta
    ? (response.meta.noContact as Record<string, unknown>)
    : null;

if (resolved?.config.template === "no_contact_check" && noContactMeta) {
  setNoContactResult(noContactMeta);
  return;
}

shouldNavigateAfterBannerRef.current = true;

setBanner({
  visible: true,
  kind: "success",
  title: "ثبت شد",
  message: "آفرین؛ تمرینت با موفقیت ثبت شد.",
});
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "ثبت تمرین انجام نشد. چند لحظه بعد دوباره تلاش کن.";

      shouldNavigateAfterBannerRef.current = true;

      setBanner({
      visible: true,
      kind: "error",
      title: "ثبت انجام نشد",
      message,
      });

      console.warn("خطا در ثبت نهایی اقدام، یکبار دیگه تلاش کن:", err);
    }
  },
  [completeTask, resolved, router]
);


  if (!code) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.errorTitle}>کد تسک پیدا نشد</Text>
      </View>
    </SafeAreaView>
  );
}

if (!dayCode) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.errorTitle}>کد روز پیدا نشد</Text>
      </View>
    </SafeAreaView>
  );
}

  if (!resolved) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>تسک شناسایی نشد</Text>
          <Text style={styles.codeText}>{code}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTask = () => {
    if (isSubmitting && resolved.config.template !== "no_contact_check") {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#D4AF37" />
      <Text style={styles.loadingText}>در حال ثبت وضعیت...</Text>
    </View>
  );
}

        switch (resolved.config.template) {
      case "mood_checkin":
       if (isTaskOfTemplate(resolved, "mood_checkin")) {
       return (
      <MoodCheckinTemplate
        dayCode={dayCode}
        task={resolved}
        onComplete={handleTaskComplete}
      />
    );
  }
  return null;


      case "routine_flow":
        if (isTaskOfTemplate(resolved, "routine_flow")) {
          return (
<RoutineFlowTemplate
  stageCode="gosastan"
  dayCode={dayCode}
  task={resolved}
  onComplete={handleTaskComplete}
  returnRoute={{
    pathname: "/pelekan/gosastan/[code]",
    params: {
      code,
      dayCode,
      dayNumber,
      taskId: resolved.backendTask?.id,
      titleFa: resolved.backendTask?.titleFa,
      description: resolved.backendTask?.description ?? "",
      suggestedTimeFa: resolved.backendTask?.suggestedTimeFa ?? "",
      isDone: resolved.backendTask?.isDone ?? false,
      isRequired: resolved.backendTask?.isRequired ?? false,
      noContactCurrentDays:
        resolved.backendTask?.noContactStreak?.currentDays != null
          ? String(resolved.backendTask.noContactStreak.currentDays)
          : "",
      noContactBestDays:
        resolved.backendTask?.noContactStreak?.bestDays != null
          ? String(resolved.backendTask.noContactStreak.bestDays)
          : "",
      noContactWarningState:
        resolved.backendTask?.noContactStreak?.warningState ?? "",
      noContactViolationCount:
        resolved.backendTask?.noContactStreak?.violationCount != null
          ? String(resolved.backendTask.noContactStreak.violationCount)
          : "",
      noContactResetCount:
        resolved.backendTask?.noContactStreak?.resetCount != null
          ? String(resolved.backendTask.noContactStreak.resetCount)
          : "",
    },
  }}
/>
          );
        }
        return null;

      case "commitment":
        if (isTaskOfTemplate(resolved, "commitment")) {
          return (
            <CommitmentTemplate
            dayCode={dayCode}
            task={resolved}
           onComplete={handleTaskComplete}
          />
          );
        }
        return null;

      case "reminder":
        if (isTaskOfTemplate(resolved, "reminder")) {
          return (
            <ReminderTemplate
  dayCode={dayCode}
  task={resolved}
  onComplete={handleTaskComplete}
/>

          );
        }
        return null;

       case "quiz_audio":
        if (isTaskOfTemplate(resolved, "quiz_audio")) {
          return (
            <QuizAudioTemplate
              dayCode={dayCode}
              task={resolved}
              onComplete={handleTaskComplete}
            />
          );
        }
        return null;

        case "audio_reflection":
  if (isTaskOfTemplate(resolved, "audio_reflection")) {
    return (
      <AudioReflectionTemplate
        dayCode={dayCode}
        task={resolved}
        onComplete={handleTaskComplete}
      />
    );
  }
  return null;

  case "mood_boost":
  if (isTaskOfTemplate(resolved, "mood_boost")) {
    return (
      <MoodBoostTemplate
  dayCode={dayCode}
  task={resolved}
  onComplete={handleTaskComplete}
/>

    );
  }
  return null;

  case "no_contact_check":
  if (isTaskOfTemplate(resolved, "no_contact_check")) {
    return (
  <NoContactCheckTemplate
  dayCode={dayCode}
  task={resolved}
  onComplete={handleTaskComplete}
  onBackToDailyTasks={handleBackToDailyTasks}
  submissionResult={noContactResult}
/>
    );
  }
  return null;

      default:
        return <DefaultTaskPlaceholder resolvedTask={resolved} />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen
        options={{
          title: resolved.effectiveTitleFa,
          headerBackTitle: "بازگشت",
        }}
      />

      {renderTask()}

      <AppBannerModal
        visible={banner.visible}
        kind={banner.kind}
        title={banner.title}
        message={banner.message}
        onClose={handleBannerClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0b0f14",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  codeText: {
    marginTop: 12,
    color: "#D4AF37",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
  },
});
