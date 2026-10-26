import type { ProductOption } from "@/lib/products";

export type AppStatus = "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";

export function AppStatusBadge({ status, kind }: { status: AppStatus; kind?: string }) {
  const map: Record<AppStatus, [string, string]> = {
    PENDING: ["badge-amber", "In review"],
    APPROVED: ["badge-green", kind === "MORTGAGE" ? "Pre-approved" : kind === "GENERAL" ? "Contacted" : "Approved"],
    DECLINED: ["badge-red", "Declined"],
    CANCELLED: ["badge-grey", "Cancelled"],
  };
  const [cls, label] = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

/** The featured option: one marked "Featured"/"Most popular", otherwise the first. */
export function featuredOption(options: ProductOption[]) {
  return options.find((o) => /featured|popular/i.test(o.note ?? "")) ?? options[0] ?? null;
}

export const pct = (n: number) => `${n.toFixed(2).replace(/0$/, "")}%`;
