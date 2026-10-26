"use client";

import { useState } from "react";
import {
  CONTACT_TIMES,
  DOWN_SOURCES,
  EMPLOYMENT,
  HORIZONS,
  KNOWLEDGE,
  MATURITY_INSTRUCTIONS,
  MORTGAGE_FREQUENCIES,
  PROPERTY_TYPES,
  RISK_LEVELS,
  RRIF_FREQUENCIES,
  RRIF_SUCCESSION,
  TAX_YEAR,
  minimumDownPayment,
  rrifMinimumPct,
  type ApplicationInput,
  type ProductKind,
  type ProductOption,
} from "@/lib/products";
import type { Prefill } from "./calculators";

export type AccountLite = { id: number; name: string; type: string; number: string; balance: number };

export type ApplyFormProps = {
  kind: ProductKind;
  options: ProductOption[];
  minAmount: number | null;
  age: number | null;
  accounts: AccountLite[];
  prefill: Prefill;
  fmt: (n: number) => string;
  onContinue: (input: ApplicationInput) => void;
  onCancel: () => void;
};

type Values = Record<string, string | boolean>;
type Change = React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

const NON_REGISTERED = ["CHEQUING", "SAVINGS", "OTHER"];
export const FUNDING_TYPES: Partial<Record<ProductKind, string[]>> = {
  TFSA_FUNDS: NON_REGISTERED,
  RRSP_GIC: NON_REGISTERED,
  RRIF: [...NON_REGISTERED, "RRSP"],
};

function useFields(init: Values) {
  const [v, setV] = useState<Values>(init);
  const set = (k: string, val: string | boolean) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: string) => ({ value: String(v[k] ?? ""), onChange: (e: Change) => set(k, e.target.value) });
  const check = (k: string) => ({
    checked: Boolean(v[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.checked),
  });
  return { v, set, text, check };
}

const n = (v: string | boolean | undefined) => {
  const x = parseFloat(String(v ?? "").replace(/[,$\s]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

function initial(prefill: Prefill, defaults: Values): Values {
  const out: Values = { ...defaults };
  if (prefill.option) out.option = prefill.option;
  if (prefill.amount !== undefined) out.amount = String(prefill.amount);
  for (const [k, val] of Object.entries(prefill.values ?? {})) out[k] = typeof val === "boolean" ? val : String(val);
  return out;
}

function Select({ map, ...rest }: { map: Record<string, string> } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest}>
      {Object.entries(map).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function OptionField({ options, field }: { options: ProductOption[]; field: { value: string; onChange: (e: Change) => void } }) {
  const chosen = options.find((o) => o.label === field.value);
  return (
    <div className="form-group">
      <label>Option</label>
      <select {...field}>
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label} — {o.rate}%
          </option>
        ))}
      </select>
      {chosen?.note ? <div className="hint">{chosen.note}</div> : null}
    </div>
  );
}

function AccountField({
  label,
  accounts,
  field,
  fmt,
  hint,
}: {
  label: string;
  accounts: AccountLite[];
  field: { value: string; onChange: (e: Change) => void };
  fmt: (n: number) => string;
  hint?: string;
}) {
  if (!accounts.length) {
    return (
      <div className="form-error">
        <i className="fas fa-circle-exclamation" /> You need an active chequing or savings account to do this.
      </div>
    );
  }
  return (
    <div className="form-group">
      <label>{label}</label>
      <select {...field}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ···{a.number.slice(-4)} ({fmt(a.balance)})
          </option>
        ))}
      </select>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

