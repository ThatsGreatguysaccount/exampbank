"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma, type AccountStatus, type AccountType, type ProductKind, type TxKind, type TxStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings, isSettingKey } from "@/lib/settings";
import {
  ACCOUNT_TYPES,
  KIND_ICONS,
  creditAccount,
  debitAccount,
  newAccountNumber,
  newMemberNumber,
  newReference,
  parseAmount,
} from "@/lib/banking";
import { fromZonedInput, money } from "@/lib/format";
import { deleteUpload } from "@/lib/storage";
import type { FormState } from "@/lib/action-state";
import { RATE_HOLD_DAYS, addMonths, applicationIdOf, termLabel } from "@/lib/products";
import {
  IP_ACCESS_KEYS,
  MAX_IP_ENTRIES,
  buildMatcher,
  clientIp,
  invalidateIpAccess,
  isAllowed,
  parseEntry,
  readIpAccess,
  type IpEntry,
} from "@/lib/ip-access";

const ACCOUNT_TYPE_KEYS = Object.keys(ACCOUNT_TYPES) as AccountType[];
const ACCOUNT_STATUSES: AccountStatus[] = ["ACTIVE", "FROZEN", "CLOSED"];
const TX_KINDS = Object.keys(KIND_ICONS) as TxKind[];
const TX_STATUSES: TxStatus[] = ["PENDING", "COMPLETED", "REJECTED"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function s(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function id(fd: FormData, key: string) {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}
function revalidateAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
}

class ActionError extends Error {}

/* ---------------- KYC ---------------- */

export async function reviewKycAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = id(fd, "userId");
  const decision = s(fd, "decision");
  const note = s(fd, "note");
  if (!userId) return { error: "Missing customer." };
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { accounts: true } });
  if (!user || user.role !== "CUSTOMER") return { error: "Customer not found." };

  if (decision === "REJECT") {
    if (!note) return { error: "Give the customer a reason so they know what to re-upload." };
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { kycStatus: "REJECTED", kycNote: note, kycReviewedAt: new Date() },
      }),
      prisma.document.updateMany({
        where: { userId },
        data: { status: "REJECTED", reviewNote: note, reviewedAt: new Date() },
      }),
    ]);
    revalidateAll();
    return { ok: true, message: "Application rejected. The customer will be asked to upload new documents." };
  }

  if (decision !== "APPROVE") return { error: "Unknown decision." };
  const settings = await getSettings();
  const toOpen: AccountType[] = [];
  if (fd.get("openChequing") === "on" && !user.accounts.some((a) => a.type === "CHEQUING")) toOpen.push("CHEQUING");
  if (fd.get("openSavings") === "on" && !user.accounts.some((a) => a.type === "SAVINGS")) toOpen.push("SAVINGS");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        kycStatus: "APPROVED",
        kycNote: null,
        kycReviewedAt: new Date(),
        memberNumber: user.memberNumber ?? (await newMemberNumber(settings.memberPrefix, tx)),
      },
    });
    await tx.document.updateMany({ where: { userId }, data: { status: "APPROVED", reviewedAt: new Date() } });
    for (const type of toOpen) {
      await tx.account.create({
        data: { userId, type, name: ACCOUNT_TYPES[type].label, number: await newAccountNumber(tx) },
      });
    }
  });
  revalidateAll();
  return {
    ok: true,
    message: `Customer approved${toOpen.length ? ` and ${toOpen.map((t) => ACCOUNT_TYPES[t].label).join(" + ")} opened` : ""}.`,
  };
}

/* ---------------- Customers ---------------- */

export async function updateCustomerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = id(fd, "userId");
  if (!userId) return { error: "Missing customer." };
  const email = s(fd, "email").toLowerCase();
  if (!s(fd, "firstName") || !s(fd, "lastName")) return { error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email." };
  const password = typeof fd.get("newPassword") === "string" ? (fd.get("newPassword") as string) : "";
  if (password && password.length < 8) return { error: "New password must be at least 8 characters." };
  const memberNumber = s(fd, "memberNumber") || null;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: s(fd, "firstName"),
        lastName: s(fd, "lastName"),
        email,
        phone: s(fd, "phone") || null,
        addressLine: s(fd, "addressLine") || null,
        city: s(fd, "city") || null,
        province: s(fd, "province") || null,
        postalCode: s(fd, "postalCode") || null,
        country: s(fd, "country") || null,
        branch: s(fd, "branch") || null,
        memberNumber,
        suspended: fd.get("suspended") === "on",
        ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That email or member number is already used by another customer." };
    }
    throw e;
  }
  revalidateAll();
  return { ok: true, message: "Customer details saved." };
}

