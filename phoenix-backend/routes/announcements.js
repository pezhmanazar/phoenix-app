// routes/announcements.js
import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

// برای اینکه CDNها قاطی نکنن
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vary", "Origin");
}

// GET /api/announcements/active?phone=09...
// فعال‌ها را بر اساس زمان + enabled + priority برمی‌گرداند
router.get("/active", async (req, res) => {
  try {
    noStore(res);

    const phone = String(req.query?.phone || "").trim();
    const now = new Date();

    const active = await prisma.announcement.findMany({
      where: {
        enabled: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
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
      },
    });

    // اگر phone نفرستاده بود، همون لیست را بده (برای تست ساده)
    if (!phone) {
      return res.json({ ok: true, data: active });
    }

    // اگر phone هست، آیتم‌های dismissible=false که قبلا دیده شده‌اند حذف شوند؟
    // منطق: فقط اجباری‌ها (dismissible=false) را یک‌بار نشان بدهیم.
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (!user) {
      // کاربر هنوز وجود ندارد => همه را نشان بده
      return res.json({ ok: true, data: active });
    }

    const seen = await prisma.announcementSeen.findMany({
      where: { userId: user.id },
      select: { announcementId: true },
      take: 2000,
    });

    const seenSet = new Set(seen.map((x) => x.announcementId));

    const filtered = active.filter((a) => {
      // اختیاری‌ها همیشه می‌تونن دوباره نمایش داده بشن
      if (a.dismissible) return true;
      // اجباری‌ها فقط اگر قبلاً seen نشده باشند نمایش داده شوند
      return !seenSet.has(a.id);
    });

    return res.json({ ok: true, data: filtered });
  } catch (e) {
    console.error("announcements/active error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST /api/announcements/seen
// body: { phone, announcementId }
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