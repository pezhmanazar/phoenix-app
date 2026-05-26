export const SUBSCRIPTION_PRICING = {
  bazaar: {
    p30: {
      price: "۴۹۹,۰۰۰ تومان",
      oldPrice: undefined,
      amount: 399000,
      months: 1,
      days: 30,
      plan: "pro",
    },
    p90: {
      price: "۱,۰۹۹,۰۰۰ تومان",
      oldPrice: "۱,۴۹۷,۰۰۰ تومان",
      amount: 899000,
      months: 3,
      days: 90,
      plan: "pro",
    },
    p180: {
      price: "۱,۸۹۹,۰۰۰ تومان",
      oldPrice: "۲,۹۹۹,۰۰۰ تومان",
      amount: 1499000,
      months: 6,
      days: 180,
      plan: "pro",
    },
  },

  zarinpal: {
    p30: {
      price: "۳۹۹,۰۰۰ تومان",
      oldPrice: undefined,
      amount: 399000,
      months: 1,
      days: 30,
      plan: "pro",
      plan: "pro",
    },
    p90: {
      price: "۸۹۹,۰۰۰ تومان",
      oldPrice: "۱,۱۹۷,۰۰۰ تومان",
      amount: 899000,
      months: 3,
      days: 90,
      plan: "pro",
    },
    p180: {
      price: "۱,۴۹۹,۰۰۰ تومان",
      oldPrice: "۲,۳۹۴,۰۰۰ تومان",
      amount: 1499000,
      months: 6,
      days: 180,
      plan: "pro",
    },
  },
};

export function getPublicSubscriptionPricing() {
  return {
    bazaar: {
      p30: {
        price: SUBSCRIPTION_PRICING.bazaar.p30.price,
        oldPrice: SUBSCRIPTION_PRICING.bazaar.p30.oldPrice,
        amount: SUBSCRIPTION_PRICING.bazaar.p30.amount,
      },
      p90: {
        price: SUBSCRIPTION_PRICING.bazaar.p90.price,
        oldPrice: SUBSCRIPTION_PRICING.bazaar.p90.oldPrice,
        amount: SUBSCRIPTION_PRICING.bazaar.p90.amount,
      },
      p180: {
        price: SUBSCRIPTION_PRICING.bazaar.p180.price,
        oldPrice: SUBSCRIPTION_PRICING.bazaar.p180.oldPrice,
        amount: SUBSCRIPTION_PRICING.bazaar.p180.amount,
      },
    },
    zarinpal: {
      p30: {
        price: SUBSCRIPTION_PRICING.zarinpal.p30.price,
        oldPrice: SUBSCRIPTION_PRICING.zarinpal.p30.oldPrice,
        amount: SUBSCRIPTION_PRICING.zarinpal.p30.amount,
      },
      p90: {
        price: SUBSCRIPTION_PRICING.zarinpal.p90.price,
        oldPrice: SUBSCRIPTION_PRICING.zarinpal.p90.oldPrice,
        amount: SUBSCRIPTION_PRICING.zarinpal.p90.amount,
      },
      p180: {
        price: SUBSCRIPTION_PRICING.zarinpal.p180.price,
        oldPrice: SUBSCRIPTION_PRICING.zarinpal.p180.oldPrice,
        amount: SUBSCRIPTION_PRICING.zarinpal.p180.amount,
      },
    },
  };
}

export function getZarinpalPlanConfig(planKey) {
  return SUBSCRIPTION_PRICING.zarinpal[planKey] || null;
}