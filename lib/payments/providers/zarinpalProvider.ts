import type { PaymentApi } from "../getPaymentProvider";

export const zarinpalProvider: PaymentApi = {
  id: "zarinpal",
  async isAvailable() {
    return true;
  },
  async purchaseSubscription() {
    throw new Error("Zarinpal provider not wired in this provider yet.");
  },
  async restorePurchases() {
    // no-op
  },
};