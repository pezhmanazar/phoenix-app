//phoenix-app\lib\appUpdate.ts
import Constants from "expo-constants";

const VERSION_URL = "https://api.qoqnoos.app/api/app/version";

type AppVersionResponse = {
  ok?: boolean;
  latestVersion?: string;
  updateUrl?: string;
  forceUpdate?: boolean;
};

function normalizeVersion(v: string) {
  return String(v || "")
    .trim()
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
}

export function getCurrentAppVersion() {
  return (
    (Constants?.expoConfig as any)?.version ||
    (Constants?.manifest as any)?.version ||
    "1.0.0"
  );
}

export function isVersionOlder(current: string, latest: string) {
  const a = normalizeVersion(current);
  const b = normalizeVersion(latest);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;

    if (av < bv) return true;
    if (av > bv) return false;
  }

  return false;
}

export async function checkAppUpdate() {
  try {
    const res = await fetch(VERSION_URL, {
      headers: {
        "Cache-Control": "no-store",
      },
    });

    let json: AppVersionResponse | null = null;

    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok || !json?.latestVersion) {
      return {
        hasUpdate: false,
        currentVersion: getCurrentAppVersion(),
        latestVersion: null,
        updateUrl: null,
        forceUpdate: false,
      };
    }

    const currentVersion = getCurrentAppVersion();
    const latestVersion = String(json.latestVersion);
    const hasUpdate = isVersionOlder(currentVersion, latestVersion);

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      updateUrl: json.updateUrl || "https://qoqnoos.app/",
      forceUpdate: !!json.forceUpdate,
    };
  } catch {
    return {
      hasUpdate: false,
      currentVersion: getCurrentAppVersion(),
      latestVersion: null,
      updateUrl: null,
      forceUpdate: false,
    };
  }
}
