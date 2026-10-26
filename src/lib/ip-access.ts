import { BlockList, isIP } from "node:net";
import { prisma } from "./prisma-client";
import { DEFAULT_SETTINGS } from "./settings-defaults";

export const IP_ACCESS_KEYS = { enabled: "ipAllowlistEnabled", list: "ipAllowlist" } as const;
export const MAX_IP_ENTRIES = 200;

export type IpEntry = { value: string; label: string; addedAt: string; addedBy: string };
export type IpAccess = { enabled: boolean; entries: IpEntry[]; bankName: string; matcher: BlockList };

/** Strips ports, zone ids and the IPv4-mapped IPv6 prefix; returns null if not an IP. */
export function normalizeIp(raw: string): string | null {
  let ip = raw.trim();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(ip);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  ip = ip.replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];
  return isIP(ip) ? ip.toLowerCase() : null;
}

/** Accepts a single address or a CIDR range such as 203.0.113.0/24 or 2001:db8::/48. */
export function parseEntry(raw: string): { value: string } | { error: string } {
  const parts = raw.trim().split("/");
  if (parts.length > 2) return { error: `"${raw}" is not a valid IP address or range.` };
  const ip = normalizeIp(parts[0]);
  if (!ip) return { error: `"${raw}" is not a valid IPv4 or IPv6 address.` };
  if (parts.length === 1) return { value: ip };
  const max = isIP(ip) === 4 ? 32 : 128;
  const bits = Number(parts[1]);
  if (!/^\d{1,3}$/.test(parts[1]) || bits > max) return { error: `The range size must be between /1 and /${max}.` };
  if (bits === 0) return { error: "A /0 range would allow every address on the internet." };
  return { value: bits === max ? ip : `${ip}/${bits}` };
}

export function parseEntries(raw: string | null | undefined): IpEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((e) => {
      if (!e || typeof e !== "object") return [];
      const r = e as Record<string, unknown>;
      const parsed = typeof r.value === "string" ? parseEntry(r.value) : null;
      if (!parsed || "error" in parsed) return [];
      return [{
        value: parsed.value,
        label: typeof r.label === "string" ? r.label : "",
        addedAt: typeof r.addedAt === "string" ? r.addedAt : "",
        addedBy: typeof r.addedBy === "string" ? r.addedBy : "",
      }];
    });
  } catch {
    return [];
  }
}

export function buildMatcher(entries: IpEntry[]) {
  const list = new BlockList();
  for (const e of entries) {
    const [addr, prefix] = e.value.split("/");
    const type = isIP(addr) === 6 ? "ipv6" : "ipv4";
    if (prefix) list.addSubnet(addr, Number(prefix), type);
    else list.addAddress(addr, type);
  }
  return list;
}

export function isAllowed(ip: string | null, matcher: BlockList) {
  if (!ip) return false;
  return matcher.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/**
 * Next.js only fills X-Forwarded-For from the socket when the header is absent, so in
 * production a reverse proxy must set or append it. TRUSTED_PROXY_HOPS is the number of
 * proxies in front of the app; the client is that many entries from the right.
 */
export function clientIp(h: Headers): string | null {
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS)) || 1);
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length) return normalizeIp(parts[Math.max(0, parts.length - hops)]);
  return normalizeIp(h.get("x-real-ip") ?? "");
}

export async function readIpAccess(): Promise<IpAccess> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [IP_ACCESS_KEYS.enabled, IP_ACCESS_KEYS.list, "bankName"] } },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const entries = parseEntries(get(IP_ACCESS_KEYS.list));
  return {
    enabled: get(IP_ACCESS_KEYS.enabled) === "true",
    entries,
    bankName: get("bankName") || DEFAULT_SETTINGS.bankName,
    matcher: buildMatcher(entries),
  };
}

const CACHE_MS = 5_000;
const store = globalThis as unknown as { __ipAccess?: { at: number; value: IpAccess } };

/** Cached for the proxy; falls back to the last good value if the database is briefly unavailable. */
export async function loadIpAccess(): Promise<IpAccess> {
  const cached = store.__ipAccess;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const value = await readIpAccess();
    store.__ipAccess = { at: Date.now(), value };
    return value;
  } catch (err) {
    if (cached) return cached.value;
    throw err;
  }
}

export function invalidateIpAccess() {
  store.__ipAccess = undefined;
}
