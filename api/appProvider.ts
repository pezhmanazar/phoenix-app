import { toAppApi } from "../constants/env";
import { readPaymentProvider } from "../lib/payments/getPaymentProvider";

export async function syncAppProvider(
  sessionToken: string,
): Promise<void> {
  const paymentProvider = readPaymentProvider();

  const appProvider =
    paymentProvider === "bazaar"
      ? "bazaar"
      : "direct";

  const res = await fetch(
    toAppApi("/api/users/app-provider"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        appProvider,
      }),
    },
  );

  if (!res.ok) {
    const json = await res
      .json()
      .catch(() => ({}));

    throw new Error(
      json?.error ||
      `APP_PROVIDER_SYNC_${res.status}`,
    );
  }
}