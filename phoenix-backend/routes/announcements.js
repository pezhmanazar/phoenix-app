// routes/announcements.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

// چند روز مونده به انقضا = expiring
const EXPIRING_DAYS = 7;

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vary", "Origin");
}

function computeUserFlags(user, now) {
  if (!user) {
    return { isFree: true, isPro: false, isExpiring: false, isExpired: false };
  }

  const plan = String(user.plan || "free").toLowerCase();
  const exp = user.planExpiresAt ? new Date(user.planExpiresAt) : null;

  const isFree = plan === "free";

  const isPaidPlan = plan === "pro" || plan === "vip";
  const isActivePaid = isPaidPlan && exp && exp.getTime() > now.getTime();

  const isExpired = isPaidPlan && (!exp || exp.getTime() <= now.getTime());

  const diffMs = exp ? exp.getTime() - now.getTime() : Infinity;
  const isExpiring =
    isActivePaid && diffMs <= EXPIRING_DAYS * 24 * 3600 * 1000;

  const isPro = isActivePaid; // یعنی پلن پولیِ فعال (pro یا vip)

  return { isFree, isPro, isExpiring, isExpired };
}

router.get("/active", async (req, res) => {
  try {
    noStore(res);

    const phone = String(req.query?.phone || "").trim();
    const now = new Date();

    // user (برای تعیین گروه)
    const user = phone
      ? await prisma.user.findUnique({
          where: { phone },
          select: { id: true, plan: true, planExpiresAt: true },
        })
      : null;

    const { isFree, isPro, isExpiring, isExpired } = computeUserFlags(user, now);

    // شرط گروه‌ها (فقط گروه‌های مربوط به همین کاربر)
    const targetOR = [];
    if (isFree) targetOR.push({ targetFree: true });
    if (isPro) targetOR.push({ targetPro: true });
    if (isExpiring) targetOR.push({ targetExpiring: true });
    if (isExpired) targetOR.push({ targetExpired: true });

    // اگر به هر دلیلی هیچ گروهی نشد (نباید بشه) → هیچی
    if (targetOR.length === 0) {
      return res.json({ ok: true, data: [] });
    }

    const active = await prisma.announcement.findMany({
      where: {
        enabled: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          { OR: targetOR }, // ✅ فیلتر گروه‌ها
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        message: true,
        level: true,
        placement: true,
        dismissible: true,
        enabled: true,
        startAt: true,
        endAt: true,
        priority: true,
        createdAt: true,
        updatedAt: true,

        // (اختیاری) برای دیباگ
        targetFree: true,
        targetPro: true,
        targetExpiring: true,
        targetExpired: true,
      },
    });

    // اگر phone نداریم یا user نداریم → فقط همین لیست رو بده
    if (!phone || !user) return res.json({ ok: true, data: active });

    // seen logic: فقط dismissible ها اگر seen شدند مخفی شوند
    const seen = await prisma.announcementSeen.findMany({
      where: { userId: user.id },
      select: { announcementId: true },
      take: 2000,
    });

    const seenSet = new Set(seen.map((x) => x.announcementId));

    const filtered = active.filter((a) => {
      // اجباری‌ها (dismissible=false) همیشه نمایش داده شوند
      if (!a.dismissible) return true;

      // اختیاری‌ها فقط اگر دیده نشده‌اند نمایش داده شوند
      return !seenSet.has(a.id);
    });

    return res.json({ ok: true, data: filtered });
  } catch (e) {
    console.error("announcements/active error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

//----

router.post("/seen", async (req, res) => {
  try {
    noStore(res);

    const phone = String(req.body?.phone || "").trim();
    const announcementId = String(req.body?.announcementId || "").trim();

    if (!phone) return res.status(400).json({ ok: false, error: "phone_required" });
    if (!announcementId) return res.status(400).json({ ok: false, error: "announcementId_required" });

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) return res.status(404).json({ ok: false, error: "user_not_found" });

    const ann = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true } });
    if (!ann) return res.status(404).json({ ok: false, error: "announcement_not_found" });

    await prisma.announcementSeen.upsert({
      where: { announcementId_userId: { announcementId, userId: user.id } },
      update: { seenAt: new Date() },
      create: { announcementId, userId: user.id, seenAt: new Date() },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("announcements/seen error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;