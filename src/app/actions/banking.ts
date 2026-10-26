"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApprovedCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { KIND_ICONS, creditAccount, debitAccount, newReference } from "@/lib/banking";
import { money } from "@/lib/format";
import {
  PAYEE_TYPE_LABELS,
  WIRE_PURPOSES,
  countryName,
  formatIban,
  formatPhone,
  looksLikeIban,
  validatePayee,
  type PayeeInput,
} from "@/lib/payees";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function cleanAmount(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

async function ownActiveAccount(userId: number, accountId: unknown) {
  const id = Number(accountId);
  if (!Number.isInteger(id)) return null;
  const acc = await prisma.account.findFirst({ where: { id, userId } });
  return acc && acc.status === "ACTIVE" ? acc : null;
}

class InsufficientFunds extends Error {}

export async function transferAction(input: { fromId: number; toId: number; amount: number }): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  const amount = cleanAmount(input.amount);
  if (!amount) return { ok: false, error: "Enter a valid amount." };
  if (Number(input.fromId) === Number(input.toId)) return { ok: false, error: "Choose two different accounts." };
  const [from, to] = await Promise.all([ownActiveAccount(user.id, input.fromId), ownActiveAccount(user.id, input.toId)]);
  if (!from || !to) return { ok: false, error: "One of the selected accounts is unavailable." };

  const settings = await getSettings();
  try {
    await prisma.$transaction(async (tx) => {
      if (!(await debitAccount(tx, from.id, amount))) throw new InsufficientFunds();
      await creditAccount(tx, to.id, amount);
      const now = new Date();
      await tx.transaction.create({
        data: {
          accountId: from.id,
          kind: "TRANSFER",
          title: `Transfer to ${to.name}`,
          amount: -amount,
          icon: KIND_ICONS.TRANSFER,
          reference: newReference(),
          postedAt: now,
          meta: { counterpartyAccountId: to.id },
        },
      });
      await tx.transaction.create({
        data: {
          accountId: to.id,
          kind: "TRANSFER",
          title: `Transfer from ${from.name}`,
          amount,
          icon: KIND_ICONS.TRANSFER,
          reference: newReference(),
          postedAt: now,
          meta: { counterpartyAccountId: from.id },
        },
      });
    });
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      return { ok: false, error: `Insufficient funds in ${from.name}. Available: ${money(Number(from.balance), settings)}` };
    }
    throw e;
  }

  revalidatePath("/dashboard");
  return { ok: true, message: `Moved ${money(amount, settings)} from ${from.name} to ${to.name}.` };
}

async function heldDebit(params: {
  userId: number;
  fromId: number;
  amount: unknown;
  kind: "BILL_PAYMENT" | "ETRANSFER" | "WIRE_TRANSFER";
  title: string;
  description?: string;
  meta: Record<string, string>;
}): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const amount = cleanAmount(params.amount);
  if (!amount) return { ok: false, error: "Enter a valid amount." };
  const from = await ownActiveAccount(params.userId, params.fromId);
  if (!from) return { ok: false, error: "The selected account is unavailable." };

  try {
    await prisma.$transaction(async (tx) => {
      if (!(await debitAccount(tx, from.id, amount))) throw new InsufficientFunds();
      await tx.transaction.create({
        data: {
          accountId: from.id,
          kind: params.kind,
          status: "PENDING",
          title: params.title,
          description: params.description,
          amount: -amount,
          icon: KIND_ICONS[params.kind],
          reference: newReference(),
          meta: params.meta,
        },
      });
    });
  } catch (e) {
    if (e instanceof InsufficientFunds) return { ok: false, error: "Insufficient funds." };
    throw e;
  }
  return { ok: true, amount };
}

export async function addPayeeAction(input: PayeeInput): Promise<ActionResult & { payeeId?: number }> {
  const user = await requireApprovedCustomer();
  if (!input || !(input.type in PAYEE_TYPE_LABELS)) return { ok: false, error: "Choose a payee type." };
  const res = validatePayee(input);
  if (!res.ok) return res;
  if ((await prisma.payee.count({ where: { userId: user.id } })) >= 100) {
    return { ok: false, error: "You can save up to 100 payees. Remove one first." };
  }

  try {
    const payee = await prisma.payee.create({ data: { userId: user.id, ...res.payee } });
    revalidatePath("/dashboard");
    const where = { BILL: "your payees", ETRANSFER: "your e-Transfer contacts", INTERNATIONAL: "your wire beneficiaries" };
    return { ok: true, message: `${payee.name} added to ${where[payee.type]}.`, payeeId: payee.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "You already have a payee of this type with this name." };
    }
    throw e;
  }
}

export async function deletePayeeAction(input: { payeeId: number }): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  const res = await prisma.payee.deleteMany({ where: { id: Number(input.payeeId) || 0, userId: user.id } });
  if (!res.count) return { ok: false, error: "Payee not found." };
  revalidatePath("/dashboard");
  return { ok: true, message: "Payee removed." };
}

