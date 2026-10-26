import Link from "next/link";
import type { Prisma, TxKind, TxStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { friendlyDate, money, toZonedInput } from "@/lib/format";
import { formatPhone } from "@/lib/payees";
import { KIND_LABELS, TxRowActions, TxStatusBadge, fullName } from "../shared";
import { TransactionForm } from "../TransactionForm";

const STATUSES: TxStatus[] = ["PENDING", "COMPLETED", "REJECTED"];

export default async function TransactionsPage(props: PageProps<"/admin/transactions">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as TxStatus) ? (sp.status as TxStatus) : null;
  const kind = typeof sp.kind === "string" && sp.kind in KIND_LABELS ? (sp.kind as TxKind) : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.TransactionWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { reference: { contains: q } },
            { account: { user: { email: { contains: q } } } },
            { account: { user: { lastName: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [settings, txs, accounts] = await Promise.all([
    getSettings(),
    prisma.transaction.findMany({
      where,
      orderBy: status === "PENDING" ? [{ postedAt: "asc" }] : [{ postedAt: "desc" }, { id: "desc" }],
      take: 300,
      include: { account: { include: { user: true } } },
    }),
    prisma.account.findMany({
      where: { status: { not: "CLOSED" }, user: { role: "CUSTOMER" } },
      orderBy: [{ user: { lastName: "asc" } }, { userId: "asc" }, { id: "asc" }],
      include: { user: true },
    }),
  ]);
  const nowInput = toZonedInput(new Date(), settings.timezone);

  const tab = (label: string, value: TxStatus | null) => (
    <Link
      href={value ? `/admin/transactions?status=${value}` : "/admin/transactions"}
      className={`filter-btn ${status === value ? "active" : ""}`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>
            <i className="fas fa-arrow-right-arrow-left" /> Transactions
          </h1>
          <p>Add, edit or delete transactions, and approve customer bill payments, e-Transfers and cheque deposits.</p>
        </div>
      </div>
      <details className="panel add-panel">
        <summary className="panel-title">
          <span>
            <i className="fas fa-circle-plus" /> Add transaction
          </span>
          <i className="fas fa-chevron-down" />
        </summary>
        {accounts.length === 0 ? (
          <div className="empty">No open customer accounts yet.</div>
        ) : (
          <div style={{ maxWidth: 560 }}>
            <TransactionForm
              accounts={accounts.map((a) => ({
                id: a.id,
                group: `${fullName(a.user)} · ${a.user.email}`,
                label: `${a.name} · ${a.number} (${money(Number(a.balance), settings)})`,
              }))}
              currency={settings.currency}
              timezone={settings.timezone}
              nowInput={nowInput}
            />
          </div>
        )}
      </details>
      <div className="panel">
        <div className="filter-bar">
          {tab("All", null)}
          {tab("Pending", "PENDING")}
          {tab("Completed", "COMPLETED")}
          {tab("Rejected", "REJECTED")}
        </div>
        <form className="toolbar" method="get">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input name="q" defaultValue={q} placeholder="Search description, reference, customer" />
          <select name="kind" defaultValue={kind ?? ""}>
            <option value="">All types</option>
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn-secondary" type="submit">
            <i className="fas fa-magnifying-glass" /> Filter
          </button>
        </form>

        {txs.length === 0 ? (
          <div className="empty">No transactions match.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const meta = (t.meta ?? {}) as Record<string, string>;
                  return (
                    <tr key={t.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {friendlyDate(t.postedAt.toISOString(), settings)}
                      </td>
                      <td>
                        <Link href={`/admin/customers/${t.account.userId}`}>
                          <strong>{fullName(t.account.user)}</strong>
                        </Link>
                        <div className="muted">
                          {t.account.name} · {t.account.number}
                        </div>
                      </td>
                      <td>
                        <strong>
                          <i className={`fas ${t.icon}`} style={{ color: "#007287" }} /> {t.title}
                        </strong>
                        <div className="muted">
                          {KIND_LABELS[t.kind]} · {t.reference}
                          {meta.payeeAccount ? ` · Payee acct ${meta.payeeAccount}` : ""}
                          {meta.chequeNumber ? ` · Cheque #${meta.chequeNumber}` : ""}
                          {meta.email ? ` · ${meta.email}` : ""}
                          {meta.phone ? ` · Mobile ${formatPhone(String(meta.phone))}` : ""}
                          {meta.swiftBic ? ` · SWIFT ${meta.swiftBic}` : ""}
                          {meta.iban ? ` · IBAN ${meta.iban}` : meta.accountNumber ? ` · Acct ${meta.accountNumber}` : ""}
                        </div>
                      </td>
                      <td>
                        <TxStatusBadge status={t.status} />
                      </td>
                      <td className={`num ${Number(t.amount) > 0 ? "credit" : "debit"}`}>
                        {Number(t.amount) > 0 ? "+" : ""}
                        {money(Number(t.amount), settings)}
                      </td>
                      <td>
                        <TxRowActions id={t.id} status={t.status} meta={t.meta} />
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
