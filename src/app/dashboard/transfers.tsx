"use client";

import { useState, useTransition } from "react";
import type { AccountView, PayeeView } from "@/lib/view-types";
import { Modal, type ToastType } from "@/components/ui";
import { deletePayeeAction } from "@/app/actions/banking";
import { WIRE_PURPOSES, countryName, formatIban, formatPhone, looksLikeIban, maskAccount } from "@/lib/payees";
import { AddPayeeForm } from "./payees";

export type FormModalProps<T> = {
  accounts: AccountView[];
  currency: string;
  optionLabel: (a: AccountView) => string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (v: T) => void;
  onInvalid: (msg: string) => void;
};

type Toast = (msg: string, type?: ToastType) => void;

export function SubmitFooter({
  pending,
  onClose,
  icon,
  label,
  cancelLabel = "Cancel",
}: {
  pending: boolean;
  onClose: () => void;
  icon: string;
  label: string;
  cancelLabel?: string;
}) {
  return (
    <>
      <button type="button" className="btn-secondary" onClick={onClose}>
        {cancelLabel}
      </button>
      <button type="submit" className="btn-primary" disabled={pending}>
        <i className={`fas ${pending ? "fa-spinner fa-spin" : icon}`} /> {label}
      </button>
    </>
  );
}

function AccountSelect({
  label,
  accounts,
  value,
  onChange,
  optionLabel,
}: {
  label: string;
  accounts: AccountView[];
  value: number;
  onChange: (id: number) => void;
  optionLabel: (a: AccountView) => string;
}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {optionLabel(a)}
          </option>
        ))}
      </select>
    </div>
  );
}