/* ---------------- Accounts ---------------- */

export async function createAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = id(fd, "userId");
  const type = s(fd, "type") as AccountType;
  if (!userId) return { error: "Missing customer." };
  if (!ACCOUNT_TYPE_KEYS.includes(type)) return { error: "Choose an account type." };
  const name = s(fd, "name") || ACCOUNT_TYPES[type].label;
  const rateRaw = s(fd, "interestRate");
  const rate = rateRaw ? Number(rateRaw) : null;
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return { error: "Invalid interest rate." };
  const opening = s(fd, "openingBalance") ? parseAmount(fd.get("openingBalance")) : 0;
  if (opening === null) return { error: "Invalid opening balance." };
  const customNumber = s(fd, "number");
  if (customNumber && !/^\d{4,20}$/.test(customNumber)) return { error: "Account number must be 4–20 digits." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CUSTOMER") return { error: "Customer not found." };

  try {
    await prisma.$transaction(async (tx) => {
      const acc = await tx.account.create({
        data: {
          userId,
          type,
          name,
          number: customNumber || (await newAccountNumber(tx)),
          interestRate: rate,
          balance: opening,
        },
      });
      if (opening > 0) {
        await tx.transaction.create({
          data: {
            accountId: acc.id,
            kind: "ADMIN_CREDIT",
            title: "Opening deposit",
            amount: opening,
            icon: "fa-building-columns",
            reference: newReference(),
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "That account number is already in use." };
    }
    throw e;
  }
  revalidateAll();
  return { ok: true, message: `${name} account opened.` };
}

export async function updateAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const accountId = id(fd, "accountId");
  if (!accountId) return { error: "Missing account." };
  const status = s(fd, "status") as AccountStatus;
  if (!ACCOUNT_STATUSES.includes(status)) return { error: "Invalid status." };
  const rateRaw = s(fd, "interestRate");
  const rate = rateRaw ? Number(rateRaw) : null;
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return { error: "Invalid interest rate." };
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };

  await prisma.account.update({ where: { id: accountId }, data: { name, status, interestRate: rate } });
  revalidateAll();
  return { ok: true, message: "Account updated." };
}

/* ---------------- Transactions ---------------- */

export async function addTransactionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const accountId = id(fd, "accountId");
  const amount = parseAmount(fd.get("amount"));
  const direction = s(fd, "direction");
  const title = s(fd, "title");
  const status = s(fd, "status") === "PENDING" ? "PENDING" : "COMPLETED";
  const kindRaw = s(fd, "kind") as TxKind;
  const icon = s(fd, "icon");
  const allowOverdraft = fd.get("allowOverdraft") === "on";

  if (!accountId) return { error: "Choose an account." };
  if (!amount) return { error: "Enter a valid amount." };
  if (direction !== "credit" && direction !== "debit") return { error: "Choose credit or debit." };
  if (!title) return { error: "Enter a description." };

  const settings = await getSettings();
  const postedRaw = s(fd, "postedAt");
  const parsed = postedRaw ? fromZonedInput(postedRaw, settings.timezone) : new Date();
  if (!parsed) return { error: "Invalid date." };
  // The form pre-fills the current minute; keep full precision so ordering matches entry order.
  const postedAt = Math.abs(parsed.getTime() - Date.now()) < 120_000 ? new Date() : parsed;

  const kind: TxKind = TX_KINDS.includes(kindRaw) ? kindRaw : direction === "credit" ? "ADMIN_CREDIT" : "ADMIN_DEBIT";
  const signed = direction === "credit" ? amount : -amount;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };

  try {
    await prisma.$transaction(async (tx) => {
      // Debits (completed or pending) take funds immediately; pending credits only land on approval.
      if (signed < 0) {
        if (!(await debitAccount(tx, accountId, amount, allowOverdraft))) {
          throw new ActionError(
            `Insufficient funds (balance ${money(Number(account.balance), settings)}). Tick "Allow overdraft" to force it.`,
          );
        }
      } else if (status === "COMPLETED") {
        await creditAccount(tx, accountId, amount);
      }
      await tx.transaction.create({
        data: {
          accountId,
          kind,
          status,
          title,
          description: s(fd, "description") || null,
          amount: signed,
          icon: icon || KIND_ICONS[kind],
          reference: newReference(),
          postedAt,
        },
      });
    });
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }
  revalidateAll();
  return { ok: true, message: `${direction === "credit" ? "Credit" : "Debit"} of ${money(amount, settings)} recorded.` };
}

