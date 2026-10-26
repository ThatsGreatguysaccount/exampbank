"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type {
  AccountView,
  PayeeView,
  ProductView,
  ProfileView,
  PublicSettings,
  TransactionView,
} from "@/lib/view-types";
import { friendlyDate, fullDate, money } from "@/lib/format";
import { formatPhone } from "@/lib/payees";
import { Modal, useToast } from "@/components/ui";
import {
  billPayAction,
  depositChequeAction,
  eTransferAction,
  transferAction,
  wireTransferAction,
  type ActionResult,
} from "@/app/actions/banking";
import { logoutAction } from "@/app/actions/auth";
import { PayeesModal } from "./payees";
import { BillPayModal, ETransferModal, SubmitFooter, WireModal, type FormModalProps } from "./transfers";

type ModalState =
  | { kind: "account"; id: number }
  | { kind: "tx"; id: number }
  | { kind: "all" }
  | { kind: "profile" }
  | { kind: "bill" }
  | { kind: "deposit" }
  | { kind: "etransfer" }
  | { kind: "wire" }
  | { kind: "payees" }
  | null;

const KIND_LABELS: Record<string, string> = {
  TRANSFER: "Transfer",
  BILL_PAYMENT: "Bill payment",
  CHEQUE_DEPOSIT: "Cheque deposit",
  ETRANSFER: "e-Transfer",
  WIRE_TRANSFER: "International wire",
  ADMIN_CREDIT: "Credit",
  ADMIN_DEBIT: "Debit",
  INTEREST: "Interest",
  FEE: "Fee",
  INVESTMENT: "Investment",
};

function StatusBadge({ status }: { status: TransactionView["status"] }) {
  if (status === "PENDING") return <span className="badge badge-amber">Pending</span>;
  if (status === "REJECTED") return <span className="badge badge-red">Declined</span>;
  return null;
}

