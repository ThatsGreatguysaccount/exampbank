import Link from "next/link";
import type { ApplicationStatus, Prisma, ProductKind } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { friendlyDate, money } from "@/lib/format";
import { PRODUCT_KIND_LABELS } from "@/lib/products";
import { AppStatusBadge } from "@/app/dashboard/products/shared";
import { fullName } from "../shared";

const STATUSES: ApplicationStatus[] = ["PENDING", "APPROVED", "DECLINED", "CANCELLED"];

export default async function ApplicationsPage(props: PageProps<"/admin/applications">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status =
    typeof sp.status === "string" && STATUSES.includes(sp.status as ApplicationStatus)
      ? (sp.status as ApplicationStatus)
      : sp.status === "all"
        ? null
        : "PENDING";
  const kind = typeof sp.kind === "string" && sp.kind in PRODUCT_KIND_LABELS ? (sp.kind as ProductKind) : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.ProductApplicationWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q } },
            { user: { email: { contains: q } } },
            { user: { lastName: { contains: q } } },
            { user: { firstName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [settings, apps, counts] = await Promise.all([
    getSettings(),
    prisma.productApplication.findMany({
      where,
      include: { user: true, product: { select: { title: true, icon: true } } },
      orderBy: status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" },
      take: 200,
    }),
    prisma.productApplication.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: ApplicationStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  const tab = (label: string, value: ApplicationStatus | "all") => {
    const active = value === "all" ? status === null : status === value;
    const params = new URLSearchParams({ status: value, ...(kind ? { kind } : {}), ...(q ? { q } : {}) });
    return (
      <Link href={`/admin/applications?${params}`} className={`filter-btn ${active ? "active" : ""}`}>
        {label}
        {value !== "all" && count(value) ? ` (${count(value)})` : ""}
      </Link>
    );
  };

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-file-signature" /> Product applications
          </h1>
          <p>Review TFSA, RRSP GIC, RRIF and mortgage pre-approval applications. Approving an investment opens the account.</p>
        </div>
      </div>
      <div className="panel">
        <div className="filter-bar">
          {tab("In review", "PENDING")}
          {tab("Approved", "APPROVED")}
          {tab("Declined", "DECLINED")}
          {tab("Cancelled", "CANCELLED")}
          {tab("All", "all")}
        </div>
        <form className="toolbar" method="get">
          <input type="hidden" name="status" value={status ?? "all"} />
          <input name="q" defaultValue={q} placeholder="Search reference or customer" />
          <select name="kind" defaultValue={kind ?? ""}>
            <option value="">All products</option>
            {Object.entries(PRODUCT_KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn-secondary" type="submit">
            <i className="fas fa-magnifying-glass" /> Filter
          </button>
        </form>

        {apps.length === 0 ? (
          <div className="empty">No applications match.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Flags</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const d = (a.details ?? {}) as Record<string, unknown>;
                  const flags = Array.isArray(d.warnings) ? d.warnings.length : 0;
                  return (
                    <tr key={a.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {friendlyDate(a.createdAt.toISOString(), settings)}
                      </td>
                      <td>
                        <Link href={`/admin/customers/${a.userId}`}>
                          <strong>{fullName(a.user)}</strong>
                        </Link>
                        <div className="muted">{a.user.email}</div>
                      </td>
                      <td>
                        <strong>
                          <i className={`fas ${a.product.icon}`} style={{ color: "#007287" }} /> {a.product.title}
                        </strong>
                        <div className="muted">
                          {a.reference} · {a.optionLabel ?? "—"}
                          {a.rate !== null ? ` · ${Number(a.rate)}%` : ""}
                        </div>
                      </td>
                      <td>
                        {flags ? (
                          <span className="badge badge-amber">
                            <i className="fas fa-flag" /> {flags}
                          </span>
                        ) : a.kind === "MORTGAGE" ? (
                          d.meetsStressTest ? (
                            <span className="badge badge-green">Stress test OK</span>
                          ) : (
                            <span className="badge badge-red">Stress test fail</span>
                          )
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <AppStatusBadge status={a.status} kind={a.kind} />
                      </td>
                      <td className="num">{a.amount !== null ? money(Number(a.approvedAmount ?? a.amount), settings) : "—"}</td>
                      <td>
                        <div className="row-actions">
                          <Link href={`/admin/applications/${a.id}`} className="link-btn">
                            <i className={`fas ${a.status === "PENDING" ? "fa-gavel" : "fa-eye"}`} />{" "}
                            {a.status === "PENDING" ? "Review" : "View"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
