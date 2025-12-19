// routes/announcements.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vary", "Origin");
}

function getPlanBucket(user, now = new Date()) {
  const plan = String(user?.plan || "free");
  const exp = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;

  // expired
  if (exp && exp.getTime() < now.getTime()) return "expired";

  // expiring (1..7 days)
  if (exp) {
    const ms = exp.getTime() - now.getTime();
    const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 7) return "expiring";
  }

  // pro / free
  if (plan === "pro") return "pro";
  return "free";
}

function targetWhere(bucket) {
  if (bucket === "expired") return { targetExpired: true };
  if (bucket === "expiring") return { targetExpiring: true };
  if (bucket === "pro") return { targetPro: true };
  return { targetFree: true };
}

/**
 * GET /api/announcements/active?phone=...
 * خروجی: بنرهای فعال، مخصوص همان کاربر، و unseen
 */
router.get("/active", async (req, res) => {
  try {
    noStore(res);

    const phone = String(req.query?.phone || "").trim();
    const now = new Date();

    // اگر phone نداریم: برای دیباگ/سرویس‌های عمومی، بنرهای فعال عمومی برگردان
    // (بدون target و بدون seen)
    if (!phone) {
      const active = await prisma.announcement.findMany({
        where: {
          enabled: true,
          placement: "top_banner",
          AND: [
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: 20,
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
        },
      });

      return res.json({ ok: true, data: active });
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, plan: true, planExpiresAt: true },
    });

    if (!user) return res.json({ ok: true, data: [] });

    const bucket = getPlanBucket(user, now);

    const rows = await prisma.announcement.findMany({
      where: {
        enabled: true,
        placement: "top_banner",
        ...targetWhere(bucket),
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],

        // ✅ unseen برای همه‌ی بنرها
        seenBy: { none: { userId: user.id } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 20,
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
      },
    });

    return res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("announcements/active error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * POST /api/announcements/seen
 * body: { phone, announcementId }
 */
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