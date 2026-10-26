import "server-only";
import { randomInt, randomBytes } from "crypto";
import type { AccountType, Prisma, TxKind } from "@prisma/client";
import { prisma } from "./db";

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: string; registered: boolean }> = {
  CHEQUING: { label: "Chequing", icon: "fa-wallet", registered: false },
  SAVINGS: { label: "Savings", icon: "fa-piggy-bank", registered: false },
  TFSA: { label: "TFSA Invest", icon: "fa-chart-line", registered: true },
  RRSP: { label: "RRSP", icon: "fa-building-columns", registered: true },
  RRIF: { label: "RRIF", icon: "fa-hand-holding-dollar", registered: true },
  GIC: { label: "GIC", icon: "fa-umbrella", registered: true },
  OTHER: { label: "Account", icon: "fa-credit-card", registered: false },
};

export const KIND_ICONS: Record<TxKind, string> = {
  TRANSFER: "fa-arrow-right-arrow-left",
  BILL_PAYMENT: "fa-file-invoice",
  CHEQUE_DEPOSIT: "fa-qrcode",
  ETRANSFER: "fa-paper-plane",
  WIRE_TRANSFER: "fa-globe",
  ADMIN_CREDIT: "fa-circle-plus",
  ADMIN_DEBIT: "fa-circle-minus",
  INTEREST: "fa-percent",
  FEE: "fa-receipt",
  INVESTMENT: "fa-chart-pie",
};

export function newReference() {
  return `TXN-${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function newAccountNumber(tx: Prisma.TransactionClient = prisma) {
  for (;;) {
    const number = String(randomInt(1_000_000, 9_999_999));
    if (!(await tx.account.findUnique({ where: { number } }))) return number;
  }
}

export async function newMemberNumber(prefix: string, tx: Prisma.TransactionClient = prisma) {
  for (;;) {
    const memberNumber = `${prefix}-${randomInt(10_000, 99_999)}`;
    if (!(await tx.user.findUnique({ where: { memberNumber } }))) return memberNumber;
  }
}

/** Parses a user-entered money string into a positive amount with 2 decimals, or null. */
export function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/[,\s$]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Atomically debits an account only if the balance covers the amount (unless allowOverdraft).
 * Returns false when funds are insufficient.
 */
export async function debitAccount(
  tx: Prisma.TransactionClient,
  accountId: number,
  amount: number,
  allowOverdraft = false,
) {
  const res = await tx.account.updateMany({
    where: allowOverdraft ? { id: accountId } : { id: accountId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  return res.count === 1;
}

export async function creditAccount(tx: Prisma.TransactionClient, accountId: number, amount: number) {
  await tx.account.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
}
