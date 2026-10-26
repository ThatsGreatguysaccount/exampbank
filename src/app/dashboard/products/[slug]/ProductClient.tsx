"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Modal, useToast } from "@/components/ui";
import { money, type FormatConfig } from "@/lib/format";
import {
  detailRows,
  termLabel,
  validateApplication,
  type ApplicationInput,
  type CleanApplication,
  type ProductKind,
  type ProductOption,
} from "@/lib/products";
import { applyForProductAction, cancelApplicationAction } from "@/app/actions/products";
import { PRODUCT_CONTENT } from "../content";
import { CALCULATORS, type Prefill } from "../calculators";
import { APPLY_FORMS, type AccountLite } from "../apply-forms";
import { AppStatusBadge, featuredOption, pct, type AppStatus } from "../shared";

export type ApplicationView = {
  id: number;
  reference: string;
  status: AppStatus;
  optionLabel: string | null;
  rate: number | null;
  amount: number | null;
  approvedAmount: number | null;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string | null;
  openedAccount: string | null;
  rows: { key: string; label: string; value: string }[];
};

type ProductData = {
  id: number;
  kind: ProductKind;
  title: string;
  icon: string;
  description: string;
  summary: string | null;
  minAmount: number | null;
  options: ProductOption[];
};

type Step =
  | { step: "form"; prefill: Prefill }
  | { step: "review"; prefill: Prefill; input: ApplicationInput; app: CleanApplication; warnings: string[] }
  | { step: "done"; reference: string; message: string };

const HERO_FACTS: Record<ProductKind, (p: ProductData, fmt: (n: number) => string) => [string, string][]> = {
  TFSA_FUNDS: (p, fmt) => [
    ["Tax on growth", "$0"],
    ["Minimum to start", p.minAmount ? fmt(p.minAmount) : "None"],
    ["Portfolios", String(p.options.length)],
  ],
  RRSP_GIC: (p, fmt) => [
    ["Principal", "100% guaranteed"],
    ["Terms", `${Math.min(...p.options.map((o) => o.months ?? 12)) / 12}–${Math.max(...p.options.map((o) => o.months ?? 12)) / 12} years`],
    ["Minimum", p.minAmount ? fmt(p.minAmount) : "None"],
  ],
  RRIF: (p, fmt) => [
    ["Withholding on minimum", "None"],
    ["Payment schedules", "4 options"],
    ["Minimum transfer", p.minAmount ? fmt(p.minAmount) : "None"],
  ],
  MORTGAGE: () => [
    ["Rate hold", "120 days"],
    ["Annual prepayment", "Up to 20%"],
    ["Decision", "1 business day"],
  ],
  GENERAL: () => [],
};

