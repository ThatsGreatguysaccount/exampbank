"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireApprovedCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { KIND_ICONS, creditAccount, debitAccount, newReference } from "@/lib/banking";
import { money } from "@/lib/format";
import { ageOn, parseOptions, validateApplication, type ApplicationInput } from "@/lib/products";
import type { ActionResult } from "./banking";

class ActionError extends Error {}

const FUNDED_KINDS = new Set(["TFSA_FUNDS", "RRSP_GIC", "RRIF"]);
/** Registered plans can't be funded from other registered plans (except RRSP → RRIF rollovers). */
const BLOCKED_SOURCES: Record<string, string[]> = {
  TFSA_FUNDS: ["TFSA", "RRSP", "RRIF", "GIC"],
  RRSP_GIC: ["TFSA", "RRSP", "RRIF", "GIC"],
  RRIF: ["TFSA", "RRIF", "GIC"],
};

function newApplicationRef() {
  return `APP-${Date.now().toString(36).toUpperCase().slice(-5)}${randomBytes(2).toString("hex").toUpperCase()}`;
}

function revalidate(slug: string | null) {
  revalidatePath("/dashboard", "layout");
  if (slug) revalidatePath(`/dashboard/products/${slug}`);
  revalidatePath("/admin", "layout");
}

export async function applyForProductAction(
  productId: number,
  input: ApplicationInput,
): Promise<ActionResult & { reference?: string }> {
  const user = await requireApprovedCustomer();
  const product = await prisma.product.findFirst({ where: { id: Number(productId) || 0, active: true } });
  if (!product) return { ok: false, error: "This product is no longer available." };
  if (!input || input.kind !== product.kind) return { ok: false, error: "This form doesn't match the product." };

  const open = await prisma.productApplication.count({
    where: { userId: user.id, productId: product.id, status: "PENDING" },
  });
  if (open >= 3) return { ok: false, error: "You already have applications in review for this product." };

  const checked = validateApplication(input, {
    options: parseOptions(product.options),
    minAmount: product.minAmount === null ? null : Number(product.minAmount),
    age: ageOn(user.dateOfBirth),
    birthYear: user.dateOfBirth ? user.dateOfBirth.getUTCFullYear() : null,
  });
  if (!checked.ok) return checked;
  const { app, warnings } = checked;
  const settings = await getSettings();

  const accounts = await prisma.account.findMany({ where: { userId: user.id, status: "ACTIVE" } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const details: Record<string, string | number | boolean | string[]> = { ...app.details };
  if (warnings.length) details.warnings = warnings;

  if (product.kind === "RRIF") {
    const dep = byId.get(Number(app.details.depositAccountId));
    if (!dep || ["TFSA", "RRSP", "RRIF", "GIC"].includes(dep.type)) {
      return { ok: false, error: "RRIF payments must go to a chequing or savings account." };
    }
    details.depositAccount = `${dep.name} ···${dep.number.slice(-4)}`;
  }

  const reference = newApplicationRef();
  const source = app.sourceAccountId ? byId.get(app.sourceAccountId) : undefined;
  if (FUNDED_KINDS.has(product.kind)) {
    if (!source) return { ok: false, error: "Choose one of your active accounts to fund this." };
    if (BLOCKED_SOURCES[product.kind]?.includes(source.type)) {
      return { ok: false, error: `${source.name} can't be used to fund this plan. Choose a chequing or savings account.` };
    }
    details.sourceAccount = `${source.name} ···${source.number.slice(-4)}`;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.productApplication.create({
        data: {
          reference,
          userId: user.id,
          productId: product.id,
          kind: product.kind,
          optionLabel: app.optionLabel,
          rate: app.rate,
          termMonths: app.termMonths,
          amount: app.amount,
          sourceAccountId: source?.id ?? null,
          details: details as Prisma.InputJsonValue,
        },
      });
      if (source && app.amount) {
        if (!(await debitAccount(tx, source.id, app.amount))) {
          throw new ActionError(`Insufficient funds in ${source.name}. Available: ${money(Number(source.balance), settings)}`);
        }
        const hold = await tx.transaction.create({
          data: {
            accountId: source.id,
            kind: "INVESTMENT",
            status: "PENDING",
            title: `${product.title} · ${app.optionLabel}`,
            description: `Funds held for application ${reference}`,
            amount: -app.amount,
            icon: KIND_ICONS.INVESTMENT,
            reference: newReference(),
            meta: { applicationId: created.id, application: reference, product: product.title },
          },
        });
        await tx.productApplication.update({ where: { id: created.id }, data: { holdTransactionId: hold.id } });
      }
    });
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    throw e;
  }

  revalidate(product.slug);
  const msg =
    product.kind === "MORTGAGE"
      ? `Pre-approval request ${reference} submitted. A mortgage specialist will review it within 1 business day.`
      : product.kind === "GENERAL"
        ? `Thanks! Request ${reference} received — we'll call you back.`
        : `Application ${reference} submitted. ${money(app.amount ?? 0, settings)} is on hold until it's approved.`;
  return { ok: true, message: msg, reference };
}

export async function cancelApplicationAction(applicationId: number): Promise<ActionResult> {
  const user = await requireApprovedCustomer();
  let slug: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const app = await tx.productApplication.findFirst({
        where: { id: Number(applicationId) || 0, userId: user.id },
        include: { product: true },
      });
      if (!app || app.status !== "PENDING") throw new ActionError("This application can no longer be cancelled.");
      slug = app.product.slug;
      if (app.holdTransactionId) {
        const hold = await tx.transaction.findUnique({ where: { id: app.holdTransactionId } });
        if (hold && hold.status === "PENDING") {
          await creditAccount(tx, hold.accountId, Math.abs(Number(hold.amount)));
          await tx.transaction.update({
            where: { id: hold.id },
            data: { status: "REJECTED", reviewedAt: new Date(), reviewNote: "Application cancelled by customer." },
          });
        }
      }
      await tx.productApplication.update({ where: { id: app.id }, data: { status: "CANCELLED", reviewedAt: new Date() } });
    });
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    throw e;
  }
  revalidate(slug);
  return { ok: true, message: "Application cancelled. Any held funds have been returned." };
}