export async function billPayAction(input: {
  fromId: number;
  payeeId: number;
  payeeAccount: string;
  amount: number;
}): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  const settings = await getSettings();
  const saved = await prisma.payee.findFirst({ where: { id: Number(input.payeeId) || 0, userId: user.id, type: "BILL" } });
  if (!saved) return { ok: false, error: "Add the payee to your payees first." };
  const payee = saved.name;
  const payeeAccount = String(input.payeeAccount ?? "").trim().slice(0, 40) || saved.accountNumber || "";

  const res = await heldDebit({
    userId: user.id,
    fromId: input.fromId,
    amount: input.amount,
    kind: "BILL_PAYMENT",
    title: `Bill payment · ${payee}`,
    meta: { payee, payeeAccount },
  });
  if (!res.ok) return res;
  revalidatePath("/dashboard");
  return { ok: true, message: `Bill payment of ${money(res.amount, settings)} to ${payee} submitted for processing.` };
}

export async function eTransferAction(input: {
  fromId: number;
  payeeId?: number;
  recipientName?: string;
  email?: string;
  phone?: string;
  amount: number;
  message: string;
}): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  let recipientName: string;
  let email: string | null;
  let phone: string | null;

  if (input.payeeId) {
    const saved = await prisma.payee.findFirst({
      where: { id: Number(input.payeeId), userId: user.id, type: "ETRANSFER" },
    });
    if (!saved) return { ok: false, error: "Choose a contact from the list." };
    recipientName = saved.name;
    email = saved.email;
    phone = saved.phone;
  } else {
    const res = validatePayee({ type: "ETRANSFER", name: input.recipientName ?? "", email: input.email, phone: input.phone });
    if (!res.ok) return res;
    recipientName = res.payee.name;
    email = res.payee.email;
    phone = res.payee.phone;
  }

  const message = String(input.message ?? "").trim().slice(0, 400);
  const settings = await getSettings();
  const notify = email ?? formatPhone(phone);

  const res = await heldDebit({
    userId: user.id,
    fromId: input.fromId,
    amount: input.amount,
    kind: "ETRANSFER",
    title: `e-Transfer to ${recipientName}`,
    description: message || undefined,
    meta: { recipientName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
  });
  if (!res.ok) return res;
  revalidatePath("/dashboard");
  return { ok: true, message: `e-Transfer of ${money(res.amount, settings)} to ${recipientName} (${notify}) is being processed.` };
}

export async function wireTransferAction(input: {
  fromId: number;
  payeeId: number;
  amount: number;
  purpose: string;
  message: string;
}): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  const payee = await prisma.payee.findFirst({
    where: { id: Number(input.payeeId) || 0, userId: user.id, type: "INTERNATIONAL" },
  });
  if (!payee) return { ok: false, error: "Choose a beneficiary." };
  const purpose = String(input.purpose ?? "");
  if (!WIRE_PURPOSES.includes(purpose)) return { ok: false, error: "Choose the purpose of this payment." };
  const amount = cleanAmount(input.amount);
  if (!amount) return { ok: false, error: "Enter a valid amount." };
  if (amount < 10) return { ok: false, error: "The minimum wire amount is 10.00." };

  const settings = await getSettings();
  const fee = Math.max(0, Number(settings.wireFee) || 0);
  const message = String(input.message ?? "").trim().slice(0, 140);

  const res = await heldDebit({
    userId: user.id,
    fromId: input.fromId,
    amount: Math.round((amount + fee) * 100) / 100,
    kind: "WIRE_TRANSFER",
    title: `International wire · ${payee.name}`,
    description: message || undefined,
    meta: {
      beneficiary: payee.name,
      beneficiaryAddress: [payee.beneficiaryAddress, payee.beneficiaryCity, countryName(payee.beneficiaryCountry)]
        .filter(Boolean)
        .join(", "),
      bankName: payee.bankName ?? "",
      swiftBic: payee.swiftBic ?? "",
      ...(payee.accountNumber && looksLikeIban(payee.accountNumber)
        ? { iban: formatIban(payee.accountNumber) }
        : { accountNumber: payee.accountNumber ?? "" }),
      ...(payee.routingCode ? { routingCode: payee.routingCode } : {}),
      bankCountry: countryName(payee.bankCountry),
      receivingCurrency: payee.currency ?? "",
      purpose,
      amountSent: money(amount, settings),
      wireFee: money(fee, settings),
    },
  });
  if (!res.ok) return res;
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Wire of ${money(amount, settings)} to ${payee.name} submitted (fee ${money(fee, settings)}). We'll process it shortly.`,
  };
}

export async function depositChequeAction(input: {
  toId: number;
  amount: number;
  chequeNumber: string;
}): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  const amount = cleanAmount(input.amount);
  if (!amount) return { ok: false, error: "Enter a valid amount." };
  const chequeNumber = String(input.chequeNumber ?? "").trim().slice(0, 30);
  if (!chequeNumber) return { ok: false, error: "Enter the cheque number." };
  const to = await ownActiveAccount(user.id, input.toId);
  if (!to) return { ok: false, error: "The selected account is unavailable." };
  const settings = await getSettings();

  await prisma.transaction.create({
    data: {
      accountId: to.id,
      kind: "CHEQUE_DEPOSIT",
      status: "PENDING",
      title: "Mobile cheque deposit",
      amount,
      icon: KIND_ICONS.CHEQUE_DEPOSIT,
      reference: newReference(),
      meta: { chequeNumber },
    },
  });
  revalidatePath("/dashboard");
  return { ok: true, message: `Deposit of ${money(amount, settings)} received. ${settings.chequeHoldNotice}` };
}