function AmountField({ label, field, hint }: { label: string; field: { value: string; onChange: (e: Change) => void }; hint?: string }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="amount-input">
        <input type="number" min="0" step="0.01" {...field} />
      </div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

function Actions({ onCancel, disabled }: { onCancel: () => void; disabled?: boolean }) {
  return (
    <div className="modal-footer">
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn-primary" disabled={disabled}>
        <i className="fas fa-arrow-right" /> Review application
      </button>
    </div>
  );
}

/* ============================== TFSA ============================== */

function TfsaForm({ options, minAmount, accounts, prefill, fmt, onContinue, onCancel }: ApplyFormProps) {
  const funding = accounts.filter((a) => FUNDING_TYPES.TFSA_FUNDS!.includes(a.type));
  const { v, text, check } = useFields(
    initial(prefill, {
      option: options[0]?.label ?? "",
      amount: String(minAmount ?? 500),
      sourceAccountId: String(funding[0]?.id ?? ""),
      monthlyContribution: "0",
      contributionDay: "15",
      risk: "MEDIUM",
      horizon: "LONG",
      knowledge: "GOOD",
      confirmEligible: false,
      confirmFundFacts: false,
    }),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue({
          kind: "TFSA_FUNDS",
          option: String(v.option),
          amount: n(v.amount),
          sourceAccountId: n(v.sourceAccountId),
          monthlyContribution: n(v.monthlyContribution),
          contributionDay: n(v.contributionDay),
          risk: v.risk as keyof typeof RISK_LEVELS,
          horizon: v.horizon as keyof typeof HORIZONS,
          knowledge: v.knowledge as keyof typeof KNOWLEDGE,
          confirmEligible: Boolean(v.confirmEligible),
          confirmFundFacts: Boolean(v.confirmFundFacts),
        });
      }}
    >
      <div className="form-section-title">
        <i className="fas fa-chart-pie" /> Your investment
      </div>
      <OptionField options={options} field={text("option")} />
      <div className="form-grid">
        <AmountField label="Initial investment" field={text("amount")} hint={minAmount ? `Minimum ${fmt(minAmount)}` : undefined} />
        <AccountField label="Fund from" accounts={funding} field={text("sourceAccountId")} fmt={fmt} />
        <AmountField label="Monthly contribution (optional)" field={text("monthlyContribution")} />
        <div className="form-group">
          <label>Contribution day</label>
          <input type="number" min={1} max={28} {...text("contributionDay")} disabled={n(v.monthlyContribution) <= 0} />
        </div>
      </div>
      <div className="form-section-title">
        <i className="fas fa-user-check" /> Investor profile (Know Your Client)
      </div>
      <div className="form-grid three">
        <div className="form-group">
          <label>Risk tolerance</label>
          <Select map={RISK_LEVELS} {...text("risk")} />
        </div>
        <div className="form-group">
          <label>Time horizon</label>
          <Select map={HORIZONS} {...text("horizon")} />
        </div>
        <div className="form-group">
          <label>Investment knowledge</label>
          <Select map={KNOWLEDGE} {...text("knowledge")} />
        </div>
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("confirmEligible")} />
        <span>I&apos;m a resident of Canada, 18 or older, with a valid SIN, and this contribution is within my TFSA room.</span>
      </label>
      <label className="check-row">
        <input type="checkbox" {...check("confirmFundFacts")} />
        <span>I have read the Fund Facts and understand mutual funds are not guaranteed and their values change.</span>
      </label>
      <Actions onCancel={onCancel} disabled={!funding.length} />
    </form>
  );
}

/* ============================== RRSP GIC ============================== */