export function DashboardClient({
  settings,
  accounts,
  transactions,
  products,
  payees,
  profile,
}: {
  settings: PublicSettings;
  accounts: AccountView[];
  transactions: TransactionView[];
  products: ProductView[];
  payees: PayeeView[];
  profile: ProfileView;
}) {
  const fmt = (v: number) => money(v, settings);
  const { showToast, toastNode } = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [filter, setFilter] = useState<number | "all">("all");
  const [pending, startTransition] = useTransition();

  const activeAccounts = accounts.filter((a) => a.status === "ACTIVE");
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const [fromId, setFromId] = useState<number>(activeAccounts[0]?.id ?? 0);
  const [toId, setToId] = useState<number>(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? 0);
  const [transferAmount, setTransferAmount] = useState("100.00");

  const close = () => setModal(null);
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();
  const accountSub = (a: AccountView) => (a.registered ? "Registered plan" : `**** ${a.number.slice(-4)}`);
  const accountOption = (a: AccountView) =>
    `${a.name}${a.registered ? "" : ` **** ${a.number.slice(-4)}`} (${fmt(a.balance)})`;

  const filtered = transactions.filter((t) => filter === "all" || t.accountId === filter);

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    startTransition(async () => {
      try {
        const res = await action();
        if (res.ok) {
          showToast(res.message, "success");
          onOk?.();
        } else {
          showToast(res.error, "error");
        }
      } catch {
        showToast("Something went wrong. Please try again.", "error");
      }
    });
  }

  function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return showToast("Enter a valid amount.", "error");
    if (fromId === toId) return showToast("Choose two different accounts.", "error");
    const from = accountById.get(fromId);
    if (from && amount > from.balance) {
      return showToast(`Insufficient funds in ${from.name}. Available: ${fmt(from.balance)}`, "error");
    }
    run(() => transferAction({ fromId, toId, amount }), () => setTransferAmount("100.00"));
  }

  return (
    <div className="dashboard">
      {/* Top bar */}
      <div className="top-bar">
        <div className="brand" onClick={() => showToast(settings.brandMessage, "info")}>
          <i className={`fas ${settings.brandIcon}`} />
          <div>
            <h1>{settings.bankName}</h1>
            <span>{settings.bankTagline}</span>
          </div>
        </div>
        <button type="button" className="user-greeting" onClick={() => setModal({ kind: "profile" })}>
          <div className="avatar">{initials}</div>
          <div className="name">
            {profile.firstName} {profile.lastName}
            <small>Member #{profile.memberNumber ?? "—"}</small>
          </div>
        </button>
      </div>

      {/* Cards */}
      <div className="cards">
        {accounts.length === 0 ? (
          <div className="card" style={{ cursor: "default" }}>
            <div className="card-label">
              <i className="fas fa-hourglass-half" /> Accounts
            </div>
            <div className="card-amount" style={{ fontSize: "1.1rem" }}>
              Your accounts are being set up
            </div>
            <div className="card-sub">
              <span>We&apos;ll notify you once they&apos;re open.</span>
            </div>
          </div>
        ) : (
          accounts.map((a) => (
            <button type="button" key={a.id} className="card" onClick={() => setModal({ kind: "account", id: a.id })}>
              {a.status === "FROZEN" ? <span className="badge badge-red card-frozen">Frozen</span> : null}
              <div className="card-label">
                <i className={`fas ${a.icon}`} /> {a.name}
              </div>
              <div className="card-amount">{fmt(a.balance)}</div>
              <div className="card-sub">
                <span>{accountSub(a)}</span>
                {a.trend !== null ? (
                  <span className={a.trend >= 0 ? "trend-up" : "trend-down"}>
                    <i className={`fas ${a.trend >= 0 ? "fa-arrow-up" : "fa-arrow-down"}`} /> {a.trend >= 0 ? "+" : ""}
                    {a.trend}%
                  </span>
                ) : a.interestRate !== null ? (
                  <span className="trend-up">{a.interestRate}% APY</span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Main grid */}
      <div className="main-grid">
        <div>
          <div className="section-header">
            <h2>
              <i className="fas fa-clock-rotate-left" /> Recent activity
            </h2>
            <button className="link-btn" onClick={() => setModal({ kind: "all" })}>
              <i className="fas fa-list" /> View all
            </button>
          </div>

          <div className="filter-bar">
            <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
              All
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                className={`filter-btn ${filter === a.id ? "active" : ""}`}
                onClick={() => setFilter(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>

          <div className="transaction-list">
            {filtered.length === 0 ? (
              <div className="no-trans">
                <i className="fas fa-inbox" style={{ fontSize: "2rem", opacity: 0.4 }} />
                <br />
                No transactions for this account.
              </div>
            ) : (
              filtered.slice(0, 50).map((t) => {
                const isCredit = t.amount > 0;
                return (
                  <button
                    type="button"
                    key={t.id}
                    className="transaction-item"
                    onClick={() => setModal({ kind: "tx", id: t.id })}
                  >
                    <div className="trans-left">
                      <div className="trans-icon">
                        <i className={`fas ${t.icon}`} />
                      </div>
                      <div className="trans-details">
                        <div className="trans-title">{t.title}</div>
                        <div className="trans-date">
                          {friendlyDate(t.postedAt, settings)} · {accountById.get(t.accountId)?.name}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`trans-amount ${t.status === "REJECTED" ? "rejected-amount" : isCredit ? "credit" : "debit"}`}
                    >
                      {isCredit ? "+" : ""}
                      {fmt(t.amount)}
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {products.length ? (
            <>
              <div className="section-header" style={{ marginTop: "1.75rem", marginBottom: 0 }}>
                <h2>
                  <i className="fas fa-chart-line" /> Invest &amp; borrow
                </h2>
                <Link href="/dashboard/products" className="link-btn">
                  <i className="fas fa-grip" /> View all products
                </Link>
              </div>
              <div className="product-row" style={{ marginTop: "1rem" }}>
                {products.map((p) => {
                  const inner = (
                    <>
                      <div className="product-icon">
                        <i className={`fas ${p.icon}`} />
                      </div>
                      <div className="product-info">
                        <h4>{p.title}</h4>
                        <p>{p.description}</p>
                      </div>
                    </>
                  );
                  return p.slug ? (
                    <Link key={p.id} href={`/dashboard/products/${p.slug}`} className="product-item" style={{ textDecoration: "none" }}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      key={p.id}
                      className="product-item"
                      onClick={() => showToast(`${p.title} — a specialist will contact you.`, "info")}
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="transfer-card">
          <h3>
            <i className="fas fa-arrow-right-arrow-left" /> Move money
          </h3>
          <form onSubmit={submitTransfer}>
            <div className="form-group">
              <label htmlFor="fromAccount">From account</label>
              <select id="fromAccount" value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountOption(a)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="toAccount">To account</label>
              <select id="toAccount" value={toId} onChange={(e) => setToId(Number(e.target.value))}>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountOption(a)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="transferAmount">Amount ({settings.currency})</label>
              <div className="amount-input">
                <input
                  type="number"
                  id="transferAmount"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={pending || activeAccounts.length < 2}>
              <i className={`fas ${pending ? "fa-spinner fa-spin" : "fa-check-circle"}`} /> Transfer now
            </button>
            {activeAccounts.length < 2 ? (
              <p className="modal-note">You need at least two active accounts to move money between them.</p>
            ) : null}
          </form>

          <div className="quick-actions">
            <button className="quick-btn" onClick={() => setModal({ kind: "bill" })} disabled={!activeAccounts.length}>
              <i className="fas fa-file-invoice" /> Pay bills
            </button>
            <button className="quick-btn" onClick={() => setModal({ kind: "deposit" })} disabled={!activeAccounts.length}>
              <i className="fas fa-qrcode" /> Deposit cheque
            </button>
            <button
              className="quick-btn"
              onClick={() => setModal({ kind: "etransfer" })}
              disabled={!activeAccounts.length}
            >
              <i className="fas fa-paper-plane" /> e-Transfer
            </button>
            <button className="quick-btn" onClick={() => setModal({ kind: "wire" })} disabled={!activeAccounts.length}>
              <i className="fas fa-globe" /> International wire
            </button>
            <button className="quick-btn" onClick={() => setModal({ kind: "payees" })}>
              <i className="fas fa-address-book" /> Payees
            </button>
          </div>
        </div>
      </div>

      <div className="footer-note">
        <span>
          <i className="fas fa-shield-alt" /> {settings.footerLeft}
        </span>
        <span>
          <i className="fas fa-lock" /> {settings.footerRight}
        </span>
      </div>

      {toastNode}

      {modal?.kind === "account"
        ? (() => {
            const a = accountById.get(modal.id);
            if (!a) return null;
            const count = transactions.filter((t) => t.accountId === a.id).length;
            return (
              <Modal
                title={a.name}
                icon={a.icon}
                onClose={close}
                footer={
                  <>
                    <button className="btn-secondary" onClick={close}>
                      Close
                    </button>
                    <button
                      className="btn-primary"
                      disabled={a.status !== "ACTIVE"}
                      onClick={() => {
                        setFromId(a.id);
                        if (toId === a.id) setToId(activeAccounts.find((x) => x.id !== a.id)?.id ?? a.id);
                        close();
                        showToast(`${a.name} selected as source account.`, "info");
                      }}
                    >
                      <i className="fas fa-arrow-right-arrow-left" /> Use for transfer
                    </button>
                  </>
                }
              >
                <div className="detail-row">
                  <span>Account type</span>
                  <strong>{a.name}</strong>
                </div>
                <div className="detail-row">
                  <span>Account number</span>
                  <strong>**** {a.number.slice(-4)}</strong>
                </div>
                <div className="detail-row">
                  <span>Available balance</span>
                  <strong style={{ color: "#007287" }}>{fmt(a.balance)}</strong>
                </div>
                {a.interestRate !== null ? (
                  <div className="detail-row">
                    <span>Interest rate</span>
                    <strong>{a.interestRate}%</strong>
                  </div>
                ) : null}
                <div className="detail-row">
                  <span>Status</span>
                  <strong>
                    <span className={`badge ${a.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{a.status}</span>
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Recent activity</span>
                  <strong>{count} transactions</strong>
                </div>
              </Modal>
            );
          })()
        : null}

      {modal?.kind === "tx"
        ? (() => {
            const t = transactions.find((x) => x.id === modal.id);
            if (!t) return null;
            const isCredit = t.amount > 0;
            const meta = t.meta ?? {};
            return (
              <Modal
                title="Transaction details"
                icon={t.icon}
                onClose={close}
                footer={
                  <button className="btn-secondary" onClick={close}>
                    Close
                  </button>
                }
              >
                <div className="detail-row">
                  <span>Description</span>
                  <strong>{t.title}</strong>
                </div>
                <div className="detail-row">
                  <span>Account</span>
                  <strong>{accountById.get(t.accountId)?.name}</strong>
                </div>
                <div className="detail-row">
                  <span>Date</span>
                  <strong>{fullDate(t.postedAt, settings)}</strong>
                </div>
                <div className="detail-row">
                  <span>Type</span>
                  <strong>
                    <span className={`badge ${isCredit ? "badge-green" : "badge-red"}`}>
                      {isCredit ? "Credit" : "Debit"}
                    </span>{" "}
                    <span className="badge badge-grey">{KIND_LABELS[t.kind] ?? t.kind}</span>
                  </strong>
                </div>
                <div className="detail-row">
                  <span>Status</span>
                  <strong>
                    {t.status === "COMPLETED" ? <span className="badge badge-green">Completed</span> : <StatusBadge status={t.status} />}
                  </strong>
                </div>
                {typeof meta.payee === "string" ? (
                  <div className="detail-row">
                    <span>Payee</span>
                    <strong>
                      {meta.payee}
                      {meta.payeeAccount ? ` · ${String(meta.payeeAccount)}` : ""}
                    </strong>
                  </div>
                ) : null}
                {t.kind === "ETRANSFER" && (typeof meta.email === "string" || typeof meta.phone === "string") ? (
                  <div className="detail-row">
                    <span>Recipient</span>
                    <strong>
                      {meta.recipientName ? `${String(meta.recipientName)} · ` : ""}
                      {typeof meta.email === "string" ? meta.email : formatPhone(String(meta.phone))}
                    </strong>
                  </div>
                ) : null}
                {t.kind === "WIRE_TRANSFER"
                  ? (
                      [
                        ["Beneficiary", meta.beneficiary],
                        ["Address", meta.beneficiaryAddress],
                        ["Bank", meta.bankName ? `${String(meta.bankName)}${meta.bankCountry ? `, ${String(meta.bankCountry)}` : ""}` : ""],
                        ["SWIFT / BIC", meta.swiftBic],
                        ["IBAN", meta.iban],
                        ["Account number", meta.accountNumber],
                        ["Routing code", meta.routingCode],
                        ["Receives", meta.receivingCurrency],
                        ["Purpose", meta.purpose],
                        ["Amount sent", meta.amountSent],
                        ["Wire fee", meta.wireFee],
                      ] as const
                    )
                      .filter(([, v]) => typeof v === "string" && v)
                      .map(([label, v]) => (
                        <div className="detail-row" key={label}>
                          <span>{label}</span>
                          <strong>{String(v)}</strong>
                        </div>
                      ))
                  : null}
                {typeof meta.chequeNumber === "string" ? (
                  <div className="detail-row">
                    <span>Cheque number</span>
                    <strong>{meta.chequeNumber}</strong>
                  </div>
                ) : null}
                {t.description ? (
                  <div className="detail-row">
                    <span>Note</span>
                    <strong>{t.description}</strong>
                  </div>
                ) : null}
                {t.status === "REJECTED" && t.reviewNote ? (
                  <div className="detail-row">
                    <span>Reason</span>
                    <strong>{t.reviewNote}</strong>
                  </div>
                ) : null}
                <div className="detail-row">
                  <span>Amount</span>
                  <strong style={{ color: isCredit ? "#007287" : "#b34a4a", fontSize: "1.2rem" }}>
                    {isCredit ? "+" : ""}
                    {fmt(t.amount)}
                  </strong>
                </div>
                <div className="modal-note">
                  <i className="fas fa-receipt" /> Transaction ID: {t.reference}
                </div>
              </Modal>
            );
          })()
        : null}

      {modal?.kind === "all" ? (
        <Modal
          title="All transactions"
          icon="fa-list"
          onClose={close}
          footer={
            <button className="btn-secondary" onClick={close}>
              Close
            </button>
          }
        >
          {transactions.length === 0 ? <div className="no-trans">No transactions yet.</div> : null}
          {transactions.map((t) => {
            const isCredit = t.amount > 0;
            return (
              <div className="detail-row" key={t.id} style={{ cursor: "pointer" }} onClick={() => setModal({ kind: "tx", id: t.id })}>
                <span>
                  {t.title} <StatusBadge status={t.status} />
                  <br />
                  <small style={{ color: "#5c8a94", fontSize: ".72rem" }}>
                    {friendlyDate(t.postedAt, settings)} · {accountById.get(t.accountId)?.name}
                  </small>
                </span>
                <strong
                  style={{
                    color: t.status === "REJECTED" ? "#9cb8bf" : isCredit ? "#007287" : "#b34a4a",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isCredit ? "+" : ""}
                  {fmt(t.amount)}
                </strong>
              </div>
            );
          })}
        </Modal>
      ) : null}

      {modal?.kind === "profile" ? (
        <Modal
          title="Profile"
          icon="fa-user-circle"
          onClose={close}
          footer={
            <>
              <button className="btn-secondary" onClick={close}>
                Close
              </button>
              <form action={logoutAction} style={{ flex: 1 }}>
                <button type="submit" className="btn-primary">
                  <i className="fas fa-right-from-bracket" /> Sign out
                </button>
              </form>
            </>
          }
        >
          <div className="detail-row">
            <span>Name</span>
            <strong>
              {profile.firstName} {profile.lastName}
            </strong>
          </div>
          <div className="detail-row">
            <span>Member number</span>
            <strong>{profile.memberNumber ?? "—"}</strong>
          </div>
          <div className="detail-row">
            <span>Email</span>
            <strong>{profile.email}</strong>
          </div>
          {profile.phone ? (
            <div className="detail-row">
              <span>Phone</span>
              <strong>{profile.phone}</strong>
            </div>
          ) : null}
          {profile.address ? (
            <div className="detail-row">
              <span>Address</span>
              <strong>{profile.address}</strong>
            </div>
          ) : null}
          <div className="detail-row">
            <span>Branch</span>
            <strong>{profile.branch ?? "—"}</strong>
          </div>
          <div className="detail-row">
            <span>Member since</span>
            <strong>{profile.memberSince}</strong>
          </div>
          <div className="modal-note">
            <i className="fas fa-shield-alt" /> Your data is protected with 256-bit encryption.
          </div>
        </Modal>
      ) : null}

      {modal?.kind === "bill" ? (
        <BillPayModal
          accounts={activeAccounts}
          savedPayees={payees}
          toast={showToast}
          currency={settings.currency}
          optionLabel={accountOption}
          pending={pending}
          onClose={close}
          onSubmit={(v) => run(() => billPayAction(v), close)}
          onInvalid={(m) => showToast(m, "error")}
        />
      ) : null}

      {modal?.kind === "deposit" ? (
        <DepositModal
          accounts={activeAccounts}
          currency={settings.currency}
          holdNotice={settings.chequeHoldNotice}
          optionLabel={accountOption}
          pending={pending}
          onClose={close}
          onSubmit={(v) => run(() => depositChequeAction(v), close)}
          onInvalid={(m) => showToast(m, "error")}
        />
      ) : null}

      {modal?.kind === "etransfer" ? (
        <ETransferModal
          accounts={activeAccounts}
          contacts={payees}
          toast={showToast}
          currency={settings.currency}
          optionLabel={accountOption}
          pending={pending}
          onClose={close}
          onSubmit={(v) => run(() => eTransferAction(v), close)}
          onInvalid={(m) => showToast(m, "error")}
        />
      ) : null}

      {modal?.kind === "wire" ? (
        <WireModal
          accounts={activeAccounts}
          beneficiaries={payees}
          toast={showToast}
          currency={settings.currency}
          fee={settings.wireFee}
          notice={settings.wireNotice}
          fmt={fmt}
          optionLabel={accountOption}
          pending={pending}
          onClose={close}
          onSubmit={(v) => run(() => wireTransferAction(v), close)}
          onInvalid={(m) => showToast(m, "error")}
        />
      ) : null}

      {modal?.kind === "payees" ? (
        <PayeesModal payees={payees} toast={showToast} onClose={close} />
      ) : null}
    </div>
  );
}

function DepositModal({
  accounts,
  currency,
  holdNotice,
  optionLabel,
  pending,
  onClose,
  onSubmit,
  onInvalid,
}: FormModalProps<{ toId: number; amount: number; chequeNumber: string }> & { holdNotice: string }) {
  const [toId, setToId] = useState(accounts[0]?.id ?? 0);
  const [amount, setAmount] = useState("250.00");
  const [chequeNumber, setChequeNumber] = useState("");

  return (
    <Modal title="Deposit a cheque" icon="fa-qrcode" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amt = parseFloat(amount);
          if (!amt || amt <= 0) return onInvalid("Enter a valid amount.");
          if (!chequeNumber.trim()) return onInvalid("Enter the cheque number.");
          onSubmit({ toId, amount: amt, chequeNumber });
        }}
      >
        <div className="form-group">
          <label>Deposit to</label>
          <select value={toId} onChange={(e) => setToId(Number(e.target.value))}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {optionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Cheque amount ({currency})</label>
          <div className="amount-input">
            <input type="number" placeholder="0.00" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Cheque number</label>
          <input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 001234" />
          <div className="hint">{holdNotice}</div>
        </div>
        <div className="modal-footer">
          <SubmitFooter pending={pending} onClose={onClose} icon="fa-camera" label="Deposit" />
        </div>
      </form>
    </Modal>
  );
}
