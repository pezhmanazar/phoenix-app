// utils/uploader.js
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

// مطمئن شو پوشه وجود داره (سرور هم در server.js همین کارو کرده؛ اینجا هم safe هست)
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext).replace(/\s+/g, "-").slice(0, 50);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

export default upload;