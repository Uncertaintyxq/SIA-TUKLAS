/**
 * File uploads — checks, saves, deletes and serves the files people upload.
 * Used for work PDFs, images and research group files.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';

/** Uploaded files live on disk in server/uploads (gitignored); the database stores only their names. */
export const UPLOAD_DIR = fileURLToPath(new URL('../../uploads/', import.meta.url));
mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Upload rules ----------

const MB = 1024 * 1024;

const startsWith = (buf: Buffer, ...bytes: number[]) => bytes.every((b, i) => buf[i] === b);

/** What each upload slot accepts. The file's first bytes are checked, not just the type the browser claims. */
const kinds = {
  pdf: {
    max: 20 * MB,
    label: 'a PDF',
    sniff: (buf: Buffer) => (buf.subarray(0, 5).toString('latin1') === '%PDF-' ? { type: 'application/pdf', ext: 'pdf' } : null),
  },
  image: {
    max: 5 * MB,
    label: 'a PNG, JPEG or WebP image',
    sniff: (buf: Buffer) => {
      if (startsWith(buf, 0x89, 0x50, 0x4e, 0x47)) return { type: 'image/png', ext: 'png' };
      if (startsWith(buf, 0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg' };
      if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
        return { type: 'image/webp', ext: 'webp' };
      return null;
    },
  },
  any: {
    max: 15 * MB,
    label: 'a file',
    sniff: () => ({ type: 'application/octet-stream', ext: 'bin' }),
  },
} as const;
export type UploadKind = keyof typeof kinds;

// ---------- Reading and saving ----------

/** Parses the request body as raw bytes. The client sends the file itself as the body, with its name in X-File-Name. */
export const rawBody = express.raw({ type: () => true, limit: 20 * MB });

export class UploadError extends Error {
  readonly status = 400;
}

export interface Upload {
  buffer: Buffer;
  type: string;
  ext: string;
  /** Original file name, for downloads */
  name: string;
}

/** Checks the request body against the slot's rules and returns it as an Upload; throws UploadError if it fails. */
export function readUpload(req: Request, kind: UploadKind): Upload {
  const spec = kinds[kind];
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (buffer.length === 0) throw new UploadError(`Choose ${spec.label} to upload.`);
  if (buffer.length > spec.max) throw new UploadError(`That file is too large. The limit is ${spec.max / MB} MB.`);
  const found = spec.sniff(buffer);
  if (!found) throw new UploadError(`That file isn’t ${spec.label}.`);
  let name = 'file';
  try {
    name = decodeURIComponent(String(req.get('x-file-name') ?? 'file'));
  } catch {
    /* keep the fallback name */
  }
  name = name.replace(/[\\/\r\n"]/g, '').trim().slice(0, 160) || 'file';
  return { buffer, type: found.type, ext: kind === 'any' ? extOf(name) : found.ext, name };
}

const extOf = (name: string) => /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? 'bin';

/** Writes the upload under a random name and returns that name. */
export async function saveUpload(upload: Upload): Promise<string> {
  const file = `${randomUUID()}.${upload.ext}`;
  await writeFile(`${UPLOAD_DIR}${file}`, upload.buffer);
  return file;
}

const SAFE_NAME = /^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

export async function deleteUpload(file: string | null | undefined) {
  if (!file || !SAFE_NAME.test(file)) return;
  await unlink(`${UPLOAD_DIR}${file}`).catch(() => undefined);
}

/** Empties the upload folder (demo reset). */
export function clearUploads() {
  for (const f of readdirSync(UPLOAD_DIR)) if (SAFE_NAME.test(f)) rmSync(`${UPLOAD_DIR}${f}`, { force: true });
}

// ---------- Serving ----------

// Types a group file may be served as; anything else downloads as octet-stream.
const SERVABLE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Content type to store for a group file: what the browser sent, if it's one we serve. */
export const storedType = (claimed: string | undefined) => {
  const t = (claimed ?? '').split(';')[0]!.trim().toLowerCase();
  return SERVABLE.has(t) ? t : 'application/octet-stream';
};

/**
 * Streams an uploaded file. PDFs open inline (so the viewer can embed them); everything else
 * that isn't an image downloads, so an uploaded file can never run as a page on our origin.
 */
export function sendUpload(res: Response, file: string, opts: { type: string; name?: string; download?: boolean }) {
  if (!SAFE_NAME.test(file)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const inline = !opts.download && (opts.type === 'application/pdf' || opts.type.startsWith('image/'));
  const name = opts.name ?? file;
  res.setHeader('Content-Type', opts.type);
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
  res.setHeader('Cache-Control', 'private, max-age=300');
  // The browser's PDF viewer needs to run inside the response; the type is fixed and sniffing is off.
  if (opts.type === 'application/pdf') res.removeHeader('Content-Security-Policy');
  res.sendFile(`${UPLOAD_DIR}${file}`, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'That file is no longer available.' });
  });
}