export async function reviewTransactionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const txId = id(fd, "transactionId");
  const decision = s(fd, "decision");
  const note = s(fd, "note") || null;
  if (!txId) return { error: "Missing transaction." };

  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id: txId } });
      if (!t || t.status !== "PENDING") throw new ActionError("This transaction is no longer pending.");
      if (applicationIdOf(t.meta)) throw new ActionError("These funds belong to a product application. Review it under Applications.");
      const amount = Math.abs(Number(t.amount));
      const isCredit = Number(t.amount) > 0;

      if (decision === "APPROVE") {
        if (isCredit) await creditAccount(tx, t.accountId, amount);
        await tx.transaction.update({
          where: { id: txId },
          data: { status: "COMPLETED", reviewedAt: new Date(), reviewNote: note },
        });
      } else if (decision === "REJECT") {
        if (!isCredit) await creditAccount(tx, t.accountId, amount);
        await tx.transaction.update({
          where: { id: txId },
          data: { status: "REJECTED", reviewedAt: new Date(), reviewNote: note },
        });
      } else {
        throw new ActionError("Unknown decision.");
      }
    });
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }
  revalidateAll();
  return { ok: true, message: decision === "APPROVE" ? "Transaction approved." : "Transaction rejected and funds released." };
}

/**
 * How much a transaction currently contributes to its account balance:
 * completed transactions count in full, pending debits are held, pending credits and rejected ones count nothing.
 */
function balanceEffect(status: TxStatus, amount: number) {
  if (status === "COMPLETED") return amount;
  if (status === "PENDING" && amount < 0) return amount;
  return 0;
}

export async function updateTransactionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const txId = id(fd, "transactionId");
  const accountId = id(fd, "accountId");
  const amount = parseAmount(fd.get("amount"));
  const direction = s(fd, "direction");
  const status = s(fd, "status") as TxStatus;
  const kind = s(fd, "kind") as TxKind;
  const title = s(fd, "title");
  const allowOverdraft = fd.get("allowOverdraft") === "on";

  if (!txId) return { error: "Missing transaction." };
  if (!accountId) return { error: "Choose an account." };
  if (!amount) return { error: "Enter a valid amount." };
  if (direction !== "credit" && direction !== "debit") return { error: "Choose credit or debit." };
  if (!TX_STATUSES.includes(status)) return { error: "Invalid status." };
  if (!title) return { error: "Description is required." };
  const settings = await getSettings();
  const postedAt = fromZonedInput(s(fd, "postedAt"), settings.timezone);
  if (!postedAt) return { error: "Invalid date." };
  const signed = direction === "credit" ? amount : -amount;

  try {
    await prisma.$transaction(async (tx) => {
      const old = await tx.transaction.findUnique({ where: { id: txId }, include: { account: true } });
      if (!old) throw new ActionError("Transaction not found.");
      const target = await tx.account.findUnique({ where: { id: accountId } });
      if (!target || target.userId !== old.account.userId) {
        throw new ActionError("Choose one of this customer's accounts.");
      }

      const oldEffect = balanceEffect(old.status, Number(old.amount));
      const newEffect = balanceEffect(status, signed);
      const netByAccount = new Map<number, number>();
      netByAccount.set(old.accountId, -oldEffect);
      netByAccount.set(accountId, (netByAccount.get(accountId) ?? 0) + newEffect);

      for (const [accId, rawNet] of netByAccount) {
        const net = Math.round(rawNet * 100) / 100;
        if (net === 0) continue;
        const updated = await tx.account.update({ where: { id: accId }, data: { balance: { increment: net } } });
        if (!allowOverdraft && net < 0 && Number(updated.balance) < 0) {
          throw new ActionError(
            `This change would overdraw ${updated.name} (new balance ${money(Number(updated.balance), settings)}). Tick "Allow overdraft" to force it.`,
          );
        }
      }

      const statusChanged = old.status !== status;
      await tx.transaction.update({
        where: { id: txId },
        data: {
          accountId,
          amount: signed,
          status,
          kind: TX_KINDS.includes(kind) ? kind : old.kind,
          title,
          description: s(fd, "description") || null,
          postedAt,
          icon: s(fd, "icon") || old.icon,
          ...(statusChanged ? { reviewedAt: status === "PENDING" ? null : new Date() } : {}),
          ...(statusChanged && status === "PENDING" ? { reviewNote: null } : {}),
        },
      });
    });
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }
  revalidateAll();
  return { ok: true, message: "Transaction updated and balances adjusted." };
}

