import { requireApprovedCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ACCOUNT_TYPES } from "@/lib/banking";
import type { AccountView, PublicSettings, TransactionView } from "@/lib/view-types";
import { DashboardClient } from "./DashboardClient";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function DashboardPage() {
  const user = await requireApprovedCustomer();
  const settings = await getSettings();

  const accounts = await prisma.account.findMany({
    where: { userId: user.id, status: { not: "CLOSED" } },
    orderBy: [{ createdAt: "asc" }],
  });
  const accountIds = accounts.map((a) => a.id);

  const since = daysAgo(30);
  const [transactions, recentNet, products, payees] = await Promise.all([
    prisma.transaction.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      take: 300,
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { accountId: { in: accountIds }, status: "COMPLETED", postedAt: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.payee.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        type: true,
        name: true,
        accountNumber: true,
        email: true,
        phone: true,
        swiftBic: true,
        bankName: true,
        bankCountry: true,
        routingCode: true,
        beneficiaryAddress: true,
        beneficiaryCity: true,
        beneficiaryCountry: true,
        currency: true,
      },
    }),
  ]);

  const netByAccount = new Map(recentNet.map((r) => [r.accountId, Number(r._sum.amount ?? 0)]));

  const accountViews: AccountView[] = accounts.map((a) => {
    const balance = Number(a.balance);
    const net = netByAccount.get(a.id) ?? 0;
    const start = balance - net;
    const meta = ACCOUNT_TYPES[a.type];
    return {
      id: a.id,
      type: a.type,
      name: a.name,
      number: a.number,
      balance,
      icon: meta.icon,
      registered: meta.registered,
      status: a.status,
      interestRate: a.interestRate === null ? null : Number(a.interestRate),
      trend: start > 0 && net !== 0 ? Math.round((net / start) * 1000) / 10 : null,
    };
  });

  const txViews: TransactionView[] = transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    kind: t.kind,
    status: t.status,
    title: t.title,
    description: t.description,
    amount: Number(t.amount),
    icon: t.icon,
    reference: t.reference,
    postedAt: t.postedAt.toISOString(),
    reviewNote: t.reviewNote,
    meta: t.meta && typeof t.meta === "object" && !Array.isArray(t.meta) ? (t.meta as Record<string, unknown>) : null,
  }));

  const publicSettings: PublicSettings = {
    bankName: settings.bankName,
    bankTagline: settings.bankTagline,
    brandIcon: settings.brandIcon,
    brandMessage: settings.brandMessage,
    currency: settings.currency,
    locale: settings.locale,
    timezone: settings.timezone,
    footerLeft: settings.footerLeft,
    footerRight: settings.footerRight,
    chequeHoldNotice: settings.chequeHoldNotice,
    wireFee: Math.max(0, Number(settings.wireFee) || 0),
    wireNotice: settings.wireNotice,
  };

  const address = [user.addressLine, user.city, user.province, user.postalCode, user.country].filter(Boolean).join(", ");

  return (
    <DashboardClient
      settings={publicSettings}
      accounts={accountViews}
      transactions={txViews}
      products={products.map((p) => ({ id: p.id, icon: p.icon, title: p.title, description: p.description, slug: p.slug }))}
      payees={payees}
      profile={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        memberNumber: user.memberNumber,
        branch: user.branch,
        address,
        memberSince: String(user.createdAt.getFullYear()),
      }}
    />
  );
}