export function ProductClient({
  settings,
  product,
  accounts,
  applications,
  profile,
}: {
  settings: FormatConfig;
  product: ProductData;
  accounts: AccountLite[];
  applications: ApplicationView[];
  profile: { firstName: string; age: number | null; birthYear: number | null };
}) {
  const fmt = (v: number) => money(v, settings);
  const dateFmt = (iso: string) =>
    new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium", timeZone: settings.timezone }).format(new Date(iso));
  const { showToast, toastNode } = useToast();
  const [flow, setFlow] = useState<Step | null>(null);
  const [pending, startTransition] = useTransition();
  const content = PRODUCT_CONTENT[product.kind];
  const top = featuredOption(product.options);
  const Calculator = product.kind in CALCULATORS ? CALCULATORS[product.kind as keyof typeof CALCULATORS] : null;
  const Form = APPLY_FORMS[product.kind];
  const showTerm = product.options.some((o) => o.months);
  const ctx = { options: product.options, minAmount: product.minAmount, age: profile.age, birthYear: profile.birthYear };
  const openApps = applications.filter((a) => a.status === "PENDING").length;

  const startApply = (prefill: Prefill = {}) => setFlow({ step: "form", prefill });

  function review(prefill: Prefill, input: ApplicationInput) {
    const res = validateApplication(input, ctx);
    if (!res.ok) return showToast(res.error, "error");
    setFlow({ step: "review", prefill, input, app: res.app, warnings: res.warnings });
  }

  function submit(input: ApplicationInput) {
    startTransition(async () => {
      try {
        const res = await applyForProductAction(product.id, input);
        if (!res.ok) return showToast(res.error, "error");
        setFlow({ step: "done", reference: res.reference ?? "", message: res.message });
      } catch {
        showToast("Something went wrong. Please try again.", "error");
      }
    });
  }

  function cancel(a: ApplicationView) {
    if (!window.confirm(`Cancel application ${a.reference}? Any held funds will be returned to your account.`)) return;
    startTransition(async () => {
      const res = await cancelApplicationAction(a.id);
      showToast(res.ok ? res.message : res.error, res.ok ? "success" : "error");
    });
  }

  return (
    <>
      <nav className="crumbs">
        <Link href="/dashboard">Accounts</Link> <i className="fas fa-chevron-right" />{" "}
        <Link href="/dashboard/products">Invest &amp; borrow</Link> <i className="fas fa-chevron-right" /> <span>{product.title}</span>
      </nav>

      <section className="product-hero">
        <div>
          <span className="eyebrow">
            <i className={`fas ${product.icon}`} /> {content.eyebrow}
          </span>
          <h2>{product.title}</h2>
          <p>{product.summary ?? product.description}</p>
          <div className="hero-actions">
            <button type="button" className="btn-primary inline" onClick={() => startApply(top ? { option: top.label } : {})}>
              <i className="fas fa-file-signature" /> {content.applyLabel}
            </button>
            {Calculator ? (
              <a href="#calculator" className="btn-secondary">
                <i className="fas fa-calculator" /> Calculate
              </a>
            ) : null}
          </div>
        </div>
        <div className="hero-rate">
          {top ? (
            <>
              <span>{top.label}</span>
              <strong>{pct(top.rate)}</strong>
              <small>{content.rateColumn}</small>
            </>
          ) : null}
          <div className="hero-facts stacked">
            {HERO_FACTS[product.kind](product, fmt).map(([k, v]) => (
              <div key={k}>
                <strong>{v}</strong>
                <span>{k}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="section-nav">
        <a href="#rates">Rates</a>
        {Calculator ? <a href="#calculator">Calculator</a> : null}
        <a href="#how">How it works</a>
        <a href="#applications">
          My applications{openApps ? <span className="count">{openApps}</span> : null}
        </a>
        {content.faqs.length ? <a href="#faq">FAQs</a> : null}
      </nav>

      <div className="feature-grid">
        {content.features.map((f) => (
          <div key={f.title} className="feature">
            <i className={`fas ${f.icon}`} />
            <h4>{f.title}</h4>
            <p>{f.text}</p>
          </div>
        ))}
      </div>

      {product.options.length ? (
        <section id="rates" className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-percent" /> {content.rateHeading}
            </span>
            <span className="muted">Rates effective {dateFmt(new Date().toISOString())}</span>
          </div>
          <div className="table-wrap">
            <table className="data rates">
              <thead>
                <tr>
                  <th>Option</th>
                  {showTerm ? <th>Term</th> : null}
                  <th className="num">{content.rateColumn}</th>
                  <th>Details</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {product.options.map((o) => (
                  <tr key={o.label} className={o === top ? "featured" : undefined}>
                    <td>
                      <strong>{o.label}</strong>
                      {o === top ? <span className="badge badge-blue" style={{ marginLeft: ".5rem" }}>Featured</span> : null}
                    </td>
                    {showTerm ? <td>{o.months ? termLabel(o.months) : "Open"}</td> : null}
                    <td className="num rate-cell">{pct(o.rate)}</td>
                    <td className="muted">{o.note ?? ""}</td>
                    <td className="num">
                      <button type="button" className="link-btn" onClick={() => startApply({ option: o.label })}>
                        Choose <i className="fas fa-arrow-right" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {Calculator ? (
        <section id="calculator" className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-calculator" />{" "}
              {product.kind === "MORTGAGE" ? "Mortgage payment & affordability calculator" : product.kind === "RRIF" ? "RRIF income calculator" : product.kind === "RRSP_GIC" ? "GIC & tax refund calculator" : "TFSA growth calculator"}
            </span>
          </div>
          <Calculator
            options={product.options}
            defaultOption={top?.label ?? ""}
            fmt={fmt}
            age={profile.age}
            birthYear={profile.birthYear}
            minAmount={product.minAmount}
            onApply={startApply}
          />
        </section>
      ) : null}

      <section id="how" className="panel">
        <div className="panel-title">
          <span>
            <i className="fas fa-list-ol" /> How it works
          </span>
        </div>
        <ol className="how-steps">
          {content.steps.map((s) => (
            <li key={s.title}>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="applications" className="panel">
        <div className="panel-title">
          <span>
            <i className="fas fa-file-signature" /> My applications
          </span>
          <button type="button" className="link-btn" onClick={() => startApply(top ? { option: top.label } : {})}>
            <i className="fas fa-plus" /> New application
          </button>
        </div>
        {applications.length === 0 ? (
          <div className="empty">No applications yet.</div>
        ) : (
          <div className="app-list">
            {applications.map((a) => (
              <details key={a.id} className="app-card" open={a.status === "PENDING" || a === applications[0]}>
                <summary>
                  <div>
                    <strong>{a.optionLabel ?? product.title}</strong>
                    <span className="muted">
                      {a.reference} · submitted {dateFmt(a.createdAt)}
                      {a.rate !== null ? ` · ${pct(a.rate)}` : ""}
                    </span>
                  </div>
                  <div className="app-card-right">
                    {a.amount !== null ? <strong>{fmt(a.approvedAmount ?? a.amount)}</strong> : null}
                    <AppStatusBadge status={a.status} kind={product.kind} />
                  </div>
                </summary>
                <AppOutcome a={a} kind={product.kind} fmt={fmt} dateFmt={dateFmt} />
                <div className="app-rows">
                  {a.rows.map((r) => (
                    <div key={r.key} className="detail-row">
                      <span>{r.label}</span>
                      <strong>{r.value}</strong>
                    </div>
                  ))}
                </div>
                {a.status === "PENDING" ? (
                  <button type="button" className="link-btn danger" disabled={pending} onClick={() => cancel(a)}>
                    <i className="fas fa-xmark" /> Cancel application
                  </button>
                ) : null}
              </details>
            ))}
          </div>
        )}
      </section>

      {content.faqs.length ? (
        <section id="faq" className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-circle-question" /> Frequently asked questions
            </span>
          </div>
          <div className="faq">
            {content.faqs.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q} <i className="fas fa-chevron-down" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <div className="legal">
        {content.legal.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>

      {toastNode}

      {flow ? (
        <Modal
          wide
          title={flow.step === "done" ? "Application received" : content.applyLabel}
          icon={flow.step === "done" ? "fa-circle-check" : product.icon}
          onClose={() => setFlow(null)}
        >
          <div className="stepper">
            {["Details", "Review", "Submitted"].map((s, i) => {
              const at = flow.step === "form" ? 0 : flow.step === "review" ? 1 : 2;
              return (
                <div key={s} className={`step ${i < at ? "done" : i === at ? "current" : ""}`}>
                  <div className="step-bar" />
                  {s}
                </div>
              );
            })}
          </div>

          {flow.step === "form" ? (
            <Form
              kind={product.kind}
              options={product.options}
              minAmount={product.minAmount}
              age={profile.age}
              accounts={accounts}
              prefill={flow.prefill}
              fmt={fmt}
              onCancel={() => setFlow(null)}
              onContinue={(input) => review(flow.prefill, input)}
            />
          ) : null}

          {flow.step === "review" ? (
            <ReviewStep
              flow={flow}
              accounts={accounts}
              fmt={fmt}
              pending={pending}
              onBack={() => setFlow({ step: "form", prefill: prefillFrom(flow.input) })}
              onSubmit={() => submit(flow.input)}
            />
          ) : null}

          {flow.step === "done" ? (
            <div className="status-hero">
              <div className="status-icon">
                <i className="fas fa-check" />
              </div>
              <h2>Thank you, {profile.firstName}</h2>
              <p>{flow.message}</p>
              <p style={{ marginTop: ".75rem" }}>
                Your reference number is <strong>{flow.reference}</strong>. You can follow its status below under
                &ldquo;My applications&rdquo;.
              </p>
              <div className="modal-footer">
                <Link href="/dashboard" className="btn-secondary">
                  Back to accounts
                </Link>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setFlow(null);
                    document.getElementById("applications")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <i className="fas fa-list-check" /> View my application
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

/** Keeps what the customer typed when they go back from the review step. */
function prefillFrom(input: ApplicationInput): Prefill {
  const { kind: _kind, ...rest } = input as ApplicationInput & Record<string, unknown>;
  void _kind;
  const values: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") values[k] = v;
  }
  return { values };
}

function ReviewStep({
  flow,
  accounts,
  fmt,
  pending,
  onBack,
  onSubmit,
}: {
  flow: Extract<Step, { step: "review" }>;
  accounts: AccountLite[];
  fmt: (n: number) => string;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { app, input, warnings } = flow;
  const source = accounts.find((a) => a.id === app.sourceAccountId);
  const deposit = input.kind === "RRIF" ? accounts.find((a) => a.id === input.depositAccountId) : undefined;
  const rows = detailRows(app.details, fmt);
  const funded = Boolean(source && app.amount);
  return (
    <>
      <div className="review-summary">
        {app.optionLabel ? (
          <div>
            <span>Option</span>
            <strong>{app.optionLabel}</strong>
          </div>
        ) : null}
        {app.rate !== null ? (
          <div>
            <span>Rate</span>
            <strong>{pct(app.rate)}</strong>
          </div>
        ) : null}
        {app.termMonths ? (
          <div>
            <span>Term</span>
            <strong>{termLabel(app.termMonths)}</strong>
          </div>
        ) : null}
        {app.amount !== null ? (
          <div>
            <span>{input.kind === "MORTGAGE" ? "Mortgage amount" : "Amount"}</span>
            <strong>{fmt(app.amount)}</strong>
          </div>
        ) : null}
      </div>
      <div className="doc-list" style={{ marginTop: "1rem" }}>
        {source ? (
          <div className="detail-row">
            <span>Funded from</span>
            <strong>
              {source.name} ···{source.number.slice(-4)}
            </strong>
          </div>
        ) : null}
        {deposit ? (
          <div className="detail-row">
            <span>Payments deposited to</span>
            <strong>
              {deposit.name} ···{deposit.number.slice(-4)}
            </strong>
          </div>
        ) : null}
        {rows.map((r) => (
          <div key={r.key} className="detail-row">
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
        ))}
      </div>
      {warnings.length ? (
        <div className="info-card warn" style={{ marginTop: "1rem" }}>
          <i className="fas fa-circle-info" />
          <div>
            A specialist will go over the following with you before this is finalized:
            <ul>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <p className="modal-note">
        {funded
          ? `${fmt(app.amount ?? 0)} will be held in ${source?.name} while we review your application. If it isn't approved, or you cancel, the funds are returned immediately.`
          : input.kind === "MORTGAGE"
            ? "Submitting authorizes us to obtain your credit report. A pre-approval is not a final mortgage commitment."
            : "We'll contact you using the details above."}
      </p>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={pending}>
          <i className="fas fa-arrow-left" /> Edit
        </button>
        <button type="button" className="btn-primary" onClick={onSubmit} disabled={pending}>
          <i className={`fas ${pending ? "fa-spinner fa-spin" : "fa-paper-plane"}`} /> Submit application
        </button>
      </div>
    </>
  );
}

function AppOutcome({
  a,
  kind,
  fmt,
  dateFmt,
}: {
  a: ApplicationView;
  kind: ProductKind;
  fmt: (n: number) => string;
  dateFmt: (iso: string) => string;
}) {
  if (a.status === "PENDING") {
    return (
      <div className="info-card">
        <i className="fas fa-hourglass-half" />
        <div>
          {kind === "MORTGAGE"
            ? "A mortgage specialist is reviewing your request. Expect a decision within 1 business day."
            : a.amount !== null && kind !== "GENERAL"
              ? `${fmt(a.amount)} is on hold while an advisor reviews your application.`
              : "We've received your request and will be in touch soon."}
        </div>
      </div>
    );
  }
  if (a.status === "APPROVED") {
    const held = a.rows.find((r) => r.key === "rateHeldUntil")?.value;
    return (
      <div className="info-card good">
        <i className="fas fa-circle-check" />
        <div>
          {kind === "MORTGAGE" ? (
            <>
              You&apos;re pre-approved for up to <strong>{fmt(a.approvedAmount ?? a.amount ?? 0)}</strong>
              {a.rate !== null ? ` at ${pct(a.rate)}` : ""}.{held ? ` Your rate is held until ${held}.` : ""}
            </>
          ) : a.openedAccount ? (
            <>
              Approved {a.reviewedAt ? dateFmt(a.reviewedAt) : ""} — your new <strong>{a.openedAccount}</strong> account is open
              and showing on your <Link href="/dashboard">dashboard</Link>.
            </>
          ) : (
            <>Approved {a.reviewedAt ? dateFmt(a.reviewedAt) : ""}.</>
          )}
          {a.adminNote ? <div className="muted">Note from your advisor: {a.adminNote}</div> : null}
        </div>
      </div>
    );
  }
  if (a.status === "DECLINED") {
    return (
      <div className="info-card bad">
        <i className="fas fa-circle-xmark" />
        <div>
          We weren&apos;t able to approve this application{a.adminNote ? `: ${a.adminNote}` : "."} Any held funds have been
          returned to your account.
        </div>
      </div>
    );
  }
  return (
    <div className="info-card">
      <i className="fas fa-ban" />
      <div>You cancelled this application. Any held funds were returned.</div>
    </div>
  );
}