/** Deletes a transaction and undoes whatever effect it had on the balance. */
export async function deleteTransactionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const txId = id(fd, "transactionId");
  if (!txId) return { error: "Missing transaction." };

  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findUnique({ where: { id: txId } });
    if (!t) return;
    const effect = balanceEffect(t.status, Number(t.amount));
    if (effect) {
      await tx.account.update({ where: { id: t.accountId }, data: { balance: { decrement: effect } } });
    }
    await tx.transaction.delete({ where: { id: txId } });
  });
  revalidateAll();
  const redirectTo = s(fd, "redirectTo");
  if (redirectTo.startsWith("/admin/")) redirect(redirectTo);
  return { ok: true, message: "Transaction deleted and balance adjusted." };
}

/* ---------------- Settings & products ---------------- */

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const updates: { key: string; value: string }[] = [];
  for (const [key, value] of fd.entries()) {
    if (isSettingKey(key) && typeof value === "string") updates.push({ key, value: value.trim() });
  }
  const currency = updates.find((u) => u.key === "currency")?.value;
  const locale = updates.find((u) => u.key === "locale")?.value;
  const timezone = updates.find((u) => u.key === "timezone")?.value;
  try {
    if (currency || locale) new Intl.NumberFormat(locale || "en", { style: "currency", currency: currency || "USD" });
    if (timezone) new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "Invalid currency code, locale or timezone." };
  }
  if (updates.some((u) => u.key === "bankName" && !u.value)) return { error: "Bank name is required." };
  const wireFee = updates.find((u) => u.key === "wireFee");
  if (wireFee) {
    const fee = Number(wireFee.value.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(fee) || fee < 0 || fee > 10_000) return { error: "Wire fee must be a number between 0 and 10,000." };
    wireFee.value = fee.toFixed(2);
  }

  await prisma.$transaction(
    updates.map((u) => prisma.setting.upsert({ where: { key: u.key }, update: { value: u.value }, create: u })),
  );
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/* ---------------- Network access (IP allowlist) ---------------- */

async function saveIpEntries(entries: IpEntry[]) {
  await prisma.setting.upsert({
    where: { key: IP_ACCESS_KEYS.list },
    update: { value: JSON.stringify(entries) },
    create: { key: IP_ACCESS_KEYS.list, value: JSON.stringify(entries) },
  });
  invalidateIpAccess();
  revalidatePath("/admin/settings");
}

const lockoutMessage = (ip: string | null) =>
  `This change would block your own connection (${ip ?? "unknown IP"}). Add an entry that covers your address first, or turn off the allowlist.`;

export async function addIpEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = parseEntry(s(fd, "ip"));
  if ("error" in parsed) return { error: parsed.error };
  const label = s(fd, "label").slice(0, 80);
  if (!label) return { error: "Add a description, e.g. \"Head office\" or \"Branch – Broadway\"." };

  const access = await readIpAccess();
  if (access.entries.some((e) => e.value === parsed.value)) return { error: `${parsed.value} is already on the list.` };
  if (access.entries.length >= MAX_IP_ENTRIES) return { error: `The list is limited to ${MAX_IP_ENTRIES} entries. Use a range instead.` };

  await saveIpEntries([
    ...access.entries,
    { value: parsed.value, label, addedAt: new Date().toISOString(), addedBy: admin.email },
  ]);
  return { ok: true, message: `${parsed.value} added.` };
}

