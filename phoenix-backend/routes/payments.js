// routes/payments.js
import express from "express";

const router = express.Router();

/**
 * زرین‌پال یا بعضی کلاینت‌ها ممکنه هنوز این کال‌بک قدیمی رو بزنن:
 * /api/payments/zarinpal/callback
 * ما اینجا همه چیز رو به /api/pay/verify پاس می‌دیم.
 */
router.get("/zarinpal/callback", (req, res) => {
  // همون query هایی که زرین‌پال می‌فرسته رو عیناً منتقل کن
  const q = new URLSearchParams(req.query).toString();
  const target = `/api/pay/verify${q ? `?${q}` : ""}`;
  return res.redirect(302, target);
});

export default router;