// scripts/cleanup-uploads.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- flags ----
const isDry = process.argv.includes('--dry');

// ---- resolve UPLOAD_DIR safely on Windows ----
function resolveUploadDir() {
  // 1) env or default
  let raw = process.env.UPLOAD_DIR || 'uploads';

  // 2) decode %20, etc (in case someone pasted URL-encoded path)
  try {
    if (raw.includes('%')) raw = decodeURIComponent(raw);
  } catch (_) {}

  // 3) absolute vs relative
  let resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);

  // 4) normalize (avoid "C:\C:\..." like paths)
  resolved = path.normalize(resolved);

  return resolved;
}

async function main() {
  const uploadDir = resolveUploadDir();

  console.log('[cleanup] UPLOAD_DIR:', uploadDir);

  if (!fs.existsSync(uploadDir)) {
    console.log('[cleanup] uploads folder not found:', uploadDir);
    process.exit(0);
  }

  // read all files in uploads (non-recursive)
  const files = fs.readdirSync(uploadDir).filter(f => {
    try {
      const fp = path.join(uploadDir, f);
      return fs.statSync(fp).isFile();
    } catch {
      return false;
    }
  });

  console.log(`[cleanup] found ${files.length} files in uploads`);

  // collect referenced file basenames from DB (messages.fileUrl)
  // we consider anything that starts with "/uploads/" (as server stores)
  const msgs = await prisma.message.findMany({
    where: {
      fileUrl: { not: null },
    },
    select: { fileUrl: true },
  });

  const referenced = new Set(
    msgs
      .map(m => (m.fileUrl || '').toString())
      .filter(u => u)
      .map(u => {
        // Normalize leading slash and extract basename
        // e.g. "/uploads/1712345_abc.m4a" -> "1712345_abc.m4a"
        const bn = path.basename(u);
        return bn;
      })
  );

  console.log(`[cleanup] referenced in DB: ${referenced.size} files`);

  // diff: files not referenced
  const unreferenced = files.filter(f => !referenced.has(f));

  if (!unreferenced.length) {
    console.log('[cleanup] nothing to delete. All files are referenced.');
    process.exit(0);
  }

  console.log(
    `[cleanup] ${isDry ? 'would delete (dry-run)' : 'deleting'} ${unreferenced.length} unreferenced file(s):`
  );
  for (const f of unreferenced) {
    const full = path.join(uploadDir, f);
    console.log('  -', full);
    if (!isDry) {
      try {
        fs.unlinkSync(full);
      } catch (e) {
        console.warn('   failed to delete:', e?.message || e);
      }
    }
  }

  await prisma.$disconnect();
}

main()
  .catch(err => {
    console.error('[cleanup] error:', err);
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch {}
  });