export async function removeIpEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const value = s(fd, "value");
  const access = await readIpAccess();
  const remaining = access.entries.filter((e) => e.value !== value);
  if (remaining.length === access.entries.length) return { error: "That entry no longer exists." };
  if (access.enabled) {
    const ip = clientIp(await headers());
    if (!isAllowed(ip, buildMatcher(remaining))) return { error: lockoutMessage(ip) };
  }
  await saveIpEntries(remaining);
  return { ok: true, message: `${value} removed.` };
}

export async function setIpAccessAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const enable = s(fd, "decision") === "enable";
  if (enable) {
    const access = await readIpAccess();
    if (!access.entries.length) return { error: "Add at least one allowed IP address before turning on the allowlist." };
    const ip = clientIp(await headers());
    if (!isAllowed(ip, access.matcher)) return { error: lockoutMessage(ip) };
  }
  const value = enable ? "true" : "false";
  await prisma.setting.upsert({
    where: { key: IP_ACCESS_KEYS.enabled },
    update: { value },
    create: { key: IP_ACCESS_KEYS.enabled, value },
  });
  invalidateIpAccess();
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: enable
      ? "Allowlist is on. Only the listed networks can open the site."
      : "Allowlist is off. The site is reachable from any network.",
  };
}

const PRODUCT_KINDS: ProductKind[] = ["GENERAL", "TFSA_FUNDS", "RRSP_GIC", "RRIF", "MORTGAGE"];

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function saveProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const productId = id(fd, "productId");
  const kind = s(fd, "kind") as ProductKind;
  if (!PRODUCT_KINDS.includes(kind)) return { error: "Choose a product type." };
  const title = s(fd, "title");
  if (!title) return { error: "Title is required." };
  const slug = slugify(s(fd, "slug") || title);
  if (!slug) return { error: "Enter a URL slug using letters and numbers." };
  const minRaw = s(fd, "minAmount");
  const minAmount = minRaw ? parseAmount(minRaw) : null;
  if (minRaw && minAmount === null) return { error: "Invalid minimum amount." };

  const labels = fd.getAll("optLabel").map(String);
  const rates = fd.getAll("optRate").map(String);
  const months = fd.getAll("optMonths").map(String);
  const notes = fd.getAll("optNote").map(String);
  const options: { label: string; rate: number; months?: number; note?: string }[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim();
    if (!label) continue;
    const rate = Number(rates[i]);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return { error: `Rate for "${label}" must be between 0 and 50.` };
    const m = Number(months[i]);
    options.push({
      label: label.slice(0, 60),
      rate: Math.round(rate * 100) / 100,
      ...(months[i]?.trim() && Number.isInteger(m) && m > 0 && m <= 600 ? { months: m } : {}),
      ...(notes[i]?.trim() ? { note: notes[i].trim().slice(0, 120) } : {}),
    });
  }
  if (kind !== "GENERAL" && options.length === 0) return { error: "Add at least one rate option for this product type." };

  const data = {
    title,
    description: s(fd, "description"),
    icon: s(fd, "icon") || "fa-star",
    sortOrder: Number(s(fd, "sortOrder")) || 0,
    active: fd.get("active") === "on",
    kind,
    slug,
    summary: s(fd, "summary") || null,
    minAmount,
    options,
  };
  try {
    if (productId) await prisma.product.update({ where: { id: productId }, data });
    else await prisma.product.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Another product already uses that URL slug." };
    }
    throw e;
  }
  revalidateAll();
  return { ok: true, message: productId ? "Product updated." : "Product added." };
}

export async function deleteProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const productId = id(fd, "productId");
  if (!productId) return { error: "Missing product." };
  if (await prisma.productApplication.count({ where: { productId } })) {
    return { error: "Customers have applied for this product. Untick “Visible” to hide it instead." };
  }
  await prisma.product.delete({ where: { id: productId } }).catch(() => {});
  revalidateAll();
  return { ok: true, message: "Product removed." };
}

/* ---------------- Product applications ---------------- */

const OPENED_ACCOUNT_TYPE: Partial<Record<ProductKind, AccountType>> = {
  TFSA_FUNDS: "TFSA",
  RRSP_GIC: "RRSP",
  RRIF: "RRIF",
};

