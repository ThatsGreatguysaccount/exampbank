"use client";

import { useState } from "react";
import type { AccountOption } from "./TransactionForm";

export function AccountPicker({ accounts, defaultValue }: { accounts: AccountOption[]; defaultValue?: number }) {
  const customers = [...new Set(accounts.map((a) => a.group ?? ""))];
  const initial = accounts.find((a) => a.id === defaultValue) ?? accounts[0];
  const [customer, setCustomer] = useState(initial?.group ?? "");
  const [accountId, setAccountId] = useState<number | undefined>(initial?.id);
  const visible = accounts.filter((a) => (a.group ?? "") === customer);

  const pickCustomer = (c: string) => {
    setCustomer(c);
    setAccountId(accounts.find((a) => (a.group ?? "") === c)?.id);
  };

  return (
    <>
      {customers.some(Boolean) ? (
        <div className="form-group">
          <label>Customer</label>
          <select value={customer} onChange={(e) => pickCustomer(e.target.value)}>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="form-group">
        <label>Account</label>
        <select name="accountId" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
          {visible.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
