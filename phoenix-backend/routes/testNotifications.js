import express from "express";
import prisma from "../utils/prisma.js";

const router = express.Router();

router.get("/baseline-check", async (req, res) => {
  try {

    const users = await prisma.assessmentSession.findMany({
      where: {
        kind: "hb_baseline",
        status: "in_progress",
      },
      select: {
        id: true,
        userId: true,
        currentIndex: true,
        totalItems: true,
        updatedAt: true,
      },
    });


    return res.json({
      ok: true,
      count: users.length,
      users,
    });


  } catch (e) {
    console.error(e);

    return res.status(500).json({
      ok:false,
      error:e.message,
    });
  }
});


export default router;