function RrspForm({ options, minAmount, accounts, prefill, fmt, onContinue, onCancel }: ApplyFormProps) {
  const funding = accounts.filter((a) => FUNDING_TYPES.RRSP_GIC!.includes(a.type));
  const { v, text, check } = useFields(
    initial(prefill, {
      option: options.find((o) => /featured/i.test(o.note ?? ""))?.label ?? options[0]?.label ?? "",
      amount: String(minAmount ?? 500),
      sourceAccountId: String(funding[0]?.id ?? ""),
      earnedIncome: "",
      maturity: "RENEW",
      beneficiaryName: "",
      beneficiaryRelationship: "",
      confirmLimit: false,
    }),
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue({
          kind: "RRSP_GIC",
          option: String(v.option),
          amount: n(v.amount),
          sourceAccountId: n(v.sourceAccountId),
          earnedIncome: n(v.earnedIncome),
          maturity: v.maturity as keyof typeof MATURITY_INSTRUCTIONS,
          beneficiaryName: String(v.beneficiaryName),
          beneficiaryRelationship: String(v.beneficiaryRelationship),
          confirmLimit: Boolean(v.confirmLimit),
        });
      }}
    >
      <div className="form-section-title">
        <i className="fas fa-umbrella" /> Your GIC
      </div>
      <OptionField options={options} field={text("option")} />
      <div className="form-grid">
        <AmountField label="Contribution" field={text("amount")} hint={minAmount ? `Minimum ${fmt(minAmount)}` : undefined} />
        <AccountField label="Fund from" accounts={funding} field={text("sourceAccountId")} fmt={fmt} />
        <AmountField label={`${TAX_YEAR - 1} earned income (optional)`} field={text("earnedIncome")} hint="Helps us check your deduction limit." />
        <div className="form-group">
          <label>At maturity</label>
          <Select map={MATURITY_INSTRUCTIONS} {...text("maturity")} />
        </div>
      </div>
      <div className="form-section-title">
        <i className="fas fa-user-shield" /> Beneficiary (optional)
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Full name</label>
          <input {...text("beneficiaryName")} placeholder="e.g. Jane Doe" />
        </div>
        <div className="form-group">
          <label>Relationship</label>
          <input {...text("beneficiaryRelationship")} placeholder="e.g. Spouse" />
        </div>
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("confirmLimit")} />
        <span>
          This contribution is within my RRSP deduction limit, and I understand non-redeemable GICs can&apos;t be cashed before
          maturity.
        </span>
      </label>
      <Actions onCancel={onCancel} disabled={!funding.length} />
    </form>
  );
}

/* ============================== RRIF ============================== */

function RrifForm({ options, minAmount, age, accounts, prefill, fmt, onContinue, onCancel }: ApplyFormProps) {
  const funding = accounts.filter((a) => FUNDING_TYPES.RRIF!.includes(a.type));
  const deposit = accounts.filter((a) => NON_REGISTERED.includes(a.type));
  const rrsp = funding.find((a) => a.type === "RRSP");
  const { v, text, check } = useFields(
    initial(prefill, {
      option: options[0]?.label ?? "",
      amount: String(minAmount ?? 1000),
      sourceAccountId: String((rrsp ?? funding[0])?.id ?? ""),
      paymentType: "MINIMUM",
      fixedAnnual: "",
      frequency: "MONTHLY",
      depositAccountId: String(deposit[0]?.id ?? ""),
      useSpouseAge: false,
      spouseBirthYear: "",
      succession: "SUCCESSOR",
      beneficiaryName: "",
      confirmTerms: false,
    }),
  );
  const basisAge = v.useSpouseAge && n(v.spouseBirthYear) > 1900 ? TAX_YEAR - n(v.spouseBirthYear) : (age ?? 71);
  const minPct = rrifMinimumPct(basisAge + 1);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue({
          kind: "RRIF",
          option: String(v.option),
          amount: n(v.amount),
          sourceAccountId: n(v.sourceAccountId),
          paymentType: v.paymentType === "FIXED" ? "FIXED" : "MINIMUM",
          fixedAnnual: n(v.fixedAnnual),
          frequency: v.frequency as keyof typeof RRIF_FREQUENCIES,
          depositAccountId: n(v.depositAccountId),
          useSpouseAge: Boolean(v.useSpouseAge),
          spouseBirthYear: n(v.spouseBirthYear),
          succession: v.succession as keyof typeof RRIF_SUCCESSION,
          beneficiaryName: String(v.beneficiaryName),
          confirmTerms: Boolean(v.confirmTerms),
        });
      }}
    >
      <div className="form-section-title">
        <i className="fas fa-right-left" /> Transfer into your RRIF
      </div>
      <OptionField options={options} field={text("option")} />
      <div className="form-grid">
        <AmountField label="Amount to transfer" field={text("amount")} hint={minAmount ? `Minimum ${fmt(minAmount)}` : undefined} />
        <AccountField
          label="Transfer from"
          accounts={funding}
          field={text("sourceAccountId")}
          fmt={fmt}
          hint={rrsp ? "Transfers from your RRSP are tax-free." : "RRSP-to-RRIF transfers are tax-free."}
        />
      </div>
      <div className="form-section-title">
        <i className="fas fa-money-bill-wave" /> Your payments
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Payment amount</label>
          <select {...text("paymentType")}>
            <option value="MINIMUM">Government minimum</option>
            <option value="FIXED">Fixed annual amount</option>
          </select>
          <div className="hint">
            Next year&apos;s minimum: {minPct}% ≈ {fmt((n(v.amount) * minPct) / 100)}
          </div>
        </div>
        {v.paymentType === "FIXED" ? (
          <AmountField label="Annual amount" field={text("fixedAnnual")} />
        ) : (
          <div className="form-group">
            <label>Frequency</label>
            <Select map={Object.fromEntries(Object.entries(RRIF_FREQUENCIES).map(([k, x]) => [k, x.label]))} {...text("frequency")} />
          </div>
        )}
        {v.paymentType === "FIXED" ? (
          <div className="form-group">
            <label>Frequency</label>
            <Select map={Object.fromEntries(Object.entries(RRIF_FREQUENCIES).map(([k, x]) => [k, x.label]))} {...text("frequency")} />
          </div>
        ) : null}
        <AccountField label="Deposit payments to" accounts={deposit} field={text("depositAccountId")} fmt={fmt} />
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("useSpouseAge")} />
        <span>Base my minimum on my spouse&apos;s or common-law partner&apos;s age</span>
      </label>
      {v.useSpouseAge ? (
        <div className="form-group">
          <label>Spouse&apos;s birth year</label>
          <input type="number" min={1920} max={TAX_YEAR - 18} {...text("spouseBirthYear")} />
        </div>
      ) : null}
      <div className="form-section-title">
        <i className="fas fa-user-shield" /> On death
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Plan passes to</label>
          <Select map={RRIF_SUCCESSION} {...text("succession")} />
        </div>
        {v.succession !== "ESTATE" ? (
          <div className="form-group">
            <label>{v.succession === "SUCCESSOR" ? "Spouse's full name" : "Beneficiary's full name"}</label>
            <input {...text("beneficiaryName")} />
          </div>
        ) : null}
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("confirmTerms")} />
        <span>
          I understand I must withdraw at least the minimum each year starting next year, and tax is withheld on amounts above
          the minimum.
        </span>
      </label>
      <Actions onCancel={onCancel} disabled={!funding.length || !deposit.length} />
    </form>
  );
}

