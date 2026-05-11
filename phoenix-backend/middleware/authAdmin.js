// middleware/authAdmin.js
import prisma from "../utils/prisma.js";

function parseCookies(cookieHeader = "") {
  const out = {};

  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;

    try {
      out[k] = decodeURIComponent(v.join("=") || "");
    } catch {
      out[k] = v.join("=") || "";
    }
  });

  return out;
}

export async function authAdmin(req, res, next) {
  try {
    const hdr = String(req.headers["x-admin-token"] || "").trim();
    const ck = parseCookies(String(req.headers.cookie || ""));
    const token = hdr || String(ck.admin_token || "").trim();

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "token_required",
      });
    }

    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({
        ok: false,
        error: "invalid_or_expired",
      });
    }

    if (!session.admin) {
      return res.status(401).json({
        ok: false,
        error: "admin_not_found",
      });
    }

    req.admin = session.admin;
    req.adminToken = token;

    return next();
  } catch (e) {
    console.error("authAdmin error:", e?.message || "unknown_error");
    return res.status(500).json({
      ok: false,
      error: "internal_error",
    });
  }
}

export const allowAdmin = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
      });
    }

    return next();
  };
};
