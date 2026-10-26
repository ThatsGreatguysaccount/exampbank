import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { IconPicker } from "@/components/IconPicker";
import { TX_ICONS } from "@/lib/icons";
import { addTransactionAction, updateTransactionAction } from "@/app/actions/admin";
import { KIND_LABELS } from "./shared";
import { AccountPicker } from "./AccountPicker";

/** `group` is the customer label; when set, a Customer select filters the Account select. */
export type AccountOption = { id: number; label: string; group?: string };

export type TransactionDefaults = {
  transactionId: number;
  accountId: number;
  amount: number;
  title: string;
  description: string | null;
  kind: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  postedAt: string;
  icon: string;
};

export function TransactionForm({
  accounts,
  currency,
  timezone,
  nowInput,
  edit,
}: {
  accounts: AccountOption[];
  currency: string;
  timezone: string;
  nowInput: string;
  edit?: TransactionDefaults;
}) {
  const prefix = edit ? `tx${edit.transactionId}` : "newtx";
  const isCredit = edit ? edit.amount > 0 : true;

  return (
    <ActionForm action={edit ? updateTransactionAction : addTransactionAction} resetOnSuccess={!edit}>
      {edit ? <input type="hidden" name="transactionId" value={edit.transactionId} /> : null}
      <AccountPicker accounts={accounts} defaultValue={edit?.accountId} />
      <div className="form-group">
        <div className="segmented">
          <input type="radio" name="direction" value="credit" id={`${prefix}-credit`} defaultChecked={isCredit} />
          <label htmlFor={`${prefix}-credit`}>
            <i className="fas fa-arrow-down" /> Credit (money in)
          </label>
          <input
            type="radio"
            name="direction"
            value="debit"
            id={`${prefix}-debit`}
            className="debit-opt"
            defaultChecked={!isCredit}
          />
          <label htmlFor={`${prefix}-debit`}>
            <i className="fas fa-arrow-up" /> Debit (money out)
          </label>
        </div>
      </div>
      <div className="form-group">
        <label>Amount ({currency})</label>
        <div className="amount-input">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            defaultValue={edit ? Math.abs(edit.amount).toFixed(2) : undefined}
            required
          />
        </div>
      </div>
      <div className="form-group">
        <label>Description (shown to customer)</label>
        <input name="title" placeholder="e.g. Payroll · SaskPower" defaultValue={edit?.title} required />
      </div>
      <div className="form-group">
        <label>Note (optional)</label>
        <input
          name="description"
          placeholder="Extra detail shown in transaction details"
          defaultValue={edit?.description ?? ""}
        />
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>Category</label>
          <select name="kind" defaultValue={edit?.kind ?? ""}>
            {edit ? null : <option value="">Auto (Credit / Debit)</option>}
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select name="status" defaultValue={edit?.status ?? "COMPLETED"}>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            {edit ? <option value="REJECTED">Rejected</option> : null}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Date &amp; time ({timezone})</label>
        <input name="postedAt" type="datetime-local" defaultValue={edit?.postedAt ?? nowInput} />
      </div>
      <div className="form-group">
        <label>Icon</label>
        <IconPicker name="icon" icons={TX_ICONS} defaultValue={edit?.icon} idPrefix={prefix} />
      </div>
      <label className="check-row">
        <input type="checkbox" name="allowOverdraft" /> Allow overdraft (balance may go negative)
      </label>
      <SubmitButton icon={edit ? "fa-save" : "fa-check"}>{edit ? "Save changes" : "Add transaction"}</SubmitButton>
    </ActionForm>
  );
}
