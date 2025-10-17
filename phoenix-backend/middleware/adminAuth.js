// middleware/adminAuth.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export default async function adminAuth(req, res, next) {
  try {
    const key = req.header("x-api-key");
    if (!key) {
      return res.status(401).json({ ok: false, error: "missing_api_key" });
    }
    const admin = await prisma.admin.findUnique({ where: { apiKey: key } });
    if (!admin) {
      return res.status(401).json({ ok: false, error: "invalid_api_key" });
    }
    req.admin = { id: admin.id, email: admin.email, name: admin.name };
    next();
  } catch (e) {
    console.error("adminAuth error:", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}