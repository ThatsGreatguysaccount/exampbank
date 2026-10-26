"use client";

import { useState, useTransition } from "react";
import type { PayeeView } from "@/lib/view-types";
import { Modal, type ToastType } from "@/components/ui";
import { addPayeeAction, deletePayeeAction } from "@/app/actions/banking";
import {
  COUNTRIES,
  COUNTRY_OPTIONS,
  PAYEE_TYPE_ICONS,
  PAYEE_TYPE_LABELS,
  WIRE_CURRENCIES,
  countryName,
  formatIban,
  formatPhone,
  ibanError,
  looksLikeIban,
  maskAccount,
  routingLabel,
  routingRequired,
  swiftCountry,
  validatePayee,
  type CleanPayee,
  type PayeeInput,
  type PayeeType,
} from "@/lib/payees";

type Toast = (msg: string, type?: ToastType) => void;

const TYPES: PayeeType[] = ["BILL", "ETRANSFER", "INTERNATIONAL"];

export function payeeSubtitle(p: PayeeView) {
  if (p.type === "BILL") return p.accountNumber ? `Account ${p.accountNumber}` : "";
  if (p.type === "ETRANSFER") return p.email ?? formatPhone(p.phone);
  return [p.bankName, p.swiftBic, maskAccount(p.accountNumber), p.currency].filter(Boolean).join(" · ");
}

