import Link from "next/link";
import { notFound } from "next/navigation";
import type { Account, Payee, Transaction } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { ACCOUNT_TYPES } from "@/lib/banking";
import { friendlyDate, fullDate, money, toZonedInput } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import {
  createAccountAction,
  deleteCustomerAction,
  reviewKycAction,
  updateAccountAction,
  updateCustomerAction,
} from "@/app/actions/admin";
import { KIND_LABELS, KycBadge, TxRowActions, TxStatusBadge, fullName } from "../../shared";
import { TransactionForm } from "../../TransactionForm";
import {
  PAYEE_TYPE_ICONS,
  PAYEE_TYPE_LABELS,
  countryName,
  formatIban,
  formatPhone,
  looksLikeIban,
} from "@/lib/payees";

const DOC_LABEL = { ID_FRONT: "Photo ID — front", ID_BACK: "Photo ID — back", BANK_STATEMENT: "Bank statement" };
const ID_TYPE_LABEL: Record<string, string> = {
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver's licence",
  NATIONAL_ID: "National ID",
};

const TABS = {
  overview: ["Overview", "fa-gauge-high"],
  transactions: ["Transactions", "fa-clock-rotate-left"],
  accounts: ["Accounts", "fa-wallet"],
  payees: ["Payees", "fa-address-book"],
  documents: ["Documents", "fa-id-card"],
  profile: ["Profile", "fa-user-pen"],
} as const;
type Tab = keyof typeof TABS;

