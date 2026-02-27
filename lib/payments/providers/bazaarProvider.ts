import type { PaymentApi } from "../getPaymentProvider";

export const bazaarProvider: PaymentApi = {
  id: "bazaar",
  async isAvailable() {
    return true;
  },
  async purchaseSubscription() {
    throw new Error("Bazaar provider not implemented yet.");
  },
  async restorePurchases() {
    // later
  },
};