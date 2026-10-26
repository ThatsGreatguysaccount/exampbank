import { notFound } from "next/navigation";
import { requireApprovedCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { ageOn, detailRows, parseOptions } from "@/lib/products";
import { ProductClient, type ApplicationView } from "./ProductClient";

export async function generateMetadata({ params }: PageProps<"/dashboard/products/[slug]">) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, active: true }, select: { title: true } });
  return { title: product?.title ?? "Product" };
}

const HIDDEN_FROM_CUSTOMER = new Set(["warnings", "meetsStressTest", "gds", "tds", "qualifyingRate"]);

export default async function ProductPage({ params }: PageProps<"/dashboard/products/[slug]">) {
  const { slug } = await params;
  const user = await requireApprovedCustomer();
  const product = await prisma.product.findFirst({ where: { slug, active: true } });
  if (!product) notFound();
  const settings = await getSettings();
  const fmt = (v: number) => money(v, settings);

  const [accounts, applications] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
    prisma.productApplication.findMany({
      where: { userId: user.id, productId: product.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const apps: ApplicationView[] = applications.map((a) => ({
    id: a.id,
    reference: a.reference,
    status: a.status,
    optionLabel: a.optionLabel,
    rate: a.rate === null ? null : Number(a.rate),
    amount: a.amount === null ? null : Number(a.amount),
    approvedAmount: a.approvedAmount === null ? null : Number(a.approvedAmount),
    createdAt: a.createdAt.toISOString(),
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    adminNote: a.adminNote,
    openedAccount: a.openedAccountId ? (accountName.get(a.openedAccountId) ?? null) : null,
    rows: detailRows(a.details, fmt).filter((r) => !HIDDEN_FROM_CUSTOMER.has(r.key)),
  }));

  return (
    <ProductClient
      settings={{ currency: settings.currency, locale: settings.locale, timezone: settings.timezone }}
      product={{
        id: product.id,
        kind: product.kind,
        title: product.title,
        icon: product.icon,
        description: product.description,
        summary: product.summary,
        minAmount: product.minAmount === null ? null : Number(product.minAmount),
        options: parseOptions(product.options),
      }}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, number: a.number, balance: Number(a.balance) }))}
      applications={apps}
      profile={{
        firstName: user.firstName,
        age: ageOn(user.dateOfBirth),
        birthYear: user.dateOfBirth ? user.dateOfBirth.getUTCFullYear() : null,
      }}
    />
  );
}
