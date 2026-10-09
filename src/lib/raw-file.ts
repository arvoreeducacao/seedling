import path from "node:path";
import { mimeOf } from "@/lib/preview/mime";
import { OutsideError, readInside } from "@/lib/safe-path";

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp", "image/x-icon", "image/svg+xml", "application/pdf"]);
const MAX_RAW = 25 * 1024 * 1024;

export async function rawFile(root: string, relative: string, download: boolean) {
  let read: Awaited<ReturnType<typeof readInside>>;
  try {
    read = await readInside(root, relative, MAX_RAW);
  } catch (error) {
    if (error instanceof OutsideError) return Response.json({ error: "invalid path" }, { status: 400 });
    return Response.json({ error: "file not found" }, { status: 404 });
  }
  const { target, buffer } = read;
  if (!buffer) return Response.json({ error: "file too large" }, { status: 413 });
  const type = mimeOf(target);
  const inline = !download && INLINE.has(type);
  const name = path.basename(target).replace(/[^\w.-]/g, "_");
  const headers: Record<string, string> = {
    "content-type": inline ? type : "application/octet-stream",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
    "content-security-policy": type === "application/pdf" ? "default-src 'none'; object-src 'self'" : "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    "x-content-type-options": "nosniff",
    "cache-control": "private, no-store",
  };
  return new Response(new Uint8Array(buffer), { headers });
}
