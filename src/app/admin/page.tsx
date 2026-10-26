import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { friendlyDate, money } from "@/lib/format";
import { KIND_LABELS, TxRowActions, fullName } from "./shared";

export default async function AdminOverview() {
  await requireAdmin();
  const settings = await getSettings();
  const [customers, approved, pendingReviews, pendingTx, deposits, reviewQueue, txQueue] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", kycStatus: "APPROVED" } }),
    prisma.user.count({ where: { role: "CUSTOMER", kycStatus: "PENDING_REVIEW" } }),
    prisma.transaction.count({ where: { status: "PENDING" } }),
    prisma.account.aggregate({ _sum: { balance: true }, where: { status: { not: "CLOSED" } } }),
    prisma.user.findMany({
      where: { role: "CUSTOMER", kycStatus: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
      take: 6,
    }),
    prisma.transaction.findMany({
      where: { status: "PENDING" },
      orderBy: { postedAt: "asc" },
      take: 8,
      include: { account: { include: { user: true } } },
    }),
  ]);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-gauge-high" /> Overview
          </h1>
          <p>What needs your attention today.</p>
        </div>
      </div>

      <div className="stat-grid">
        <Link href="/admin/customers" className="stat">
          <div className="label">
            <i className="fas fa-users" /> Customers
          </div>
          <div className="value">{customers}</div>
        </Link>
        <Link href="/admin/customers?status=APPROVED" className="stat">
          <div className="label">
            <i className="fas fa-user-check" /> Active members
          </div>
          <div className="value">{approved}</div>
        </Link>
        <Link href="/admin/reviews" className="stat">
          <div className="label">
            <i className="fas fa-id-card" /> Awaiting KYC review
          </div>
          <div className={`value${pendingReviews ? " warn" : ""}`}>{pendingReviews}</div>
        </Link>
        <Link href="/admin/transactions?status=PENDING" className="stat">
          <div className="label">
            <i className="fas fa-hourglass-half" /> Pending transactions
          </div>
          <div className={`value${pendingTx ? " warn" : ""}`}>{pendingTx}</div>
        </Link>
        <div className="stat">
          <div className="label">
            <i className="fas fa-vault" /> Total deposits
          </div>
          <div className="value">{money(Number(deposits._sum.balance ?? 0), settings)}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-id-card" /> KYC review queue
            </span>
            <Link href="/admin/reviews" className="link-btn">
              View all
            </Link>
          </div>
          {reviewQueue.length === 0 ? (
            <div className="empty">No applications waiting. 🎉</div>
          ) : (
            <table className="data">
              <tbody>
                {reviewQueue.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <div className="muted">{u.email}</div>
                    </td>
                    <td className="muted">{friendlyDate(u.updatedAt.toISOString(), settings)}</td>
                    <td className="num">
                      <Link href={`/admin/customers/${u.id}`} className="link-btn">
                        Review <i className="fas fa-arrow-right" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-hourglass-half" /> Pending transactions
            </span>
            <Link href="/admin/transactions?status=PENDING" className="link-btn">
              View all
            </Link>
          </div>
          {txQueue.length === 0 ? (
            <div className="empty">Nothing pending.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <tbody>
                  {txQueue.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        <div className="muted">
                          <Link href={`/admin/customers/${t.account.userId}`}>{fullName(t.account.user)}</Link> ·{" "}
                          {KIND_LABELS[t.kind]} · {friendlyDate(t.postedAt.toISOString(), settings)}
                        </div>
                      </td>
                      <td className={`num ${Number(t.amount) > 0 ? "credit" : "debit"}`}>
                        {money(Number(t.amount), settings)}
                      </td>
                      <td>
                        <TxRowActions id={t.id} status={t.status} meta={t.meta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