export default async function CustomerDetail(props: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const user = await prisma.user.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      documents: { orderBy: { kind: "asc" } },
      accounts: { orderBy: { createdAt: "asc" } },
      payees: { orderBy: [{ type: "asc" }, { name: "asc" }] },
    },
  });
  if (!user || user.role !== "CUSTOMER") notFound();

  const tab: Tab =
    typeof sp.tab === "string" && sp.tab in TABS
      ? (sp.tab as Tab)
      : user.kycStatus === "PENDING_REVIEW"
        ? "documents"
        : "overview";

  const settings = await getSettings();
  const accountIds = user.accounts.map((a) => a.id);
  const accountFilter = typeof sp.account === "string" && accountIds.includes(Number(sp.account)) ? Number(sp.account) : null;
  const [transactions, pendingCount] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId: tab === "transactions" && accountFilter ? accountFilter : { in: accountIds } },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      take: tab === "transactions" ? 150 : 8,
    }),
    prisma.transaction.count({ where: { accountId: { in: accountIds }, status: "PENDING" } }),
  ]);
  const accountName = new Map(user.accounts.map((a) => [a.id, a.name]));
  const openAccounts = user.accounts.filter((a) => a.status !== "CLOSED");
  const totalBalance = openAccounts.reduce((s, a) => s + Number(a.balance), 0);
  const base = `/admin/customers/${user.id}`;

  const counts: Partial<Record<Tab, number>> = {
    transactions: pendingCount,
    documents: user.kycStatus === "PENDING_REVIEW" ? 1 : 0,
  };

  return (
    <>
      <div className="admin-header">
        <div>
          <Link href="/admin/customers" className="back">
            <i className="fas fa-arrow-left" /> Customers
          </Link>
          <h1>
            <i className="fas fa-user" /> {fullName(user)} <KycBadge status={user.kycStatus} />
            {user.suspended ? <span className="badge badge-red">Suspended</span> : null}
          </h1>
          <p>
            {user.email} · Member #{user.memberNumber ?? "not assigned"} · Registered{" "}
            {fullDate(user.createdAt.toISOString(), settings)}
          </p>
        </div>
      </div>

      <nav className="tab-nav">
        {(Object.entries(TABS) as [Tab, (typeof TABS)[Tab]][]).map(([key, [label, icon]]) => (
          <Link key={key} href={`${base}?tab=${key}`} className={tab === key ? "active" : ""}>
            <i className={`fas ${icon}`} /> {label}
            {counts[key] ? <span className="count">{counts[key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">
                <i className="fas fa-vault" /> Total balance
              </div>
              <div className="value">{money(totalBalance, settings)}</div>
            </div>
            <Link href={`${base}?tab=accounts`} className="stat">
              <div className="label">
                <i className="fas fa-wallet" /> Open accounts
              </div>
              <div className="value">{openAccounts.length}</div>
            </Link>
            <Link href={`${base}?tab=transactions`} className="stat">
              <div className="label">
                <i className="fas fa-hourglass-half" /> Pending transactions
              </div>
              <div className={`value${pendingCount ? " warn" : ""}`}>{pendingCount}</div>
            </Link>
            <Link href={`${base}?tab=payees`} className="stat">
              <div className="label">
                <i className="fas fa-address-book" /> Saved payees
              </div>
              <div className="value">{user.payees.length}</div>
            </Link>
          </div>
          <div className="two-col">
            <div className="panel">
              <div className="panel-title">
                <span>
                  <i className="fas fa-wallet" /> Accounts
                </span>
                <Link href={`${base}?tab=accounts`} className="link-btn">
                  Manage
                </Link>
              </div>
              <AccountsTable accounts={user.accounts} settings={settings} />
            </div>
            <div className="panel">
              <div className="panel-title">
                <span>
                  <i className="fas fa-clock-rotate-left" /> Recent activity
                </span>
                <Link href={`${base}?tab=transactions`} className="link-btn">
                  View all
                </Link>
              </div>
              <TransactionsTable transactions={transactions} accountName={accountName} settings={settings} compact />
            </div>
          </div>
        </>
      ) : null}

      {tab === "transactions" ? (
        <>
          <details className="panel add-panel">
            <summary className="panel-title">
              <span>
                <i className="fas fa-circle-plus" /> Add transaction
              </span>
              <i className="fas fa-chevron-down" />
            </summary>
            {openAccounts.length === 0 ? (
              <div className="empty">Open an account first.</div>
            ) : (
              <div style={{ maxWidth: 560 }}>
                <TransactionForm
                  accounts={openAccounts.map((a) => ({
                    id: a.id,
                    label: `${a.name} · ${a.number} (${money(Number(a.balance), settings)})`,
                  }))}
                  currency={settings.currency}
                  timezone={settings.timezone}
                  nowInput={toZonedInput(new Date(), settings.timezone)}
                />
              </div>
            )}
          </details>
          <div className="panel">
            <div className="filter-bar">
              <Link href={`${base}?tab=transactions`} className={`filter-btn ${!accountFilter ? "active" : ""}`}>
                All
              </Link>
              {user.accounts.map((a) => (
                <Link
                  key={a.id}
                  href={`${base}?tab=transactions&account=${a.id}`}
                  className={`filter-btn ${accountFilter === a.id ? "active" : ""}`}
                >
                  {a.name}
                </Link>
              ))}
            </div>
            <TransactionsTable transactions={transactions} accountName={accountName} settings={settings} />
          </div>
        </>
      ) : null}

      {tab === "accounts" ? (
        <div className="two-col-wide">
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-wallet" /> Accounts
              </span>
            </div>
            <AccountsTable accounts={user.accounts} settings={settings} editable />
          </div>
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-piggy-bank" /> Open new account
              </span>
            </div>
            <ActionForm action={createAccountAction}>
              <input type="hidden" name="userId" value={user.id} />
              <div className="form-grid">
                <div className="form-group">
                  <label>Account type</label>
                  <select name="type" defaultValue="SAVINGS">
                    {Object.entries(ACCOUNT_TYPES).map(([k, t]) => (
                      <option key={k} value={k}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Display name</label>
                  <input name="name" placeholder="e.g. Savings" />
                </div>
                <div className="form-group">
                  <label>Opening balance</label>
                  <div className="amount-input">
                    <input name="openingBalance" type="number" step="0.01" min="0" placeholder="0.00" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Interest rate %</label>
                  <input name="interestRate" type="number" step="0.01" min="0" placeholder="e.g. 2.50" />
                </div>
                <div className="form-group span-2">
                  <label>Account number</label>
                  <input name="number" inputMode="numeric" placeholder="Leave blank to auto-generate" />
                </div>
              </div>
              <SubmitButton icon="fa-plus">Open account</SubmitButton>
            </ActionForm>
          </div>
        </div>
      ) : null}

      {tab === "payees" ? (
        <div className="panel">
          <PayeesTable payees={user.payees} settings={settings} />
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-id-card" /> Identity verification
            </span>
            <KycBadge status={user.kycStatus} />
          </div>
          {user.documents.length === 0 ? (
            <div className="empty">The customer hasn&apos;t uploaded any documents yet.</div>
          ) : (
            <div className="doc-grid">
              {user.documents.map((d) => (
                <div className="doc-card" key={d.id}>
                  <a className="doc-preview" href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">
                    {d.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/documents/${d.id}`} alt={DOC_LABEL[d.kind]} />
                    ) : (
                      <i className="fas fa-file-pdf" />
                    )}
                  </a>
                  <div className="doc-meta">
                    <strong>
                      {DOC_LABEL[d.kind]}
                      {d.idType ? ` · ${ID_TYPE_LABEL[d.idType] ?? d.idType}` : ""}
                    </strong>
                    <span>{d.fileName}</span>
                    <span>
                      {(d.size / 1024 / 1024).toFixed(2)} MB · {friendlyDate(d.createdAt.toISOString(), settings)}
                    </span>
                  </div>
                  <div className="doc-actions">
                    <a className="link-btn" href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer">
                      <i className="fas fa-up-right-from-square" /> Open
                    </a>
                    <a className="link-btn" href={`/api/documents/${d.id}?download=1`}>
                      <i className="fas fa-download" /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {user.kycStatus === "REJECTED" && user.kycNote ? (
            <p className="modal-note">
              <i className="fas fa-circle-info" /> Rejected: {user.kycNote}
            </p>
          ) : null}

          {user.documents.length > 0 ? (
            <ActionForm action={reviewKycAction} style={{ marginTop: "1.25rem", maxWidth: 720 }}>
              <input type="hidden" name="userId" value={user.id} />
              <div className="form-group">
                <label>Note to customer (required when rejecting)</label>
                <textarea name="note" rows={2} placeholder="e.g. The bank statement is older than 3 months." />
              </div>
              {user.kycStatus !== "APPROVED" ? (
                <div className="toolbar">
                  <label className="check-row" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      name="openChequing"
                      defaultChecked={!user.accounts.some((a) => a.type === "CHEQUING")}
                    />
                    Open a Chequing account on approval
                  </label>
                  <label className="check-row" style={{ margin: 0 }}>
                    <input type="checkbox" name="openSavings" />
                    Open a Savings account on approval
                  </label>
                </div>
              ) : null}
              <div className="toolbar">
                {user.kycStatus !== "APPROVED" ? (
                  <SubmitButton className="btn-primary inline" name="decision" value="APPROVE" icon="fa-check" pendingText="Saving…">
                    Approve customer
                  </SubmitButton>
                ) : null}
                {user.kycStatus !== "REJECTED" ? (
                  <SubmitButton className="btn-primary inline danger" name="decision" value="REJECT" icon="fa-xmark" pendingText="Saving…">
                    Reject &amp; request new documents
                  </SubmitButton>
                ) : null}
              </div>
            </ActionForm>
          ) : null}
        </div>
      ) : null}

      {tab === "profile" ? (
        <div className="two-col-wide">
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-user-pen" /> Customer details
              </span>
            </div>
            <ActionForm action={updateCustomerAction} resetOnSuccess={false}>
              <input type="hidden" name="userId" value={user.id} />
              <div className="form-grid three">
                <div className="form-group">
                  <label>First name</label>
                  <input name="firstName" defaultValue={user.firstName} />
                </div>
                <div className="form-group">
                  <label>Last name</label>
                  <input name="lastName" defaultValue={user.lastName} />
                </div>
                <div className="form-group">
                  <label>Date of birth</label>
                  <input value={user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : ""} disabled />
                </div>
                <div className="form-group span-2">
                  <label>Email</label>
                  <input name="email" type="email" defaultValue={user.email} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" defaultValue={user.phone ?? ""} />
                </div>
                <div className="form-group span-2">
                  <label>Street address</label>
                  <input name="addressLine" defaultValue={user.addressLine ?? ""} />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input name="city" defaultValue={user.city ?? ""} />
                </div>
                <div className="form-group">
                  <label>Province / State</label>
                  <input name="province" defaultValue={user.province ?? ""} />
                </div>
                <div className="form-group">
                  <label>Postal code</label>
                  <input name="postalCode" defaultValue={user.postalCode ?? ""} />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input name="country" defaultValue={user.country ?? ""} />
                </div>
                <div className="form-group">
                  <label>Member number</label>
                  <input name="memberNumber" defaultValue={user.memberNumber ?? ""} />
                </div>
                <div className="form-group">
                  <label>Branch</label>
                  <input name="branch" defaultValue={user.branch ?? ""} />
                </div>
                <div className="form-group">
                  <label>Set new password</label>
                  <input name="newPassword" type="password" autoComplete="new-password" placeholder="Leave blank to keep" />
                </div>
              </div>
              <label className="check-row">
                <input type="checkbox" name="suspended" defaultChecked={user.suspended} /> Suspend (customer cannot sign in)
              </label>
              <SubmitButton icon="fa-save">Save details</SubmitButton>
            </ActionForm>
          </div>
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-triangle-exclamation" style={{ color: "#b34a4a" }} /> Danger zone
              </span>
            </div>
            <p className="muted" style={{ marginBottom: "1rem", fontSize: ".85rem" }}>
              Deleting removes the customer together with all accounts, transactions, payees and uploaded documents. This
              cannot be undone.
            </p>
            <ActionForm
              action={deleteCustomerAction}
              confirm={`Permanently delete ${fullName(user)}, all their accounts, transactions and documents?`}
            >
              <input type="hidden" name="userId" value={user.id} />
              <SubmitButton className="btn-primary danger" icon="fa-trash">
                Delete customer
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AccountsTable({ accounts, settings, editable }: { accounts: Account[]; settings: Settings; editable?: boolean }) {
  if (accounts.length === 0) {
    return <div className="empty">No accounts yet.</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Account</th>
            <th>Number</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Balance</th>
            {editable ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td>
                <strong>
                  <i className={`fas ${ACCOUNT_TYPES[a.type].icon}`} style={{ color: "#007287" }} /> {a.name}
                </strong>
                <div className="muted">
                  {ACCOUNT_TYPES[a.type].label}
                  {a.interestRate !== null ? ` · ${Number(a.interestRate)}%` : ""}
                </div>
              </td>
              <td>{a.number}</td>
              <td>
                <span
                  className={`badge ${a.status === "ACTIVE" ? "badge-green" : a.status === "FROZEN" ? "badge-amber" : "badge-grey"}`}
                >
                  {a.status}
                </span>
              </td>
              <td className="num">{money(Number(a.balance), settings)}</td>
              {editable ? (
                <td className="num">
                  <details>
                    <summary className="link-btn">Edit</summary>
                    <ActionForm
                      action={updateAccountAction}
                      resetOnSuccess={false}
                      style={{ marginTop: ".75rem", textAlign: "left", minWidth: 240 }}
                    >
                      <input type="hidden" name="accountId" value={a.id} />
                      <div className="form-group">
                        <label>Name</label>
                        <input name="name" defaultValue={a.name} />
                      </div>
                      <div className="form-group">
                        <label>Status</label>
                        <select name="status" defaultValue={a.status}>
                          <option value="ACTIVE">Active</option>
                          <option value="FROZEN">Frozen (no outgoing money)</option>
                          <option value="CLOSED">Closed (hidden from customer)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Interest rate %</label>
                        <input
                          name="interestRate"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={a.interestRate === null ? "" : Number(a.interestRate)}
                        />
                      </div>
                      <SubmitButton icon="fa-save">Save account</SubmitButton>
                    </ActionForm>
                  </details>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({
  transactions,
  accountName,
  settings,
  compact,
}: {
  transactions: Transaction[];
  accountName: Map<number, string>;
  settings: Settings;
  compact?: boolean;
}) {
  if (transactions.length === 0) {
    return <div className="empty">No transactions.</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data">
        {compact ? null : (
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th />
            </tr>
          </thead>
        )}
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              {compact ? null : (
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {friendlyDate(t.postedAt.toISOString(), settings)}
                </td>
              )}
              <td>
                <strong>
                  <i className={`fas ${t.icon}`} style={{ color: "#007287" }} /> {t.title}
                </strong>
                <div className="muted">
                  {compact
                    ? `${accountName.get(t.accountId)} · ${friendlyDate(t.postedAt.toISOString(), settings)}`
                    : `${accountName.get(t.accountId)} · ${KIND_LABELS[t.kind]} · ${t.reference}`}
                </div>
              </td>
              <td>
                <TxStatusBadge status={t.status} />
              </td>
              <td className={`num ${Number(t.amount) > 0 ? "credit" : "debit"}`}>
                {Number(t.amount) > 0 ? "+" : ""}
                {money(Number(t.amount), settings)}
              </td>
              {compact ? null : (
                <td>
                  <TxRowActions id={t.id} status={t.status} meta={t.meta} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayeesTable({ payees, settings }: { payees: Payee[]; settings: Settings }) {
  if (payees.length === 0) {
    return <div className="empty">The customer hasn&apos;t added any payees.</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Payee</th>
            <th>Type</th>
            <th>Bank / destination</th>
            <th>Account / contact</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {payees.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>
                  <i className={`fas ${PAYEE_TYPE_ICONS[p.type]}`} style={{ color: "#007287" }} /> {p.name}
                </strong>
                {p.type === "INTERNATIONAL" ? (
                  <div className="muted">
                    {[p.beneficiaryAddress, p.beneficiaryCity, countryName(p.beneficiaryCountry)].filter(Boolean).join(", ")}
                  </div>
                ) : null}
              </td>
              <td>{PAYEE_TYPE_LABELS[p.type]}</td>
              <td>
                {p.type === "INTERNATIONAL" ? (
                  <>
                    {p.bankName}
                    <div className="muted">
                      {countryName(p.bankCountry)} · SWIFT {p.swiftBic}
                      {p.routingCode ? ` · Routing ${p.routingCode}` : ""}
                    </div>
                  </>
                ) : (
                  <span className="muted">{p.type === "ETRANSFER" ? "Interac (Canada)" : "Canadian biller"}</span>
                )}
              </td>
              <td>
                {p.type === "INTERNATIONAL" ? (
                  <>
                    {p.accountNumber && looksLikeIban(p.accountNumber) ? formatIban(p.accountNumber) : p.accountNumber}
                    <div className="muted">
                      {p.accountNumber && looksLikeIban(p.accountNumber) ? "IBAN" : "Account"} · receives {p.currency}
                    </div>
                  </>
                ) : p.type === "ETRANSFER" ? (
                  (p.email ?? formatPhone(p.phone))
                ) : (
                  (p.accountNumber ?? "—")
                )}
              </td>
              <td className="muted" style={{ whiteSpace: "nowrap" }}>
                {friendlyDate(p.createdAt.toISOString(), settings)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
