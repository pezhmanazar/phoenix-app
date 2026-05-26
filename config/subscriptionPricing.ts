export const SUBSCRIPTION_PRICING_FALLBACK = {
  bazaar: {
    p30: {
      price: "۴۹۹,۰۰۰ تومان",
      oldPrice: undefined,
      amount: 399000,
    },
    p90: {
      price: "۱,۰۹۹,۰۰۰ تومان",
      oldPrice: "۱,۴۹۷,۰۰۰ تومان",
      amount: 899000,
    },
    p180: {
      price: "۱,۸۹۹,۰۰۰ تومان",
      oldPrice: "۲,۹۹۹,۰۰۰ تومان",
      amount: 1499000,
    },
  },

  zarinpal: {
    p30: {
      price: "۳۹۹,۰۰۰ تومان",
      oldPrice: undefined,
      amount: 399000,
    },
    p90: {
      price: "۸۹۹,۰۰۰ تومان",
      oldPrice: "۱,۱۹۷,۰۰۰ تومان",
      amount: 899000,
    },
    p180: {
      price: "۱,۴۹۹,۰۰۰ تومان",
      oldPrice: "۲,۳۹۴,۰۰۰ تومان",
      amount: 1499000,
    },
  },
} as const;

export type SubscriptionProviderKey = keyof typeof SUBSCRIPTION_PRICING_FALLBACK;
export type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PRICING_FALLBACK["bazaar"];
export type SubscriptionPricingShape = typeof SUBSCRIPTION_PRICING_FALLBACK;
