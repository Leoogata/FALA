import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';

const ALLOWED_MIMES = new Set(['application/pdf', 'text/plain']);
const ALLOWED_EXTS = new Set(['.pdf', '.txt']);

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_req, file, cb) => {
    // <timestamp>-<nome-original> — evita colisões sem uuid extra
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}-${safe}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext)) {
    cb(null, true);
  } else {
    const err = new Error(
      `Tipo de arquivo não permitido. Envie apenas PDF ou TXT (recebido: ${file.mimetype}).`,
    );
    err.status = 400;
    cb(err, false);
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});
