//lib/errors/getFriendlyErrorMessage.ts
export function getFriendlyErrorMessage(input?: unknown): string {
  const code = String(input || "").trim();

  if (!code) return "مشکلی پیش آمد. لطفاً دوباره تلاش کن.";

  switch (code) {
    case "PHONE_MISSING":
    case "NO_PHONE":
      return "شماره موبایل پیدا نشد.";

    case "INVALID_JSON":
    case "NON_JSON_RESPONSE":
      return "پاسخ نامعتبر از سرور دریافت شد.";

    case "NETWORK_ERROR":
      return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کن.";

    case "AUTHORITY_MISSING":
      return "اطلاعات پرداخت کامل نیست. لطفاً دوباره تلاش کن.";

    case "STEP_MISSING":
      return "اطلاعات این مرحله کامل نیست. لطفاً دوباره تلاش کن.";

    case "BASELINE_STATE_FAILED":
      return "دریافت اطلاعات این بخش با مشکل مواجه شد.";

    case "FAILED":
    case "UNKNOWN_ERROR":
    case "SERVER_ERROR":
      return "مشکلی پیش آمد. لطفاً دوباره تلاش کن.";

    default:
      if (/^HTTP_\d{3}$/.test(code)) {
        return "در ارتباط با سرور مشکلی پیش آمد. لطفاً دوباره تلاش کن.";
      }

      if (/network|timeout|failed to fetch|socket|request failed/i.test(code)) {
        return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کن.";
      }

      return "مشکلی پیش آمد. لطفاً دوباره تلاش کن.";
  }
}
