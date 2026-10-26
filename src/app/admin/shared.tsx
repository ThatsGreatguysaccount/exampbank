import Link from "next/link";
import type { KycStatus, TxStatus } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { reviewTransactionAction, deleteTransactionAction } from "@/app/actions/admin";
import { applicationIdOf } from "@/lib/products";

export function KycBadge({ status }: { status: KycStatus }) {
  const map: Record<KycStatus, [string, string]> = {
    PENDING_DOCUMENTS: ["badge-grey", "Awaiting documents"],
    PENDING_REVIEW: ["badge-amber", "Needs review"],
    APPROVED: ["badge-green", "Approved"],
    REJECTED: ["badge-red", "Rejected"],
  };
  const [cls, label] = map[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function TxStatusBadge({ status }: { status: TxStatus }) {
  if (status === "PENDING") return <span className="badge badge-amber">Pending</span>;
  if (status === "REJECTED") return <span className="badge badge-red">Rejected</span>;
  return <span className="badge badge-green">Completed</span>;
}

export const KIND_LABELS: Record<string, string> = {
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

export function TxRowActions({ id, status, meta }: { id: number; status: TxStatus; meta?: unknown }) {
  const applicationId = applicationIdOf(meta);
  return (
    <div className="row-actions">
      {status === "PENDING" && applicationId ? (
        <Link href={`/admin/applications/${applicationId}`} className="link-btn">
          <i className="fas fa-file-signature" /> Review application
        </Link>
      ) : status === "PENDING" ? (
        <>
          <ActionForm action={reviewTransactionAction}>
            <input type="hidden" name="transactionId" value={id} />
            <input type="hidden" name="decision" value="APPROVE" />
            <SubmitButton className="link-btn" icon="fa-check" pendingText="…">
              Approve
            </SubmitButton>
          </ActionForm>
          <ActionForm action={reviewTransactionAction} confirm="Reject this transaction? Held funds will be returned.">
            <input type="hidden" name="transactionId" value={id} />
            <input type="hidden" name="decision" value="REJECT" />
            <SubmitButton className="link-btn danger" icon="fa-xmark" pendingText="…">
              Reject
            </SubmitButton>
          </ActionForm>
        </>
      ) : null}
      <Link href={`/admin/transactions/${id}`} className="link-btn">
        <i className="fas fa-pen" /> Edit
      </Link>
      <ActionForm
        action={deleteTransactionAction}
        confirm="Delete this transaction? Its effect on the balance will be reversed."
      >
        <input type="hidden" name="transactionId" value={id} />
        <SubmitButton className="link-btn danger" icon="fa-trash" pendingText="…">
          Delete
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`;
}
