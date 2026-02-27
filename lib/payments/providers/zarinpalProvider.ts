import type { PaymentApi, SubSku } from "../getPaymentProvider";

export const zarinpalProvider: PaymentApi = {
  id: "zarinpal",
  async isAvailable() {
    return true;
  },
  async purchaseSubscription(_sku: SubSku, _phone: string) {
    throw new Error("Zarinpal provider not wired in this provider yet.");
  },
  async restorePurchases(_phone: string) {
    // no-op
  },
};