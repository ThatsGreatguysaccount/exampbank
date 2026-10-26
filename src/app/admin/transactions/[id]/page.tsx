import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fullDate, money, toZonedInput } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteTransactionAction, reviewTransactionAction } from "@/app/actions/admin";
import { KIND_LABELS, TxStatusBadge, fullName } from "../../shared";
import { TransactionForm } from "../../TransactionForm";

export default async function TransactionDetail(props: PageProps<"/admin/transactions/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const t = await prisma.transaction.findUnique({
    where: { id: Number(id) || 0 },
    include: { account: { include: { user: true } } },
  });
  if (!t) notFound();
  const [settings, accounts] = await Promise.all([
    getSettings(),
    prisma.account.findMany({
      where: { userId: t.account.userId, OR: [{ status: { not: "CLOSED" } }, { id: t.accountId }] },
      orderBy: { id: "asc" },
    }),
  ]);
  const meta = (t.meta ?? {}) as Record<string, string>;
  const amount = Number(t.amount);

  return (
    <>
      <div className="admin-header">
        <div>
          <Link href={`/admin/customers/${t.account.userId}`} className="back">
            <i className="fas fa-arrow-left" /> {fullName(t.account.user)}
          </Link>
          <h1>
            <i className={`fas ${t.icon}`} /> {t.title} <TxStatusBadge status={t.status} />
          </h1>
          <p>
            {t.reference} · {KIND_LABELS[t.kind]} · {t.account.name} ({t.account.number})
          </p>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-receipt" /> Details
            </span>
          </div>
          <div className="modal-body">
            <div className="detail-row">
              <span>Amount</span>
              <strong className={amount > 0 ? "credit" : "debit"}>
                {amount > 0 ? "+" : ""}
                {money(amount, settings)}
              </strong>
            </div>
            <div className="detail-row">
              <span>Posted</span>
              <strong>{fullDate(t.postedAt.toISOString(), settings)}</strong>
            </div>
            <div className="detail-row">
              <span>Created</span>
              <strong>{fullDate(t.createdAt.toISOString(), settings)}</strong>
            </div>
            {Object.entries(meta)
              .filter(([k, v]) => v && k !== "counterpartyAccountId")
              .map(([k, v]) => (
                <div className="detail-row" key={k}>
                  <span>{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
                  <strong>{String(v)}</strong>
                </div>
              ))}
            {t.reviewedAt ? (
              <div className="detail-row">
                <span>Reviewed</span>
                <strong>
                  {fullDate(t.reviewedAt.toISOString(), settings)}
                  {t.reviewNote ? ` · ${t.reviewNote}` : ""}
                </strong>
              </div>
            ) : null}
          </div>

          {t.status === "PENDING" ? (
            <ActionForm action={reviewTransactionAction} style={{ marginTop: "1.25rem" }}>
              <input type="hidden" name="transactionId" value={t.id} />
              <div className="form-group">
                <label>Note to customer (optional)</label>
                <input name="note" placeholder="e.g. Cheque could not be verified" />
              </div>
              <div className="toolbar">
                <SubmitButton className="btn-primary inline" name="decision" value="APPROVE" icon="fa-check">
                  Approve
                </SubmitButton>
                <SubmitButton className="btn-primary inline danger" name="decision" value="REJECT" icon="fa-xmark">
                  Reject
                </SubmitButton>
              </div>
            </ActionForm>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-title">
            <span>
              <i className="fas fa-pen" /> Edit
            </span>
          </div>
          <p className="modal-note" style={{ marginTop: 0, marginBottom: "1rem" }}>
            Changing the amount, direction, account or status adjusts the balances automatically.
          </p>
          <TransactionForm
            accounts={accounts.map((a) => ({
              id: a.id,
              label: `${a.name} · ${a.number} (${money(Number(a.balance), settings)})${a.status !== "ACTIVE" ? ` · ${a.status.toLowerCase()}` : ""}`,
            }))}
            currency={settings.currency}
            timezone={settings.timezone}
            nowInput={toZonedInput(new Date(), settings.timezone)}
            edit={{
              transactionId: t.id,
              accountId: t.accountId,
              amount,
              title: t.title,
              description: t.description,
              kind: t.kind,
              status: t.status,
              postedAt: toZonedInput(t.postedAt, settings.timezone),
              icon: t.icon,
            }}
          />

          <ActionForm
            action={deleteTransactionAction}
            confirm="Delete this transaction permanently? Its effect on the balance will be reversed."
            style={{ marginTop: "1.5rem", paddingTop: "1.25rem", borderTop: "1px solid #e5edf0" }}
          >
            <input type="hidden" name="transactionId" value={t.id} />
            <input type="hidden" name="redirectTo" value={`/admin/customers/${t.account.userId}`} />
            <SubmitButton className="btn-primary inline danger" icon="fa-trash">
              Delete transaction
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
