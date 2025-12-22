// phoenix-backend/routes/pelekanReview.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

/* ------------------------------ helpers ------------------------------ */
function now() {
  return new Date();
}

function isUserPro(user) {
  if (!user) return false;
  if (String(user.plan || "").toLowerCase() !== "pro") return false;
  if (!user.planExpiresAt) return true;
  return new Date(user.planExpiresAt).getTime() > Date.now();
}

async function getUserByPhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return null;
  return prisma.user.findUnique({ where: { phone: p } });
}

function safeJson(obj) {
  try {
    return obj ?? null;
  } catch {
    return null;
  }
}

/**
 * ساختار answersJson پیشنهادی:
 * {
 *   test1: { answers: number[] },   // بازسنجی رابطه
 *   test2: { answers: number[] },   // آیا برمی‌گرده؟
 * }
 *
 * resultJson پیشنهادی (فعلاً اسکلت):
 * {
 *   locked: boolean,
 *   diagrams: {...},
 *   summary: "...",
 * }
 */

function ensureAnswersShape(answersJson) {
  const a = answersJson && typeof answersJson === "object" ? answersJson : {};
  if (!a.test1) a.test1 = { answers: [] };
  if (!a.test2) a.test2 = { answers: [] };
  if (!Array.isArray(a.test1.answers)) a.test1.answers = [];
  if (!Array.isArray(a.test2.answers)) a.test2.answers = [];
  return a;
}

/* ------------------------------ routes ------------------------------ */

