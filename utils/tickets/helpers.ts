// phoenix-app/utils/tickets/helpers.ts
export type MessageType = "text" | "voice" | "image" | "file";

export function detectType(
  mime?: string | null,
  url?: string | null
): MessageType {
  const m = (mime || "").toLowerCase();

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "voice";
  if (m) return "file";

  const u = (url || "").toLowerCase();

  if (
    u.endsWith(".png") ||
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".webp")
  ) {
    return "image";
  }

  if (
    u.endsWith(".mp3") ||
    u.endsWith(".wav") ||
    u.endsWith(".m4a") ||
    u.endsWith(".ogg")
  ) {
    return "voice";
  }

  if (u) return "file";
  return "text";
}

export function extractErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;

  const rawMessage =
    typeof err === "string"
      ? err
      : typeof err?.message === "string"
      ? err.message
      : "";

  const message = String(rawMessage || "").trim();
  const messageLower = message.toLowerCase();

  const isNetworkError =
    message === "NETWORK_UPLOAD_ERROR" ||
    messageLower.includes("network request failed") ||
    messageLower.includes("failed to fetch") ||
    messageLower.includes("internet") ||
    messageLower.includes("network error") ||
    messageLower.includes("timeout") ||
    messageLower.includes("aborterror") ||
    messageLower.includes("load failed");

  if (isNetworkError) {
    return "اینترنت شما قطعه یا شبکه مشکل داره";
  }

  if (message) {
    return message;
  }

  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}

