// server.js
import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs";
import mime from "mime-types";
import morgan from "morgan";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import adminAuth from "./middleware/adminAuth.js";
import adminRouter from "./routes/admin.js";
import aiRouter from "./routes/ai.js"; // روتر پشتیبانی هوش مصنوعی
import announcementsRouter from "./routes/announcements.js";
import authRouter from "./routes/auth.js"; // 🔹 روتر جدید احراز هویت / OTP
import mediaRouter from "./routes/media.js";
import payRouter from "./routes/pay.js"; // 🔹 روتر پرداخت / زرین‌پال (جدید)
import paymentsRouter from "./routes/payments.js";
import pelekanRouter from "./routes/pelekan.js";
import pelekanReviewRoutes from "./routes/pelekanReview.js";
import publicRouter from "./routes/public.js"; // روتر عمومی که /tickets هم دارد
import ticketsRouter from "./routes/tickets.js";
import usersRouter from "./routes/users.js"; // 🔹 روتر یوزرها
app.use("/api/media", mediaRouter);

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- App ----------
const app = express();
app.set("etag", false);
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// پوشه‌ی سایت استاتیک ققنوس
const PUBLIC_DIR = path.join(process.cwd(), "public");

// ---------- CORS & Logger ----------
app.disable("etag");
app.set("trust proxy", true);

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-token", "x-api-key"],
  })
);
app.options("*", cors());
app.use(morgan("dev"));



// ---------- Static site (Phoenix website) ----------
app.use(express.static(PUBLIC_DIR)); // /, /store.html, /contact.html, ...

// ---------- Static uploads ----------
const ROOT_UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

if (!fs.existsSync(ROOT_UPLOAD_DIR)) {
  fs.mkdirSync(ROOT_UPLOAD_DIR, { recursive: true });
}

app.use(
  "/uploads",
  express.static(ROOT_UPLOAD_DIR, { maxAge: "1y", index: false })
);
app.use("/api/payments", paymentsRouter);
// ---------- Multer (store in /uploads/<YYYY>) ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    try {
      const year = new Date().getFullYear().toString();
      const yearDir = path.join(ROOT_UPLOAD_DIR, year);
      if (!fs.existsSync(yearDir)) {
        fs.mkdirSync(yearDir, { recursive: true });
      }
      cb(null, yearDir);
    } catch (e) {
      cb(e, ROOT_UPLOAD_DIR);
    }
  },
  filename: (_, file, cb) => {
    const ext =
      mime.extension(file.mimetype) ||
      (path.extname(file.originalname).slice(1) || "bin");
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ---------- JSON parser (skip when multipart) ----------
const jsonUnlessMultipart = (req, res, next) => {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) return next();
  return express.json({ limit: "1mb" })(req, res, next);
};

app.use(jsonUnlessMultipart);
app.use(express.urlencoded({ extended: true, limit: "1mb" })); // برای فرم‌های پنل

app.use("/api/announcements", announcementsRouter);

// ---------- Upload helpers ----------
const withUploadAny = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return res.status(400).json({
        ok: false,
        error: err.code || "upload_error",
        message: err.message,
      });
    }

    if (Array.isArray(req.files) && req.files.length && !req.file) {
      req.file =
        req.files.find((f) => f.fieldname === "file") ||
        req.files.find((f) => f.fieldname === "attachment") ||
        req.files[0];
    }

    next();
  });
};

const maybeUpload = (req, res, next) => {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) return withUploadAny(req, res, next);
  return next();
};

const markParsed = (req, _res, next) => {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    req.headers["content-type"] = "application/x-upload-parsed";
  }
  next();
};

const logUploadDebug = (req, _res, next) => {
  try {
    console.log("⬇️ UPLOAD DEBUG", req.method, req.originalUrl);
    console.log("  content-type:", req.headers["content-type"]);
    console.log("  body:", req.body);

    if (Array.isArray(req.files) && req.files.length) {
      console.log(
        "  files:",
        req.files.map((f) => ({
          field: f.fieldname,
          name: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          path: f.path,
        }))
      );
    }

    if (req.file) {
      console.log("  file(single):", {
        field: req.file.fieldname,
        name: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
      });
    }
  } catch {}
  next();
};

