export type FormatConfig = { currency: string; locale: string; timezone: string };

export function money(value: number, cfg: FormatConfig) {
  try {
    return new Intl.NumberFormat(cfg.locale, { style: "currency", currency: cfg.currency }).format(value);
  } catch {
    return `${cfg.currency} ${value.toFixed(2)}`;
  }
}

function dayKey(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "Today, 11:24 AM" / "Yesterday, 8:02 AM" / "Feb 18, 3:15 PM" in the bank's timezone. */
export function friendlyDate(iso: string, cfg: FormatConfig) {
  const d = new Date(iso);
  const tz = safeTz(cfg.timezone);
  const time = new Intl.DateTimeFormat(cfg.locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  const now = new Date();
  const today = dayKey(now, tz);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), tz);
  const key = dayKey(d, tz);
  if (key === today) return `Today, ${time}`;
  if (key === yesterday) return `Yesterday, ${time}`;
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  const date = new Intl.DateTimeFormat(cfg.locale, {
    timeZone: tz,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
  return `${date}, ${time}`;
}

export function fullDate(iso: string, cfg: FormatConfig) {
  return new Intl.DateTimeFormat(cfg.locale, {
    timeZone: safeTz(cfg.timezone),
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function zonedParts(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Value for an <input type="datetime-local"> showing `d` in the bank's timezone. */
export function toZonedInput(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** Parses a datetime-local value as wall-clock time in the bank's timezone. */
export function fromZonedInput(local: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return null;
  const asUtc = new Date(`${local.slice(0, 16)}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  const p = zonedParts(asUtc, tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - asUtc.getTime();
  return new Date(asUtc.getTime() - offset);
}

function safeTz(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