/* ============================== Mortgage ============================== */

function MortgageForm({ options, prefill, fmt, onContinue, onCancel }: ApplyFormProps) {
  const { v, text, check } = useFields(
    initial(prefill, {
      option: options[0]?.label ?? "",
      purchasePrice: "550000",
      downPayment: "55000",
      downPaymentSource: "SAVINGS",
      amortYears: "25",
      frequency: "MONTHLY",
      firstTimeBuyer: false,
      propertyType: "DETACHED",
      propertyCity: "",
      employment: "FULL_TIME",
      employer: "",
      yearsEmployed: "",
      annualIncome: "",
      monthlyDebts: "0",
      propertyTaxYearly: "",
      heatingMonthly: "100",
      condoFeesMonthly: "0",
      consentCredit: false,
    }),
  );
  const minDown = minimumDownPayment(n(v.purchasePrice));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue({
          kind: "MORTGAGE",
          option: String(v.option),
          purchasePrice: n(v.purchasePrice),
          downPayment: n(v.downPayment),
          downPaymentSource: v.downPaymentSource as keyof typeof DOWN_SOURCES,
          amortYears: n(v.amortYears),
          frequency: v.frequency as keyof typeof MORTGAGE_FREQUENCIES,
          firstTimeBuyer: Boolean(v.firstTimeBuyer),
          propertyType: v.propertyType as keyof typeof PROPERTY_TYPES,
          propertyCity: String(v.propertyCity),
          employment: v.employment as keyof typeof EMPLOYMENT,
          employer: String(v.employer),
          yearsEmployed: n(v.yearsEmployed),
          annualIncome: n(v.annualIncome),
          monthlyDebts: n(v.monthlyDebts),
          propertyTaxYearly: n(v.propertyTaxYearly),
          heatingMonthly: n(v.heatingMonthly),
          condoFeesMonthly: n(v.condoFeesMonthly),
          consentCredit: Boolean(v.consentCredit),
        });
      }}
    >
      <div className="form-section-title">
        <i className="fas fa-house" /> The home
      </div>
      <OptionField options={options} field={text("option")} />
      <div className="form-grid">
        <AmountField label="Purchase price" field={text("purchasePrice")} />
        <AmountField label="Down payment" field={text("downPayment")} hint={`Minimum ${fmt(minDown)}`} />
        <div className="form-group">
          <label>Down payment comes from</label>
          <Select map={DOWN_SOURCES} {...text("downPaymentSource")} />
        </div>
        <div className="form-group">
          <label>Amortization</label>
          <select {...text("amortYears")}>
            {[15, 20, 25, 30].map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Payment frequency</label>
          <Select map={Object.fromEntries(Object.entries(MORTGAGE_FREQUENCIES).map(([k, x]) => [k, x.label]))} {...text("frequency")} />
        </div>
        <div className="form-group">
          <label>Property type</label>
          <Select map={PROPERTY_TYPES} {...text("propertyType")} />
        </div>
        <div className="form-group span-2">
          <label>City</label>
          <input {...text("propertyCity")} placeholder="e.g. Saskatoon, SK" />
        </div>
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("firstTimeBuyer")} />
        <span>I&apos;m a first-time home buyer</span>
      </label>
      <div className="form-section-title">
        <i className="fas fa-briefcase" /> Income &amp; employment
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Employment</label>
          <Select map={EMPLOYMENT} {...text("employment")} />
        </div>
        <div className="form-group">
          <label>Employer</label>
          <input {...text("employer")} />
        </div>
        <div className="form-group">
          <label>Years with employer</label>
          <input type="number" min={0} step={0.5} {...text("yearsEmployed")} />
        </div>
        <AmountField label="Gross household income / yr" field={text("annualIncome")} />
      </div>
      <div className="form-section-title">
        <i className="fas fa-file-invoice-dollar" /> Monthly costs
      </div>
      <div className="form-grid">
        <AmountField label="Other debt payments / mo" field={text("monthlyDebts")} hint="Car, student loans, credit cards (3% of balance)" />
        <AmountField label="Property tax / yr" field={text("propertyTaxYearly")} />
        <AmountField label="Heating / mo" field={text("heatingMonthly")} />
        {v.propertyType === "CONDO" ? <AmountField label="Condo fees / mo" field={text("condoFeesMonthly")} /> : null}
      </div>
      <label className="check-row">
        <input type="checkbox" {...check("consentCredit")} />
        <span>I consent to a credit check with Equifax and TransUnion for this pre-approval.</span>
      </label>
      <Actions onCancel={onCancel} />
    </form>
  );
}

/* ============================== General ============================== */

function GeneralForm({ onContinue, onCancel }: ApplyFormProps) {
  const { v, text } = useFields({ contactTime: "MORNING", phone: "", message: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onContinue({
          kind: "GENERAL",
          contactTime: v.contactTime as keyof typeof CONTACT_TIMES,
          phone: String(v.phone),
          message: String(v.message),
        });
      }}
    >
      <div className="form-grid">
        <div className="form-group">
          <label>Best time to call</label>
          <Select map={CONTACT_TIMES} {...text("contactTime")} />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" {...text("phone")} />
        </div>
      </div>
      <div className="form-group">
        <label>How can we help? (optional)</label>
        <textarea {...text("message")} />
      </div>
      <Actions onCancel={onCancel} />
    </form>
  );
}

export const APPLY_FORMS: Record<ProductKind, (p: ApplyFormProps) => React.ReactNode> = {
  TFSA_FUNDS: TfsaForm,
  RRSP_GIC: RrspForm,
  RRIF: RrifForm,
  MORTGAGE: MortgageForm,
  GENERAL: GeneralForm,
};
