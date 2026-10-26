import "server-only";
import { randomBytes } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Kind = "pdf" | "image";

const SIGNATURES: { mime: string; ext: string; kind: Kind; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", ext: "pdf", kind: "pdf", test: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { mime: "image/jpeg", ext: "jpg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    kind: "image",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: "image/webp",
    ext: "webp",
    kind: "image",
    test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

export type SavedFile = { storedName: string; fileName: string; mimeType: string; size: number };

export function isFilePresent(v: FormDataEntryValue | null): v is File {
  return typeof v === "object" && v !== null && "arrayBuffer" in v && v.size > 0;
}

/** Validates by file content (magic bytes), not by the client-provided type, then writes to private storage. */
export async function saveUpload(file: File, allowed: Kind[]): Promise<SavedFile | string> {
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 10 MB.";
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig || !allowed.includes(sig.kind)) {
    return allowed.includes("image") ? "Upload a PDF, JPG, PNG or WEBP file." : "Upload a PDF file.";
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const storedName = `${randomBytes(16).toString("hex")}.${sig.ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), buf);
  return {
    storedName,
    fileName: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || `upload.${sig.ext}`,
    mimeType: sig.mime,
    size: file.size,
  };
}

export async function readUpload(storedName: string) {
  return readFile(path.join(UPLOAD_DIR, path.basename(storedName)));
}

export async function deleteUpload(storedName: string) {
  await unlink(path.join(UPLOAD_DIR, path.basename(storedName))).catch(() => {});
}