// GET state (برای اپ)
router.get("/state", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({
      where: { userId: user.id },
    });

    return res.json({
      ok: true,
      data: {
        hasSession: !!session,
        session: session
          ? {
              id: session.id,
              status: session.status,
              chosenPath: session.chosenPath,
              currentTest: session.currentTest,
              currentIndex: session.currentIndex,
              test1CompletedAt: session.test1CompletedAt,
              test2CompletedAt: session.test2CompletedAt,
              paywallShownAt: session.paywallShownAt,
              unlockedAt: session.unlockedAt,
            }
          : null,
        user: {
          plan: user.plan,
          isPro: isUserPro(user),
        },
      },
    });
  } catch (e) {
    console.log("[pelekanReview/state] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST choose path (دو گزینه‌ای که گفتی)
router.post("/choose", async (req, res) => {
  try {
    const { phone, choice } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const normalized = String(choice || "").trim();
    // دو گزینه:
    // 1) "skip_review" => میخوام فراموشش کنم
    // 2) "review"      => میخوام احتمال درست شدن رابطه رو بررسی کنم
    if (normalized !== "skip_review" && normalized !== "review") {
      return res.json({ ok: false, error: "INVALID_CHOICE" });
    }

    const session = await prisma.pelekanReviewSession.upsert({
      where: { userId: user.id },
      update: {
        chosenPath: normalized,
        updatedAt: now(),
      },
      create: {
        userId: user.id,
        chosenPath: normalized,
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
      },
    });

    return res.json({ ok: true, data: { sessionId: session.id, chosenPath: session.chosenPath } });
  } catch (e) {
    console.log("[pelekanReview/choose] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST start review (شروع آزمون 1)
router.post("/start", async (req, res) => {
  try {
    const { phone, force } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const existing = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });

    // اگر قبلاً تمام شده و force نیست، اجازه نده دوباره شروع کنه
    if (existing && existing.status !== "in_progress" && !force) {
      return res.json({ ok: false, error: "ALREADY_COMPLETED" });
    }

    const session = await prisma.pelekanReviewSession.upsert({
      where: { userId: user.id },
      update: {
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
        startedAt: existing?.startedAt ?? now(),
        completedAt: null,
        paywallShownAt: null,
        unlockedAt: null,
        test1CompletedAt: null,
        test2CompletedAt: null,
        answersJson: safeJson(ensureAnswersShape(existing?.answersJson)),
        resultJson: null,
        updatedAt: now(),
      },
      create: {
        userId: user.id,
        status: "in_progress",
        currentTest: 1,
        currentIndex: 0,
        answersJson: ensureAnswersShape(null),
      },
    });

    return res.json({
      ok: true,
      data: {
        sessionId: session.id,
        status: session.status,
        currentTest: session.currentTest,
        currentIndex: session.currentIndex,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/start] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST answer (برای هر سوال)
router.post("/answer", async (req, res) => {
  try {
    const { phone, testNo, index, value } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const t = Number(testNo);
    const i = Number(index);
    const v = Number(value);

    if (![1, 2].includes(t)) return res.json({ ok: false, error: "INVALID_TEST" });
    if (!Number.isFinite(i) || i < 0) return res.json({ ok: false, error: "INVALID_INDEX" });
    if (!Number.isFinite(v) || v < 0) return res.json({ ok: false, error: "INVALID_VALUE" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });
    if (session.status !== "in_progress") return res.json({ ok: false, error: "NOT_IN_PROGRESS" });

    const answers = ensureAnswersShape(session.answersJson);
    const key = t === 1 ? "test1" : "test2";

    // ثبت پاسخ
    answers[key].answers[i] = v;

    // آپدیت pointer
    const nextIndex = i + 1;
    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        answersJson: answers,
        currentTest: t,
        currentIndex: nextIndex,
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        currentTest: updated.currentTest,
        currentIndex: updated.currentIndex,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/answer] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST mark test completed (وقتی آزمون 1 یا 2 تمام شد)
router.post("/complete-test", async (req, res) => {
  try {
    const { phone, testNo } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const t = Number(testNo);
    if (![1, 2].includes(t)) return res.json({ ok: false, error: "INVALID_TEST" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    const data = {};
    if (t === 1) {
      data.test1CompletedAt = now();
      data.currentTest = 2;
      data.currentIndex = 0;
    } else {
      data.test2CompletedAt = now();
    }

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: { ...data, updatedAt: now() },
    });

    return res.json({
      ok: true,
      data: {
        test1CompletedAt: updated.test1CompletedAt,
        test2CompletedAt: updated.test2CompletedAt,
        currentTest: updated.currentTest,
        currentIndex: updated.currentIndex,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/complete-test] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// POST finish (بعد از اتمام آزمون 2، نتیجه قفل میشه)
router.post("/finish", async (req, res) => {
  try {
    const { phone } = req.body || {};
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    // باید هر دو آزمون completed باشند
    if (!session.test1CompletedAt || !session.test2CompletedAt) {
      return res.json({ ok: false, error: "TESTS_NOT_COMPLETED" });
    }

    // فعلاً فقط اسکلت resultJson می‌سازیم (الگوریتم واقعی مرحله بعد)
    const locked = !isUserPro(user);
    const resultJson = {
      locked,
      message: locked
        ? "نتیجه‌ی کامل بعد از فعال‌سازی PRO نمایش داده می‌شود."
        : "نتیجه آماده است.",
      diagrams: null,
      summary: null,
    };

    const status = locked ? "completed_locked" : "unlocked";

    const updated = await prisma.pelekanReviewSession.update({
      where: { userId: user.id },
      data: {
        status,
        completedAt: now(),
        resultJson,
        paywallShownAt: locked ? now() : null,
        unlockedAt: locked ? null : now(),
        updatedAt: now(),
      },
    });

    return res.json({
      ok: true,
      data: {
        status: updated.status,
        locked,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/finish] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// GET result (اگر قفل بود فقط پیام paywall بده)
router.get("/result", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    const user = await getUserByPhone(phone);
    if (!user) return res.json({ ok: false, error: "USER_NOT_FOUND" });

    const session = await prisma.pelekanReviewSession.findUnique({ where: { userId: user.id } });
    if (!session) return res.json({ ok: false, error: "NO_SESSION" });

    const pro = isUserPro(user);

    // اگر session قفل است ولی کاربر پرو شده، بازش کن
    if (session.status === "completed_locked" && pro) {
      const updated = await prisma.pelekanReviewSession.update({
        where: { userId: user.id },
        data: {
          status: "unlocked",
          unlockedAt: now(),
          updatedAt: now(),
          resultJson: {
            ...(session.resultJson || {}),
            locked: false,
            message: "نتیجه آماده است.",
          },
        },
      });

      return res.json({ ok: true, data: { status: updated.status, result: updated.resultJson } });
    }

    // حالت قفل
    if (session.status === "completed_locked" && !pro) {
      // ثبت اینکه paywall دیده شد
      if (!session.paywallShownAt) {
        await prisma.pelekanReviewSession.update({
          where: { userId: user.id },
          data: { paywallShownAt: now(), updatedAt: now() },
        });
      }
      return res.json({
        ok: true,
        data: {
          status: session.status,
          result: {
            locked: true,
            message: "برای دیدن نتیجه‌ی کامل (۴ نمودار + جمع‌بندی درمان‌محور) باید PRO را فعال کنی.",
          },
        },
      });
    }

    // unlocked یا in_progress
    return res.json({
      ok: true,
      data: {
        status: session.status,
        result: session.resultJson || null,
      },
    });
  } catch (e) {
    console.log("[pelekanReview/result] error", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;