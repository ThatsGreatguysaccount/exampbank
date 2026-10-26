import Link from "next/link";
import type { KycStatus, Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fullDate, money } from "@/lib/format";
import { KycBadge, fullName } from "../shared";

const STATUSES: KycStatus[] = ["PENDING_DOCUMENTS", "PENDING_REVIEW", "APPROVED", "REJECTED"];

export default async function CustomersPage(props: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as KycStatus) ? (sp.status as KycStatus) : null;

  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(status ? { kycStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { memberNumber: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [settings, users] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { accounts: { select: { balance: true, status: true } } },
    }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-users" /> Customers
          </h1>
          <p>{users.length} shown. Click a customer to manage documents, accounts and transactions.</p>
        </div>
      </div>

      <div className="panel">
        <form className="toolbar" method="get">
          <input name="q" defaultValue={q} placeholder="Search name, email, member #, phone" />
          <select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            <option value="PENDING_DOCUMENTS">Awaiting documents</option>
            <option value="PENDING_REVIEW">Needs review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="btn-secondary" type="submit">
            <i className="fas fa-magnifying-glass" /> Filter
          </button>
          {q || status ? (
            <Link href="/admin/customers" className="link-btn">
              Clear
            </Link>
          ) : null}
        </form>

        {users.length === 0 ? (
          <div className="empty">No customers match.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Member #</th>
                  <th>Status</th>
                  <th>Accounts</th>
                  <th style={{ textAlign: "right" }}>Total balance</th>
                  <th>Registered</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const total = u.accounts.filter((a) => a.status !== "CLOSED").reduce((s, a) => s + Number(a.balance), 0);
                  return (
                    <tr key={u.id} className="clickable">
                      <td>
                        <strong>{fullName(u)}</strong>
                        {u.suspended ? (
                          <>
                            {" "}
                            <span className="badge badge-red">Suspended</span>
                          </>
                        ) : null}
                        <div className="muted">{u.email}</div>
                      </td>
                      <td>{u.memberNumber ?? <span className="muted">—</span>}</td>
                      <td>
                        <KycBadge status={u.kycStatus} />
                      </td>
                      <td>{u.accounts.length}</td>
                      <td className="num">{money(total, settings)}</td>
                      <td className="muted">{fullDate(u.createdAt.toISOString(), settings)}</td>
                      <td className="num">
                        <Link href={`/admin/customers/${u.id}`} className="link-btn">
                          Manage <i className="fas fa-arrow-right" />
                        </Link>
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