export function AddPayeeForm({
  initialType = "BILL",
  lockType = false,
  toast,
  onSaved,
  onCancel,
}: {
  initialType?: PayeeType;
  lockType?: boolean;
  toast: Toast;
  onSaved: (payeeId: number, payee: CleanPayee) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<PayeeType>(initialType);
  const [busy, startSave] = useTransition();

  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [notifyBy, setNotifyBy] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [beneficiaryCity, setBeneficiaryCity] = useState("");
  const [beneficiaryCountry, setBeneficiaryCountry] = useState("");
  const [swiftBic, setSwiftBic] = useState("");
  const [bankName, setBankName] = useState("");
  const [routingCode, setRoutingCode] = useState("");
  const [currency, setCurrency] = useState("");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const bankCountry = swiftCountry(swiftBic);
  const bankKnown = bankCountry ? COUNTRIES[bankCountry] : undefined;
  const usesIban = Boolean(bankKnown?.[2]);
  const ibanCheck = accountNumber && (usesIban || looksLikeIban(accountNumber)) ? ibanError(accountNumber) : null;

  function onSwiftChange(v: string) {
    const next = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    setSwiftBic(next);
    const c = swiftCountry(next);
    if (c && COUNTRIES[c]) {
      if (!currencyTouched) setCurrency(COUNTRIES[c][1]);
      if (!beneficiaryCountry) setBeneficiaryCountry(c);
    }
  }

  function buildInput(): PayeeInput {
    if (type === "BILL") return { type, name, accountNumber };
    if (type === "ETRANSFER") return notifyBy === "email" ? { type, name, email } : { type, name, phone };
    return {
      type,
      name,
      beneficiaryAddress,
      beneficiaryCity,
      beneficiaryCountry,
      bankName,
      swiftBic,
      accountNumber,
      routingCode,
      currency,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = buildInput();
    const checked = validatePayee(input);
    if (!checked.ok) return toast(checked.error, "error");
    if (type === "INTERNATIONAL" && !confirmed) {
      return toast("Please confirm the beneficiary details are correct.", "error");
    }
    startSave(async () => {
      const res = await addPayeeAction(input);
      if (!res.ok) return toast(res.error, "error");
      toast(res.message, "success");
      onSaved(res.payeeId!, checked.payee);
    });
  }

  return (
    <form onSubmit={submit}>
      {lockType ? null : (
        <div className="form-group">
          <label>Payee type</label>
          <div className="segmented">
            {TYPES.map((t) => (
              <span key={t} style={{ display: "contents" }}>
                <input type="radio" id={`ptype-${t}`} checked={type === t} onChange={() => setType(t)} />
                <label htmlFor={`ptype-${t}`}>
                  <i className={`fas ${PAYEE_TYPE_ICONS[t]}`} /> {PAYEE_TYPE_LABELS[t]}
                </label>
              </span>
            ))}
          </div>
        </div>
      )}

      {type === "BILL" ? (
        <>
          <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
            <i className="fas fa-circle-info" /> Add a company you pay bills to, like a utility, phone or credit card.
          </p>
          <div className="form-group">
            <label>Payee name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rogers Wireless"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Your account / reference number with this payee</label>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="As shown on your bill" />
          </div>
        </>
      ) : null}

      {type === "ETRANSFER" ? (
        <>
          <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
            <i className="fas fa-circle-info" /> Send money to anyone with a Canadian bank account using their email or mobile
            number. Recipients registered for Autodeposit receive funds automatically.
          </p>
          <div className="form-group">
            <label>Contact name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Thompson" autoFocus />
          </div>
          <div className="form-group">
            <label>Send notifications by</label>
            <div className="segmented">
              <input type="radio" id="notify-email" checked={notifyBy === "email"} onChange={() => setNotifyBy("email")} />
              <label htmlFor="notify-email">
                <i className="fas fa-envelope" /> Email
              </label>
              <input type="radio" id="notify-phone" checked={notifyBy === "phone"} onChange={() => setNotifyBy("phone")} />
              <label htmlFor="notify-phone">
                <i className="fas fa-mobile-screen" /> Mobile
              </label>
            </div>
          </div>
          {notifyBy === "email" ? (
            <div className="form-group">
              <label>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.ca" />
            </div>
          ) : (
            <div className="form-group">
              <label>Mobile number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(306) 555-0123" />
              <div className="hint">Canadian mobile numbers only. Standard text messaging rates may apply.</div>
            </div>
          )}
        </>
      ) : null}

      {type === "INTERNATIONAL" ? (
        <>
          <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
            <i className="fas fa-circle-info" /> Add someone with a bank account outside Canada. Ask them for their bank&apos;s
            SWIFT / BIC code and their IBAN or account number, exactly as their bank shows it.
          </p>

          <div className="form-section-title">
            <i className="fas fa-user" /> Beneficiary
          </div>
          <div className="form-group">
            <label>Full name or company name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As it appears on their bank account" autoFocus />
          </div>
          <div className="form-group">
            <label>Street address</label>
            <input value={beneficiaryAddress} onChange={(e) => setBeneficiaryAddress(e.target.value)} placeholder="e.g. 221B Baker Street" />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>City</label>
              <input value={beneficiaryCity} onChange={(e) => setBeneficiaryCity(e.target.value)} placeholder="e.g. London" />
            </div>
            <div className="form-group">
              <label>Country</label>
              <select value={beneficiaryCountry} onChange={(e) => setBeneficiaryCountry(e.target.value)}>
                <option value="">Select…</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section-title">
            <i className="fas fa-building-columns" /> Beneficiary&apos;s bank
          </div>
          <div className="form-group">
            <label>SWIFT / BIC code</label>
            <input
              value={swiftBic}
              onChange={(e) => onSwiftChange(e.target.value)}
              placeholder="e.g. DEUTDEFF or NWBKGB2L"
              style={{ textTransform: "uppercase", letterSpacing: ".05em" }}
            />
            <div className="hint">
              {bankCountry ? (
                bankKnown ? (
                  <span className="ok-text">
                    <i className="fas fa-circle-check" /> Bank located in {bankKnown[0]}
                  </span>
                ) : (
                  <span className="err-text">We don&apos;t send wires to this country.</span>
                )
              ) : (
                "8 or 11 characters. Your beneficiary's bank can provide it."
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Bank name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Deutsche Bank AG" />
          </div>
          <div className="form-group">
            <label>{usesIban ? "IBAN" : bankKnown ? "Account number" : "IBAN or account number"}</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
              placeholder={usesIban ? `e.g. ${bankCountry}…` : "Account number"}
              style={{ letterSpacing: ".04em" }}
            />
            <div className="hint">
              {accountNumber && (usesIban || looksLikeIban(accountNumber)) ? (
                ibanCheck ? (
                  <span className="err-text">{ibanCheck}</span>
                ) : (
                  <span className="ok-text">
                    <i className="fas fa-circle-check" /> Valid IBAN · {formatIban(accountNumber)}
                  </span>
                )
              ) : usesIban ? (
                `${bankKnown![0]} uses IBANs (${bankKnown![2]} characters).`
              ) : null}
            </div>
          </div>
          {!usesIban ? (
            <div className="form-group">
              <label>
                {routingLabel(bankCountry)}
                {routingRequired(bankCountry) ? "" : " (optional)"}
              </label>
              <input value={routingCode} onChange={(e) => setRoutingCode(e.target.value)} />
            </div>
          ) : null}
          <div className="form-group">
            <label>Beneficiary receives</label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setCurrencyTouched(true);
              }}
            >
              <option value="">Select currency…</option>
              {WIRE_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm these details
            are correct. Wires sent to the wrong account may not be recoverable.
          </label>
        </>
      ) : null}

      <div className="modal-footer" style={{ marginTop: "1rem" }}>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn-primary" disabled={busy}>
          <i className={`fas ${busy ? "fa-spinner fa-spin" : "fa-check"}`} /> Save{" "}
          {type === "BILL" ? "payee" : type === "ETRANSFER" ? "contact" : "beneficiary"}
        </button>
      </div>
    </form>
  );
}

export function PayeesModal({
  payees,
  toast,
  onClose,
}: {
  payees: PayeeView[];
  toast: Toast;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PayeeType>("BILL");
  const [adding, setAdding] = useState(false);
  const [busy, startDelete] = useTransition();
  const list = payees.filter((p) => p.type === tab);

  function remove(p: PayeeView) {
    if (!window.confirm(`Remove ${p.name}?`)) return;
    startDelete(async () => {
      const res = await deletePayeeAction({ payeeId: p.id });
      toast(res.ok ? res.message : res.error, res.ok ? "success" : "error");
    });
  }

  return (
    <Modal title={adding ? "Add a payee" : "Payees & recipients"} icon={adding ? "fa-user-plus" : "fa-address-book"} onClose={onClose} wide>
      {adding ? (
        <AddPayeeForm
          initialType={tab}
          toast={toast}
          onCancel={() => setAdding(false)}
          onSaved={(_id, p) => {
            setTab(p.type);
            setAdding(false);
          }}
        />
      ) : (
        <>
          <div className="filter-bar">
            {TYPES.map((t) => (
              <button key={t} type="button" className={`filter-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                <i className={`fas ${PAYEE_TYPE_ICONS[t]}`} /> {PAYEE_TYPE_LABELS[t]} ({payees.filter((p) => p.type === t).length})
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <div className="no-trans">
              <i className={`fas ${PAYEE_TYPE_ICONS[tab]}`} style={{ fontSize: "1.8rem", opacity: 0.4 }} />
              <br />
              No {tab === "BILL" ? "bill payees" : tab === "ETRANSFER" ? "e-Transfer contacts" : "wire beneficiaries"} yet.
            </div>
          ) : (
            list.map((p) => (
              <div className="detail-row" key={p.id}>
                <span>
                  <strong style={{ color: "#003a47" }}>{p.name}</strong>
                  <br />
                  <small style={{ color: "#5c8a94", fontSize: ".74rem" }}>
                    {payeeSubtitle(p)}
                    {p.type === "INTERNATIONAL" && p.bankCountry ? ` · ${countryName(p.bankCountry)}` : ""}
                  </small>
                </span>
                <button type="button" className="link-btn danger" onClick={() => remove(p)} disabled={busy}>
                  <i className="fas fa-trash" /> Remove
                </button>
              </div>
            ))
          )}
          <div className="modal-footer" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
              <i className="fas fa-plus" /> Add payee
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