export async function reviewApplicationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const applicationId = id(fd, "applicationId");
  const decision = s(fd, "decision");
  const note = s(fd, "note") || null;
  if (!applicationId) return { error: "Missing application." };
  if (decision !== "APPROVE" && decision !== "DECLINE") return { error: "Unknown decision." };
  if (decision === "DECLINE" && !note) return { error: "Tell the customer why the application was declined." };

  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.productApplication.findUnique({ where: { id: applicationId }, include: { product: true } });
      if (!app || app.status !== "PENDING") throw new ActionError("This application has already been reviewed.");
      const now = new Date();
      const hold = app.holdTransactionId ? await tx.transaction.findUnique({ where: { id: app.holdTransactionId } }) : null;
      const details = { ...((app.details ?? {}) as Record<string, unknown>) };

      if (decision === "DECLINE") {
        if (hold && hold.status === "PENDING") {
          await creditAccount(tx, hold.accountId, Math.abs(Number(hold.amount)));
          await tx.transaction.update({
            where: { id: hold.id },
            data: { status: "REJECTED", reviewedAt: now, reviewNote: note },
          });
        }
        await tx.productApplication.update({
          where: { id: app.id },
          data: { status: "DECLINED", adminNote: note, reviewedAt: now },
        });
        return;
      }

      let openedAccountId: number | null = null;
      let approvedAmount: number | null = null;
      const accountType = OPENED_ACCOUNT_TYPE[app.kind];

      if (accountType) {
        if (!hold || hold.status !== "PENDING") throw new ActionError("The held funds for this application are missing.");
        const amount = Math.abs(Number(hold.amount));
        const rate = app.rate === null ? null : Number(app.rate);
        let name = `${app.product.title} · ${app.optionLabel}`;
        if (app.kind === "RRSP_GIC" && app.termMonths) {
          const maturity = addMonths(now, app.termMonths);
          details.maturityDate = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(maturity);
          name = `RRSP GIC ${termLabel(app.termMonths)} · matures ${new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric" }).format(maturity)}`;
        } else if (app.kind === "TFSA_FUNDS") {
          name = `TFSA · ${app.optionLabel}`;
        } else if (app.kind === "RRIF") {
          name = `RRIF · ${app.optionLabel}`;
        }
        const account = await tx.account.create({
          data: {
            userId: app.userId,
            type: accountType,
            name: name.slice(0, 120),
            number: await newAccountNumber(tx),
            balance: amount,
            interestRate: rate,
          },
        });
        openedAccountId = account.id;
        approvedAmount = amount;
        await tx.transaction.update({
          where: { id: hold.id },
          data: {
            status: "COMPLETED",
            reviewedAt: now,
            reviewNote: note,
            title: `Transfer to ${account.name}`,
            meta: { ...((hold.meta ?? {}) as Record<string, unknown>), counterpartyAccountId: account.id },
          },
        });
        await tx.transaction.create({
          data: {
            accountId: account.id,
            kind: "INVESTMENT",
            title: app.kind === "RRIF" ? "RRIF transfer-in" : "Initial contribution",
            description: `${app.product.title} · application ${app.reference}`,
            amount,
            icon: KIND_ICONS.INVESTMENT,
            reference: newReference(),
            meta: { applicationId: app.id, application: app.reference, counterpartyAccountId: hold.accountId },
          },
        });
      } else if (app.kind === "MORTGAGE") {
        const raw = s(fd, "approvedAmount");
        approvedAmount = raw ? parseAmount(raw) : Number(app.amount);
        if (!approvedAmount) throw new ActionError("Enter the approved mortgage amount.");
        const until = new Date(now.getTime() + RATE_HOLD_DAYS * 86_400_000);
        details.rateHeldUntil = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" }).format(until);
      }

      await tx.productApplication.update({
        where: { id: app.id },
        data: {
          status: "APPROVED",
          adminNote: note,
          reviewedAt: now,
          openedAccountId,
          approvedAmount,
          details: details as Prisma.InputJsonValue,
        },
      });
    });
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    throw e;
  }
  revalidateAll();
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      decision === "APPROVE"
        ? "Application approved. The customer can see the outcome on their dashboard."
        : "Application declined and any held funds returned to the customer.",
  };
}

export async function deleteCustomerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = id(fd, "userId");
  if (!userId) return { error: "Missing customer." };
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { documents: true } });
  if (!user || user.role !== "CUSTOMER") return { error: "Customer not found." };
  await prisma.user.delete({ where: { id: userId } });
  await Promise.all(user.documents.map((d) => deleteUpload(d.storedName)));
  revalidateAll();
  redirect("/admin/customers");
}
