import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fullDate, money } from "@/lib/format";
import { PRODUCT_KIND_LABELS, ageOn, detailRows, termLabel } from "@/lib/products";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { reviewApplicationAction } from "@/app/actions/admin";
import { AppStatusBadge } from "@/app/dashboard/products/shared";
import { KycBadge, TxStatusBadge, fullName } from "../../shared";

const OPENS: Record<string, string> = {
  TFSA_FUNDS: "a TFSA account",
  RRSP_GIC: "an RRSP GIC account",
  RRIF: "a RRIF account",
};

export default async function ApplicationDetailPage({ params }: PageProps<"/admin/applications/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId) || appId <= 0) notFound();
  const app = await prisma.productApplication.findUnique({
    where: { id: appId },
    include: { user: { include: { accounts: { where: { status: { not: "CLOSED" } }, orderBy: { createdAt: "asc" } } } }, product: true },
  });
  if (!app) notFound();
  const settings = await getSettings();
  const fmt = (v: number) => money(v, settings);
  const [hold, opened] = await Promise.all([
    app.holdTransactionId ? prisma.transaction.findUnique({ where: { id: app.holdTransactionId }, include: { account: true } }) : null,
    app.openedAccountId ? prisma.account.findUnique({ where: { id: app.openedAccountId } }) : null,
  ]);

  const details = (app.details ?? {}) as Record<string, unknown>;
  const warnings = Array.isArray(details.warnings) ? (details.warnings as string[]) : [];
  const rows = detailRows(details, fmt).filter((r) => r.key !== "warnings");
  const age = ageOn(app.user.dateOfBirth);
  const total = app.user.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const isPending = app.status === "PENDING";

  return (
    <>
      <div className="admin-header">
        <div>
          <Link href="/admin/applications" className="back">
            <i className="fas fa-arrow-left" /> All applications
          </Link>
          <h1>
            <i className={`fas ${app.product.icon}`} /> {app.product.title} <AppStatusBadge status={app.status} kind={app.kind} />
          </h1>
          <p>
            {app.reference} · {PRODUCT_KIND_LABELS[app.kind]} · submitted {fullDate(app.createdAt.toISOString(), settings)}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label">
            <i className="fas fa-tag" /> Option
          </div>
          <div className="value" style={{ fontSize: "1.1rem" }}>
            {app.optionLabel ?? "—"}
          </div>
        </div>
        <div className="stat">
          <div className="label">
            <i className="fas fa-percent" /> Rate
          </div>
          <div className="value">{app.rate !== null ? `${Number(app.rate)}%` : "—"}</div>
        </div>
        <div className="stat">
          <div className="label">
            <i className="fas fa-hourglass" /> Term
          </div>
          <div className="value">{app.termMonths ? termLabel(app.termMonths) : "—"}</div>
        </div>
        <div className="stat">
          <div className="label">
            <i className="fas fa-dollar-sign" /> {app.kind === "MORTGAGE" ? "Mortgage requested" : "Amount"}
          </div>
          <div className="value">{app.amount !== null ? fmt(Number(app.amount)) : "—"}</div>
        </div>
      </div>

      <div className="two-col-wide">
        <div>
          {warnings.length ? (
            <div className="info-card warn">
              <i className="fas fa-flag" />
              <div>
                <strong>Reviewer flags</strong>
                <ul>
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-list" /> Application details
              </span>
            </div>
            {rows.map((r) => (
              <div key={r.key} className="detail-row">
                <span>{r.label}</span>
                <strong>{r.value}</strong>
              </div>
            ))}
          </div>

          {hold ? (
            <div className="panel">
              <div className="panel-title">
                <span>
                  <i className="fas fa-lock" /> Held funds
                </span>
                <TxStatusBadge status={hold.status} />
              </div>
              <div className="detail-row">
                <span>From account</span>
                <strong>
                  {hold.account.name} · {hold.account.number}
                </strong>
              </div>
              <div className="detail-row">
                <span>Amount</span>
                <strong className="debit">{fmt(Number(hold.amount))}</strong>
              </div>
              <div className="detail-row">
                <span>Transaction reference</span>
                <strong>{hold.reference}</strong>
              </div>
            </div>
          ) : null}

          {!isPending ? (
            <div className="panel">
              <div className="panel-title">
                <span>
                  <i className="fas fa-gavel" /> Decision
                </span>
              </div>
              <div className="detail-row">
                <span>Reviewed</span>
                <strong>{app.reviewedAt ? fullDate(app.reviewedAt.toISOString(), settings) : "—"}</strong>
              </div>
              {app.approvedAmount !== null ? (
                <div className="detail-row">
                  <span>Approved amount</span>
                  <strong>{fmt(Number(app.approvedAmount))}</strong>
                </div>
              ) : null}
              {opened ? (
                <div className="detail-row">
                  <span>Account opened</span>
                  <strong>
                    {opened.name} · {opened.number}
                  </strong>
                </div>
              ) : null}
              <div className="detail-row">
                <span>Note to customer</span>
                <strong>{app.adminNote ?? "—"}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {isPending ? (
            <div className="panel">
              <div className="panel-title">
                <span>
                  <i className="fas fa-gavel" /> Review
                </span>
              </div>
              <ActionForm action={reviewApplicationAction} resetOnSuccess={false}>
                <input type="hidden" name="applicationId" value={app.id} />
                {app.kind === "MORTGAGE" ? (
                  <div className="form-group">
                    <label>Approved mortgage amount</label>
                    <div className="amount-input">
                      <input name="approvedAmount" type="number" step="0.01" min="0" defaultValue={Number(app.amount ?? 0).toFixed(2)} />
                    </div>
                    <div className="hint">Rate is held for 120 days from approval.</div>
                  </div>
                ) : null}
                <div className="form-group">
                  <label>Note to customer</label>
                  <textarea name="note" placeholder="Required when declining" />
                </div>
                <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
                  {OPENS[app.kind]
                    ? `Approving opens ${OPENS[app.kind]} funded with the held ${fmt(Number(app.amount ?? 0))}. Declining returns the funds.`
                    : app.kind === "MORTGAGE"
                      ? "Approving issues a pre-approval certificate and holds the rate."
                      : "Approving marks the request as contacted."}
                </p>
                <div className="modal-footer" style={{ marginTop: 0 }}>
                  <SubmitButton name="decision" value="DECLINE" className="btn-secondary" icon="fa-xmark" pendingText="…">
                    Decline
                  </SubmitButton>
                  <SubmitButton name="decision" value="APPROVE" icon="fa-check" pendingText="Saving…">
                    Approve
                  </SubmitButton>
                </div>
              </ActionForm>
            </div>
          ) : null}

          <div className="panel">
            <div className="panel-title">
              <span>
                <i className="fas fa-user" /> Customer
              </span>
              <KycBadge status={app.user.kycStatus} />
            </div>
            <div className="detail-row">
              <span>Name</span>
              <strong>
                <Link href={`/admin/customers/${app.userId}`}>{fullName(app.user)}</Link>
              </strong>
            </div>
            <div className="detail-row">
              <span>Email</span>
              <strong>{app.user.email}</strong>
            </div>
            <div className="detail-row">
              <span>Age</span>
              <strong>{age ?? "—"}</strong>
            </div>
            <div className="detail-row">
              <span>Province</span>
              <strong>{app.user.province ?? "—"}</strong>
            </div>
            <div className="detail-row">
              <span>Total balances</span>
              <strong>{fmt(total)}</strong>
            </div>
            {app.user.accounts.map((a) => (
              <div key={a.id} className="detail-row">
                <span className="muted">{a.name}</span>
                <span>{fmt(Number(a.balance))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