function AmountInput({ currency, value, onChange, label = "Amount" }: { currency: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="form-group">
      <label>
        {label} ({currency})
      </label>
      <div className="amount-input">
        <input type="number" placeholder="0.00" step="0.01" min="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

/* ---------------- Bill payments ---------------- */

type BillPayInput = { fromId: number; payeeId: number; payeeAccount: string; amount: number };

export function BillPayModal({
  accounts,
  savedPayees,
  toast,
  currency,
  optionLabel,
  pending,
  onClose,
  onSubmit,
  onInvalid,
}: FormModalProps<BillPayInput> & { savedPayees: PayeeView[]; toast: Toast }) {
  const bills = savedPayees.filter((p) => p.type === "BILL");
  const [payeeId, setPayeeId] = useState(bills[0]?.id ?? 0);
  const [payeeAccount, setPayeeAccount] = useState(bills[0]?.accountNumber ?? "");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? 0);
  const [amount, setAmount] = useState("85.00");
  const [adding, setAdding] = useState(bills.length === 0);
  const [payeeBusy, startPayee] = useTransition();
  const from = accounts.find((a) => a.id === fromId);
  const selectedSaved = bills.find((p) => p.id === payeeId);

  function choose(id: number) {
    setPayeeId(id);
    setPayeeAccount(bills.find((p) => p.id === id)?.accountNumber ?? "");
  }

  function removePayee(p: PayeeView) {
    if (!window.confirm(`Remove ${p.name} from your payees?`)) return;
    startPayee(async () => {
      const res = await deletePayeeAction({ payeeId: p.id });
      if (!res.ok) return toast(res.error, "error");
      toast(res.message, "success");
      const next = bills.find((x) => x.id !== p.id);
      if (next) choose(next.id);
      else onClose();
    });
  }

  if (adding) {
    return (
      <Modal title="Add a bill payee" icon="fa-user-plus" onClose={onClose}>
        <AddPayeeForm
          initialType="BILL"
          lockType
          toast={toast}
          onCancel={bills.length ? () => setAdding(false) : onClose}
          onSaved={(id, p) => {
            setPayeeId(id);
            setPayeeAccount(p.accountNumber ?? "");
            setAdding(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Pay a bill" icon="fa-file-invoice" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!selectedSaved) return onInvalid("Add a payee first.");
          const amt = parseFloat(amount);
          if (!amt || amt <= 0) return onInvalid("Enter a valid amount.");
          if (from && amt > from.balance) return onInvalid("Insufficient funds.");
          onSubmit({ fromId, payeeId: selectedSaved.id, payeeAccount, amount: amt });
        }}
      >
        <div className="form-group">
          <div className="section-header" style={{ marginBottom: ".3rem" }}>
            <label style={{ margin: 0 }}>Payee</label>
            <button type="button" className="link-btn" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add payee
            </button>
          </div>
          <select value={payeeId} onChange={(e) => choose(Number(e.target.value))}>
            {bills.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.accountNumber ? ` · ${p.accountNumber}` : ""}
              </option>
            ))}
          </select>
          {selectedSaved ? (
            <div className="hint">
              <button
                type="button"
                className="link-btn danger"
                style={{ marginTop: ".4rem" }}
                onClick={() => removePayee(selectedSaved)}
                disabled={payeeBusy}
              >
                <i className="fas fa-trash" /> Remove this payee
              </button>
            </div>
          ) : null}
        </div>
        <div className="form-group">
          <label>Payee account / reference number</label>
          <input value={payeeAccount} onChange={(e) => setPayeeAccount(e.target.value)} placeholder="As shown on your bill" />
        </div>
        <AccountSelect label="From account" accounts={accounts} value={fromId} onChange={setFromId} optionLabel={optionLabel} />
        <AmountInput currency={currency} value={amount} onChange={setAmount} />
        <div className="modal-footer">
          <SubmitFooter pending={pending} onClose={onClose} icon="fa-paper-plane" label="Pay bill" />
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Interac e-Transfer ---------------- */

type ETransferInput = {
  fromId: number;
  payeeId?: number;
  recipientName?: string;
  email?: string;
  phone?: string;
  amount: number;
  message: string;
};

export function ETransferModal({
  accounts,
  contacts,
  toast,
  currency,
  optionLabel,
  pending,
  onClose,
  onSubmit,
  onInvalid,
}: FormModalProps<ETransferInput> & { contacts: PayeeView[]; toast: Toast }) {
  const saved = contacts.filter((p) => p.type === "ETRANSFER");
  const [recipientKey, setRecipientKey] = useState(saved[0] ? String(saved[0].id) : "new");
  const [adding, setAdding] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [notifyBy, setNotifyBy] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? 0);
  const [amount, setAmount] = useState("50.00");
  const [message, setMessage] = useState("");
  const from = accounts.find((a) => a.id === fromId);
  const contact = saved.find((p) => String(p.id) === recipientKey);

  if (adding) {
    return (
      <Modal title="Add an e-Transfer contact" icon="fa-user-plus" onClose={onClose}>
        <AddPayeeForm
          initialType="ETRANSFER"
          lockType
          toast={toast}
          onCancel={() => setAdding(false)}
          onSaved={(id) => {
            setRecipientKey(String(id));
            setAdding(false);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Send INTERAC e-Transfer" icon="fa-paper-plane" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amt = parseFloat(amount);
          if (!amt || amt <= 0) return onInvalid("Enter a valid amount.");
          if (from && amt > from.balance) return onInvalid("Insufficient funds.");
          if (contact) return onSubmit({ fromId, payeeId: contact.id, amount: amt, message });
          if (recipientName.trim().length < 2) return onInvalid("Enter the recipient's name.");
          if (notifyBy === "email" && !email.includes("@")) return onInvalid("Enter a valid email.");
          if (notifyBy === "phone" && phone.replace(/\D/g, "").length < 10) return onInvalid("Enter a valid mobile number.");
          onSubmit({
            fromId,
            recipientName,
            ...(notifyBy === "email" ? { email } : { phone }),
            amount: amt,
            message,
          });
        }}
      >
        <div className="form-group">
          <div className="section-header" style={{ marginBottom: ".3rem" }}>
            <label style={{ margin: 0 }}>Send to</label>
            <button type="button" className="link-btn" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add contact
            </button>
          </div>
          <select value={recipientKey} onChange={(e) => setRecipientKey(e.target.value)}>
            {saved.length ? (
              <optgroup label="My contacts">
                {saved.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.email ?? formatPhone(p.phone)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value="new">Someone new (one-time)</option>
          </select>
        </div>

        {contact ? null : (
          <>
            <div className="form-group">
              <label>Recipient name</label>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Sarah Thompson" />
            </div>
            <div className="form-group">
              <div className="segmented">
                <input type="radio" id="et-email" checked={notifyBy === "email"} onChange={() => setNotifyBy("email")} />
                <label htmlFor="et-email">
                  <i className="fas fa-envelope" /> Email
                </label>
                <input type="radio" id="et-phone" checked={notifyBy === "phone"} onChange={() => setNotifyBy("phone")} />
                <label htmlFor="et-phone">
                  <i className="fas fa-mobile-screen" /> Mobile
                </label>
              </div>
            </div>
            <div className="form-group">
              {notifyBy === "email" ? (
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.ca" />
              ) : (
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(306) 555-0123" />
              )}
            </div>
          </>
        )}

        <AccountSelect label="From account" accounts={accounts} value={fromId} onChange={setFromId} optionLabel={optionLabel} />
        <AmountInput currency={currency} value={amount} onChange={setAmount} />
        <div className="form-group">
          <label>Message</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional" maxLength={400} />
        </div>
        <div className="modal-footer">
          <SubmitFooter pending={pending} onClose={onClose} icon="fa-paper-plane" label="Send e-Transfer" />
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- International wire ---------------- */

type WireInput = { fromId: number; payeeId: number; amount: number; purpose: string; message: string };

function BeneficiaryCard({ p }: { p: PayeeView }) {
  const account = p.accountNumber && looksLikeIban(p.accountNumber) ? formatIban(p.accountNumber) : p.accountNumber;
  return (
    <div className="payee-card">
      <strong>{p.name}</strong>
      <br />
      {[p.beneficiaryAddress, p.beneficiaryCity, countryName(p.beneficiaryCountry)].filter(Boolean).join(", ")}
      <br />
      <i className="fas fa-building-columns" /> {p.bankName} · SWIFT {p.swiftBic}
      <br />
      {p.accountNumber && looksLikeIban(p.accountNumber) ? "IBAN" : "Account"} {account}
      {p.routingCode ? ` · Routing ${p.routingCode}` : ""} · Receives {p.currency}
    </div>
  );
}

export function WireModal({
  accounts,
  beneficiaries,
  toast,
  currency,
  fee,
  notice,
  fmt,
  optionLabel,
  pending,
  onClose,
  onSubmit,
  onInvalid,
}: FormModalProps<WireInput> & {
  beneficiaries: PayeeView[];
  toast: Toast;
  fee: number;
  notice: string;
  fmt: (v: number) => string;
}) {
  const list = beneficiaries.filter((p) => p.type === "INTERNATIONAL");
  const [payeeId, setPayeeId] = useState(list[0]?.id ?? 0);
  const [adding, setAdding] = useState(list.length === 0);
  const [reviewing, setReviewing] = useState(false);
  const [fromId, setFromId] = useState(accounts[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState("");
  const from = accounts.find((a) => a.id === fromId);
  const payee = list.find((p) => p.id === payeeId);
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100;
  const total = Math.round((amt + fee) * 100) / 100;

  if (adding) {
    return (
      <Modal title="Add a wire beneficiary" icon="fa-globe" onClose={onClose} wide>
        <AddPayeeForm
          initialType="INTERNATIONAL"
          lockType
          toast={toast}
          onCancel={list.length ? () => setAdding(false) : onClose}
          onSaved={(id) => {
            setPayeeId(id);
            setAdding(false);
          }}
        />
      </Modal>
    );
  }

  if (reviewing && payee && from) {
    return (
      <Modal title="Review your wire" icon="fa-globe" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ fromId, payeeId, amount: amt, purpose, message });
          }}
        >
          <BeneficiaryCard p={payee} />
          <div className="detail-row">
            <span>From</span>
            <strong>{optionLabel(from)}</strong>
          </div>
          <div className="detail-row">
            <span>Purpose</span>
            <strong>{purpose}</strong>
          </div>
          {message ? (
            <div className="detail-row">
              <span>Message to beneficiary</span>
              <strong>{message}</strong>
            </div>
          ) : null}
          <div className="detail-row">
            <span>Amount sent</span>
            <strong>{fmt(amt)}</strong>
          </div>
          <div className="detail-row">
            <span>Wire fee</span>
            <strong>{fmt(fee)}</strong>
          </div>
          <div className="detail-row review-total">
            <span>Total debited</span>
            <strong>{fmt(total)}</strong>
          </div>
          <p className="modal-note">
            <i className="fas fa-circle-info" /> {payee.name} receives {payee.currency}. {notice}
          </p>
          <div className="modal-footer">
            <SubmitFooter pending={pending} onClose={() => setReviewing(false)} cancelLabel="Back" icon="fa-paper-plane" label="Confirm & send" />
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal title="International wire transfer" icon="fa-globe" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!payee) return onInvalid("Choose a beneficiary.");
          if (!amt || amt <= 0) return onInvalid("Enter a valid amount.");
          if (amt < 10) return onInvalid("The minimum wire amount is 10.00.");
          if (!purpose) return onInvalid("Choose the purpose of this payment.");
          if (from && total > from.balance) {
            return onInvalid(`Insufficient funds. You need ${fmt(total)} including the ${fmt(fee)} wire fee.`);
          }
          setReviewing(true);
        }}
      >
        <div className="form-group">
          <div className="section-header" style={{ marginBottom: ".3rem" }}>
            <label style={{ margin: 0 }}>Beneficiary</label>
            <button type="button" className="link-btn" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add beneficiary
            </button>
          </div>
          <select value={payeeId} onChange={(e) => setPayeeId(Number(e.target.value))}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {countryName(p.bankCountry)} · {maskAccount(p.accountNumber)}
              </option>
            ))}
          </select>
        </div>
        {payee ? <BeneficiaryCard p={payee} /> : null}
        <AccountSelect label="From account" accounts={accounts} value={fromId} onChange={setFromId} optionLabel={optionLabel} />
        <AmountInput currency={currency} value={amount} onChange={setAmount} label="Amount to send" />
        <div className="form-group">
          <label>Purpose of payment</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="">Select…</option>
            {WIRE_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <div className="hint">Required by international banking regulations.</div>
        </div>
        <div className="form-group">
          <label>Message to beneficiary</label>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional, e.g. invoice number" maxLength={140} />
        </div>
        <div className="detail-row">
          <span>Wire fee</span>
          <strong>{fmt(fee)}</strong>
        </div>
        <div className="detail-row review-total">
          <span>Total debited</span>
          <strong>{fmt(amt ? total : 0)}</strong>
        </div>
        <p className="modal-note">
          <i className="fas fa-circle-info" /> {payee ? `${payee.name} receives ${payee.currency}. ` : ""}
          {notice}
        </p>
        <div className="modal-footer">
          <SubmitFooter pending={false} onClose={onClose} icon="fa-arrow-right" label="Review" />
        </div>
      </form>
    </Modal>
  );
}
