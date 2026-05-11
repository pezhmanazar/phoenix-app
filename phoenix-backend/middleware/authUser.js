// middleware/authUser.js
import jwt from "jsonwebtoken";

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function unauthorized(res, code = "UNAUTHORIZED", status = 401) {
  return res.status(status).json({
    ok: false,
    error: code,
  });
}

function extractBearerToken(req) {
  const auth = cleanString(req.headers?.authorization);
  if (!auth) return null;

  const parts = auth.split(" ");
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;

  return cleanString(token);
}

export default function authUser(req, res, next) {
  try {
    const appSecret =
      process.env.APP_JWT_SECRET || process.env.JWT_SECRET || "";

    // 1) JWT auth
    const token = extractBearerToken(req);
    if (token) {
      if (!appSecret) {
        console.error("[authUser] APP_JWT_SECRET missing");
        return unauthorized(res, "UNAUTHORIZED", 401);
      }

      try {
        const payload = jwt.verify(token, appSecret);

        const phone = cleanString(payload?.phone);
        const id = cleanString(payload?.id || payload?.userId);

        if (!phone && !id) {
          return unauthorized(res, "UNAUTHORIZED", 401);
        }

        req.user = {
          id: id || null,
          phone: phone || null,
        };

        return next();
      } catch (e) {
        return unauthorized(res, "UNAUTHORIZED", 401);
      }
    }

    // 2) حالت استاندارد اگر upstream قبلاً ست کرده
    if (req.user && (cleanString(req.user.id) || cleanString(req.user.phone))) {
      req.user = {
        id: cleanString(req.user.id),
        phone: cleanString(req.user.phone),
      };
      return next();
    }

    // 3) fallback موقت
    const trustedPhone = cleanString(req.userPhone);
    if (trustedPhone) {
      req.user = {
        id: null,
        phone: trustedPhone,
      };
      return next();
    }

    return unauthorized(res, "UNAUTHORIZED", 401);
  } catch (err) {
    return unauthorized(res, "UNAUTHORIZED", 401);
  }
}
