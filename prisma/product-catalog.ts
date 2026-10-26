import type { Prisma, ProductKind } from "@prisma/client";

type CatalogEntry = {
  title: string;
  icon: string;
  description: string;
  slug: string;
  kind: ProductKind;
  summary: string;
  minAmount: number | null;
  options: Prisma.InputJsonValue;
  sortOrder: number;
};

/** Default product content for a fresh install. Admins can change all of it in Settings. */
export const PRODUCT_CATALOG: CatalogEntry[] = [
  {
    title: "TFSA Mutual Funds",
    icon: "fa-chart-pie",
    description: "5.2% avg. return",
    slug: "tfsa-mutual-funds",
    kind: "TFSA_FUNDS",
    summary:
      "Grow your savings tax-free with professionally managed portfolios. Investment growth and withdrawals from a Tax-Free Savings Account are never taxed, and any amount you withdraw is added back to your contribution room the following January.",
    minAmount: 500,
    options: [
      { label: "Conservative Portfolio", rate: 3.8, note: "Low risk · 30% equity / 70% fixed income · MER 1.45%" },
      { label: "Balanced Portfolio", rate: 5.2, note: "Most popular · low-to-medium risk · 60% equity / 40% fixed income · MER 1.75%" },
      { label: "Growth Portfolio", rate: 6.6, note: "Medium risk · 80% equity / 20% fixed income · MER 1.95%" },
      { label: "Canadian Equity Index Fund", rate: 7.1, note: "Medium risk · tracks the S&P/TSX Composite · MER 0.65%" },
    ],
    sortOrder: 1,
  },
  {
    title: "RRSP GIC",
    icon: "fa-umbrella",
    description: "4.1% · 2yr term",
    slug: "rrsp-gic",
    kind: "RRSP_GIC",
    summary:
      "A Guaranteed Investment Certificate held inside your Registered Retirement Savings Plan. Your principal and interest are 100% guaranteed, your contribution is tax-deductible, and growth is tax-sheltered until you withdraw in retirement.",
    minAmount: 500,
    options: [
      { label: "1-year non-redeemable", rate: 3.6, months: 12 },
      { label: "2-year non-redeemable", rate: 4.1, months: 24, note: "Featured rate" },
      { label: "3-year non-redeemable", rate: 3.95, months: 36 },
      { label: "4-year non-redeemable", rate: 3.85, months: 48 },
      { label: "5-year non-redeemable", rate: 3.9, months: 60 },
      { label: "1-year cashable", rate: 2.75, months: 12, note: "Redeemable any time after 30 days" },
    ],
    sortOrder: 2,
  },
  {
    title: "RRIF Income Plan",
    icon: "fa-hand-holding-dollar",
    description: "2.6% payout",
    slug: "rrif-income-plan",
    kind: "RRIF",
    summary:
      "Turn your RRSP savings into a steady retirement income. A Registered Retirement Income Fund keeps your savings tax-sheltered while paying you at least the government minimum each year, on the schedule you choose.",
    minAmount: 1000,
    options: [
      { label: "RRIF Savings (variable)", rate: 2.6, note: "Interest calculated daily, paid monthly · fully flexible" },
      { label: "RRIF 1-year GIC", rate: 3.4, months: 12, note: "Payments drawn from interest and principal" },
      { label: "RRIF 3-year GIC", rate: 3.7, months: 36, note: "Laddered for predictable income" },
    ],
    sortOrder: 3,
  },
  {
    title: "Mortgage pre-approval",
    icon: "fa-house",
    description: "5.1% 5yr fixed",
    slug: "mortgage-pre-approval",
    kind: "MORTGAGE",
    summary:
      "Know exactly how much home you can afford before you start shopping. A pre-approval holds your rate for 120 days, so if rates go up you're protected, and if they go down you get the lower rate.",
    minAmount: null,
    options: [
      { label: "5-year fixed", rate: 5.1, months: 60, note: "Most popular · closed" },
      { label: "3-year fixed", rate: 5.29, months: 36, note: "Closed" },
      { label: "2-year fixed", rate: 5.49, months: 24, note: "Closed" },
      { label: "1-year fixed", rate: 5.79, months: 12, note: "Closed" },
      { label: "5-year variable", rate: 5.45, months: 60, note: "Prime − 0.45% · closed" },
    ],
    sortOrder: 4,
  },
];
