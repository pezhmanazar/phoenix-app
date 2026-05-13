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
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return fallback;
  }
}
