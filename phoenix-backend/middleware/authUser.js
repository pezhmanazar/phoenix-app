// middleware/authUser.js

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

/**
 * Middleware احراز هویت برای routeهای tickets
 *
 * نسخه فعلی عمداً سخت‌گیر است:
 * - از body/query/header خام مثل x-user-id هویت نمی‌گیرد
 * - فقط اگر upstream auth قبلاً req.user را ست کرده باشد می‌پذیرد
 * - یا در حالت موقت، اگر سیستم فعلی شما req.userPhone را از یک auth معتبر ست می‌کند
 *
 * خروجی خطا فقط code استاندارد می‌دهد
 * تا فرانت با getFriendlyErrorMessage آن را ترجمه کند.
 */
export default function authUser(req, res, next) {
  try {
    // حالت استاندارد و درست
    if (req.user && (cleanString(req.user.id) || cleanString(req.user.phone))) {
      req.user = {
        id: cleanString(req.user.id),
        phone: cleanString(req.user.phone),
      };
      return next();
    }

    /**
     * fallback محدود:
     * فقط اگر در backend از قبل بعد از auth معتبر جایی req.userPhone ست می‌شود.
     * این مقدار نباید از header خام کاربر آمده باشد.
     */
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
