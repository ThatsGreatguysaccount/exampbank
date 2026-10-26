export type AccountView = {
  id: number;
  type: string;
  name: string;
  number: string;
  balance: number;
  icon: string;
  registered: boolean;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  interestRate: number | null;
  trend: number | null;
};

export type TransactionView = {
  id: number;
  accountId: number;
  kind: string;
  status: "PENDING" | "COMPLETED" | "REJECTED";
  title: string;
  description: string | null;
  amount: number;
  icon: string;
  reference: string;
  postedAt: string;
  reviewNote: string | null;
  meta: Record<string, unknown> | null;
};

export type PayeeView = {
  id: number;
  type: "BILL" | "ETRANSFER" | "INTERNATIONAL";
  name: string;
  accountNumber: string | null;
  email: string | null;
  phone: string | null;
  swiftBic: string | null;
  bankName: string | null;
  bankCountry: string | null;
  routingCode: string | null;
  beneficiaryAddress: string | null;
  beneficiaryCity: string | null;
  beneficiaryCountry: string | null;
  currency: string | null;
};

export type ProductView = { id: number; icon: string; title: string; description: string; slug: string | null };

export type ProfileView = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  memberNumber: string | null;
  branch: string | null;
  address: string;
  memberSince: string;
};

export type PublicSettings = {
  bankName: string;
  bankTagline: string;
  brandIcon: string;
  brandMessage: string;
  currency: string;
  locale: string;
  timezone: string;
  footerLeft: string;
  footerRight: string;
  chequeHoldNotice: string;
  wireFee: number;
  wireNotice: string;
};
