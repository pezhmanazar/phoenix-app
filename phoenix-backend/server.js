// server.js

import cors from "cors";
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import multer from "multer";
import mime from "mime-types";

import adminAuth from "./middleware/adminAuth.js";
import adminRouter from "./routes/admin.js";
import ticketsRouter from "./routes/tickets.js";
import publicRouter from "./routes/public.js"; // روتر عمومی که /tickets هم دارد
import aiRouter from "./routes/ai.js"; // ⬅️ اضافه شد: روتر پشتیبانی هوش مصنوعی

// ---------- App ----------
const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
app.set("trust proxy", true);

// ---------- CORS & Logger ----------
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());
app.use(morgan("dev"));

// ---------- Static uploads ----------
const ROOT_UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(ROOT_UPLOAD_DIR)) fs.mkdirSync(ROOT_UPLOAD_DIR, { recursive: true });
app.use(
  "/uploads",
  express.static(ROOT_UPLOAD_DIR, { maxAge: "1y", index: false })
);

// ---------- Multer (store in /uploads/<YYYY>) ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    try {
      const year = new Date().getFullYear().toString();
      const yearDir = path.join(ROOT_UPLOAD_DIR, year);
      if (!fs.existsSync(yearDir)) fs.mkdirSync(yearDir, { recursive: true });
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

// optional: urlencoded برای پنل ادمین/فرم‌ها
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ---------- Upload helpers ----------
const withUploadAny = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return res
        .status(400)
        .json({ ok: false, error: err.code || "upload_error", message: err.message });
    }
    // اگر چند فایل باشد، یکی را به req.file نگه داریم
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

// بعد از پارسِ مولتر، content-type را تغییر بده تا دوباره پردازش نشود
const markParsed = (req, _res, next) => {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) {
    req.headers["content-type"] = "application/x-upload-parsed";
  }
  next();
};

// برای ردگیری مشکلات نام/شناسه هنگام ویس/عکس
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

// اگر نه فایل داریم نه متن، 400 بده
const guardNoContent = (req, res, next) => {
  const hasFile = (Array.isArray(req.files) && req.files.length) || !!req.file;
  const hasText =
    typeof req.body?.text === "string" && req.body.text.trim().length > 0;
  if (!hasFile && !hasText)
    return res.status(400).json({ ok: false, error: "no_content" });
  next();
};

// ---------- Routes ----------
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "phoenix-backend" })
);

// روتر تیکت داخلی (ادمین/مدیر)
app.use("/api/tickets", ticketsRouter);

// فقط برای مسیرهای public که آپلود می‌فرستند، میدل‌ویر آپلود را اعمال کن
// ترتیب مهم است: withUploadAny → markParsed → log → guard → publicRouter
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

// ⬅️ اضافه شد: مسیر پشتیبانی هوش مصنوعی (پروکسی امن به OpenAI)
app.use("/api/public/ai", aiRouter);

// تمام مسیرهای عمومی (از جمله /api/public/tickets/*)
app.use("/api/public", publicRouter);

// پنل ادمین
app.use("/api/admin", adminRouter);
app.get("/api/admin/me", adminAuth, (req, res) =>
  res.json({ ok: true, admin: req.admin })
);

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: "not_found" }));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal_error" });
});

// ---------- Start ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Phoenix backend running on http://0.0.0.0:${PORT}`);
  console.log(`📦 Uploads: ${ROOT_UPLOAD_DIR}`);
});