const guardNoContent = (req, res, next) => {
  const hasFile =
    (Array.isArray(req.files) && req.files.length) || !!req.file;
  const hasText =
    typeof req.body?.text === "string" && req.body.text.trim().length > 0;

  if (!hasFile && !hasText) {
    return res.status(400).json({ ok: false, error: "no_content" });
  }
  next();
};

// ---------- Root (serve phoenix website) ----------
app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// 🔹 صفحه‌ی پرداخت تستی روی خود qoqnoos.app
app.get("/mock-pay", (req, res) => {
  const authority = String(req.query.authority || "");
  const amount = String(req.query.amount || "");
  const phone = String(req.query.phone || "");

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>پرداخت تستی ققنوس</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      background: #050816;
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #020617;
      border-radius: 24px;
      padding: 24px 20px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      text-align: center;
      border: 1px solid #111827;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 20px;
      color: #fbbf24;
      font-weight: 900;
    }
    .row {
      margin-top: 8px;
      font-size: 13px;
      color: #d1d5db;
      text-align: right;
    }
    .label {
      color: #9ca3af;
      margin-left: 4px;
    }
    .btns {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn {
      border-radius: 999px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }
    .btn-ok {
      background: #16a34a;
      color: #f9fafb;
    }
    .btn-cancel {
      background: #b91c1c;
      color: #f9fafb;
    }
    .hint {
      margin-top: 16px;
      font-size: 11px;
      color: #9ca3af;
      line-height: 1.8;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>پرداخت تستی</h1>
    <div class="row"><span class="label">Authority:</span> <code>${authority}</code></div>
    <div class="row"><span class="label">مبلغ:</span> ${amount}</div>
    <div class="row"><span class="label">موبایل:</span> ${phone}</div>
    <div class="btns">
      <button class="btn btn-ok" onclick="history.back()">بازگشت به برنامه (موفق)</button>
      <button class="btn btn-cancel" onclick="history.back()">بازگشت به برنامه (لغو)</button>
    </div>
    <div class="hint">
      این صفحه فقط برای شبیه‌سازی پرداخت در حالت تستی است.
      بعد از دیدن این صفحه می‌توانید به برنامه برگردید.
    </div>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});


// ---------- ✅ PING ----------
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, service: "phoenix-backend", time: Date.now() });
});

// ---------- Routes ----------
// تیکت‌ها
app.use("/api/tickets", ticketsRouter);
// ❌ روتر عمومی قدیمی رو برای مسیر /api/public/tickets غیرفعال کردیم
// app.use("/api/public/tickets", publicTicketsRouter);

// فقط برای مسیرهای public که آپلود می‌فرستند، میدل‌ویر آپلود را اعمال کن
app.use(
  "/api/public/tickets/:id/reply-upload",
  withUploadAny,
  markParsed,
  logUploadDebug,
  guardNoContent
);
app.use(
  "/api/public/tickets/:id/reply",
  maybeUpload,
  markParsed,
  logUploadDebug
);

// پشتیبانی هوش مصنوعی
app.use("/api/public/ai", aiRouter);

// 🔹 مسیرهای یوزر (me / upsert)
app.use("/api/users", usersRouter);

// 🔹 مسیرهای احراز هویت (OTP و JWT)
app.use("/api/auth", authRouter);

// 🔹 پرداخت / زرین‌پال
app.use("/api/pay", payRouter);

// تمام مسیرهای عمومی
app.use("/api/public", publicRouter);

// پنل ادمین
app.use("/api/admin", adminRouter);

app.get("/api/admin/me", adminAuth, (req, res) =>
  res.json({ ok: true, admin: req.admin })
);

app.use("/api/pelekan", pelekanRouter);
app.use("/api/pelekan/review", pelekanReviewRoutes);
// ---------- 404 ----------
app.use((req, res) =>
  res.status(404).json({ ok: false, error: "not_found" })
);

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

// ---------- Start ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Phoenix backend running on http://0.0.0.0:${PORT}`);
  console.log(`📦 Uploads: ${ROOT_UPLOAD_DIR}`);
});