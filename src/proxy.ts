import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, isAllowed, loadIpAccess } from "@/lib/ip-access";
import { restrictedPage, unavailablePage } from "@/lib/restricted-page";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const HTML_HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

export async function proxy(request: NextRequest) {
  if (process.env.IP_ALLOWLIST_BYPASS === "true") return NextResponse.next();

  let access;
  try {
    access = await loadIpAccess();
  } catch (err) {
    console.error("[ip-allowlist] Could not load access rules:", err);
    return new NextResponse(unavailablePage(DEFAULT_SETTINGS.bankName), { status: 503, headers: HTML_HEADERS });
  }
  if (!access.enabled) return NextResponse.next();

  const ip = clientIp(request.headers);
  if (isAllowed(ip, access.matcher)) return NextResponse.next();

  const reference = `ACC-${randomBytes(4).toString("hex").toUpperCase()}`;
  const time = new Date();
  console.warn(
    `[ip-allowlist] Blocked ${ip ?? "unknown IP"} ${request.method} ${request.nextUrl.pathname} ref=${reference} at ${time.toISOString()}`,
  );
  return new NextResponse(restrictedPage({ bankName: access.bankName, ip, reference, time }), {
    status: 403,
    headers: HTML_HEADERS,
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
