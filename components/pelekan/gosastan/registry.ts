//phoenix-app\components\pelekan\gosastan\registry.ts
import { gosastanDay1Config } from "./day1-config";
import { gosastanDay2Config } from "./day2-config";
import { gosastanDay3Config } from "./day3-config";
import { gosastanDay4Config } from "./day4-config";
import { gosastanDay5Config } from "./day5-config";


import type {
  BackendDayTask,
  DayConfig,
  ResolvedTask,
  TaskConfig,
} from "../daily/types";

const dayConfigs: DayConfig[] = [gosastanDay1Config, gosastanDay2Config, gosastanDay3Config, gosastanDay4Config, gosastanDay5Config];

export function getAllDayConfigs(): DayConfig[] {
  return dayConfigs;
}

export function getTaskConfigByCode(taskCode: string): TaskConfig | null {
  for (const day of dayConfigs) {
    const found = day.tasks.find((task) => task.code === taskCode);
    if (found) return found;
  }

  return null;
}

export function getDayConfigByTaskCode(taskCode: string): DayConfig | null {
  for (const day of dayConfigs) {
    const found = day.tasks.find((task) => task.code === taskCode);
    if (found) return day;
  }

  return null;
}

export function resolveTaskByCode(
  taskCode: string,
  backendTasks: BackendDayTask[] = []
): ResolvedTask | null {
  const config = getTaskConfigByCode(taskCode);
  if (!config) return null;

  const backendTask =
    backendTasks.find((task) => task.code === taskCode) ?? null;

  return {
    config,
    backendTask,
    effectiveTitleFa: backendTask?.titleFa || config.titleFa,
    effectiveDescription: backendTask?.description ?? config.descriptionFa ?? null,
    effectiveRequired: backendTask?.isRequired ?? config.required,
    isCompleted: backendTask?.isDone ?? false,
  };
}
