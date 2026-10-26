import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({ where: { id: Number(id) || 0 } });
  if (!doc || (user.role !== "ADMIN" && doc.userId !== user.id)) return new Response("Not found", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(doc.storedName);
  } catch {
    return new Response("File missing", { status: 404 });
  }

  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
