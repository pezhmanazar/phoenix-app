import { doJson, type ApiResp } from "./user";

const API_URL = "https://api.qoqnoos.app";

function achievementUrl(path: string) {
  const base = API_URL.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export type AchievementKind = "medal" | "badge";

export type AchievementItem = {
  code: string;
  kind: AchievementKind;

  titleFa: string;
  description: string | null;
  iconKey: string | null;

  unlocked: boolean;
  earnedAt: string | null;
};

export type AchievementSummary = {
  total: number;
  unlocked: number;
  locked: number;
};

export type UserAchievements = {
  summary: AchievementSummary;
  achievements: AchievementItem[];
};

export async function getMyAchievements(): Promise<
  ApiResp<UserAchievements>
> {
  return doJson<UserAchievements>(
    achievementUrl("/api/achievements/me"),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );
}