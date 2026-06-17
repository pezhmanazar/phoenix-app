//phoenix-app\components\pelekan\sookhtan\registry.ts
import { sookhtanDay1Config } from "./day1-config";
import { sookhtanDay10Config } from "./day10-config";
import { sookhtanDay11Config } from "./day11-config";
import { sookhtanDay12Config } from "./day12-config";
import { sookhtanDay13Config } from "./day13-config";
import { sookhtanDay14Config } from "./day14-config";
import { sookhtanDay2Config } from "./day2-config";
import { sookhtanDay3Config } from "./day3-config";
import { sookhtanDay4Config } from "./day4-config";
import { sookhtanDay5Config } from "./day5-config";
import { sookhtanDay6Config } from "./day6-config";
import { sookhtanDay7Config } from "./day7-config";
import { sookhtanDay8Config } from "./day8-config";
import { sookhtanDay9Config } from "./day9-config";

import type {
  BackendDayTask,
  DayConfig,
  ResolvedTask,
  TaskConfig,
} from "../daily/types";

const dayConfigs: DayConfig[] = [
  sookhtanDay1Config,
  sookhtanDay2Config,
  sookhtanDay3Config,
  sookhtanDay4Config,
  sookhtanDay5Config,
  sookhtanDay6Config,
  sookhtanDay7Config,
  sookhtanDay8Config,
  sookhtanDay9Config,
  sookhtanDay10Config,
  sookhtanDay11Config,
  sookhtanDay12Config,
  sookhtanDay13Config,
  sookhtanDay14Config,
];

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
