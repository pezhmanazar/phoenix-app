import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = crypto.randomBytes(16).toString("hex");
    cb(null, `${name}${ext}`);
  },
});

const ALLOWED = [
  // صوت
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/ogg", "audio/aac", "audio/m4a",
  // تصویر
  "image/png", "image/jpeg", "image/webp", "image/gif",
  // فایل‌های عمومی
  "application/pdf", "text/plain",
];
export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error("unsupported_mime"));
  },
});