/**
 * Canadian registered-plan and mortgage rules shared by the product pages (calculators,
 * client-side checks) and the server actions (validation). Figures are for the 2026 tax year.
 */

export type ProductKind = "GENERAL" | "TFSA_FUNDS" | "RRSP_GIC" | "RRIF" | "MORTGAGE";
export type ProductOption = { label: string; rate: number; months?: number; note?: string };

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  GENERAL: "General enquiry",
  TFSA_FUNDS: "TFSA investment",
  RRSP_GIC: "RRSP GIC",
  RRIF: "RRIF income",
  MORTGAGE: "Mortgage pre-approval",
};

export const TAX_YEAR = 2026;

export function parseOptions(raw: unknown): ProductOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((o) => {
    if (!o || typeof o !== "object") return [];
    const { label, rate, months, note } = o as Record<string, unknown>;
    const r = Number(rate);
    if (typeof label !== "string" || !label.trim() || !Number.isFinite(r)) return [];
    const m = Number(months);
    return [
      {
        label: label.trim(),
        rate: r,
        ...(Number.isInteger(m) && m > 0 ? { months: m } : {}),
        ...(typeof note === "string" && note.trim() ? { note: note.trim() } : {}),
      },
    ];
  });
}

export function ageOn(dob: Date | string | null | undefined, on = new Date()) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = on.getUTCFullYear() - d.getUTCFullYear();
  const m = on.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function termLabel(months: number | null | undefined) {
  if (!months) return "Open";
  if (months % 12 === 0) return `${months / 12}-year`;
  return `${months}-month`;
}

export function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** Product applications hold funds with a pending transaction; those are settled from the application. */
export function applicationIdOf(meta: unknown) {
  const v = meta && typeof meta === "object" ? (meta as Record<string, unknown>).applicationId : undefined;
  return typeof v === "number" ? v : null;
}

/* ============================== TFSA ============================== */

export const TFSA_ANNUAL_LIMITS: Record<number, number> = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000, 2013: 5500, 2014: 5500, 2015: 10000, 2016: 5500,
  2017: 5500, 2018: 5500, 2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000, 2023: 6500, 2024: 7000,
  2025: 7000, 2026: 7000,
};
export const TFSA_LIMIT_THIS_YEAR = TFSA_ANNUAL_LIMITS[TAX_YEAR];

/** Cumulative room for someone who has never contributed, assuming Canadian residency since 18. */
export function tfsaLifetimeRoom(birthYear: number | null, year = TAX_YEAR) {
  const from = Math.max(2009, birthYear ? birthYear + 18 : 2009);
  let room = 0;
  for (let y = from; y <= year; y++) room += TFSA_ANNUAL_LIMITS[y] ?? 0;
  return { eligibleFrom: from, room };
}

export type GrowthPoint = { year: number; contributed: number; value: number };

/** Month-by-month compounding of an initial deposit plus monthly contributions. */
export function projectGrowth(initial: number, monthly: number, annualRatePct: number, years: number): GrowthPoint[] {
  const r = annualRatePct / 100 / 12;
  let value = Math.max(0, initial);
  let contributed = value;
  const out: GrowthPoint[] = [{ year: 0, contributed, value }];
  for (let m = 1; m <= Math.round(years * 12); m++) {
    value = value * (1 + r) + monthly;
    contributed += monthly;
    if (m % 12 === 0) out.push({ year: m / 12, contributed, value });
  }
  return out;
}

/* ============================== RRSP ============================== */

export const RRSP_DOLLAR_LIMIT = 33_810;
export const RRSP_DEADLINE = "March 1, 2027";
export const RRSP_OVERCONTRIBUTION_BUFFER = 2_000;
export const RRSP_MAX_AGE = 71;

export function rrspDeductionLimit(earnedIncome: number) {
  return Math.min(Math.max(0, earnedIncome) * 0.18, RRSP_DOLLAR_LIMIT);
}

/** GIC interest compounded annually and paid at maturity. */
export function gicSchedule(principal: number, ratePct: number, months: number) {
  const rows: { year: number; interest: number; balance: number }[] = [];
  let balance = principal;
  const fullYears = Math.floor(months / 12);
  for (let y = 1; y <= fullYears; y++) {
    const interest = balance * (ratePct / 100);
    balance += interest;
    rows.push({ year: y, interest, balance });
  }
  const rest = months % 12;
  if (rest) {
    const interest = balance * (ratePct / 100) * (rest / 12);
    balance += interest;
    rows.push({ year: fullYears + rest / 12, interest, balance });
  }
  return { maturity: balance, interest: balance - principal, rows };
}

/* ============================== RRIF ============================== */

/** CRA prescribed minimum withdrawal factors (age at January 1). */
const RRIF_FACTORS: Record<number, number> = {
  71: 5.28, 72: 5.4, 73: 5.53, 74: 5.67, 75: 5.82, 76: 5.98, 77: 6.17, 78: 6.36, 79: 6.58, 80: 6.82,
  81: 7.08, 82: 7.38, 83: 7.71, 84: 8.08, 85: 8.51, 86: 8.99, 87: 9.55, 88: 10.21, 89: 10.99,
  90: 11.92, 91: 13.06, 92: 14.49, 93: 16.34, 94: 18.79,
};

/** Minimum withdrawal as a percentage of the January 1 balance. */
export function rrifMinimumPct(age: number) {
  if (age >= 95) return 20;
  if (age >= 71) return RRIF_FACTORS[age];
  return Math.round((100 / (90 - Math.max(age, 0))) * 100) / 100;
}

/** Withholding tax on amounts above the minimum (rates outside Quebec). */
export function rrifWithholdingPct(excess: number) {
  if (excess <= 0) return 0;
  if (excess <= 5_000) return 10;
  if (excess <= 15_000) return 20;
  return 30;
}

export type RrifRow = { age: number; start: number; minPct: number; minimum: number; withdrawal: number; tax: number; end: number };

export function rrifSchedule(
  balance: number,
  startAge: number,
  ratePct: number,
  mode: "MINIMUM" | "FIXED",
  fixedAnnual = 0,
  untilAge = 95,
): RrifRow[] {
  const rows: RrifRow[] = [];
  let b = balance;
  for (let age = startAge; age <= untilAge && b > 0.005; age++) {
    const minPct = rrifMinimumPct(age);
    const minimum = (b * minPct) / 100;
    const withdrawal = Math.min(b, mode === "FIXED" ? Math.max(fixedAnnual, minimum) : minimum);
    const excess = Math.max(0, withdrawal - minimum);
    const tax = (excess * rrifWithholdingPct(excess)) / 100;
    const end = Math.max(0, (b - withdrawal) * (1 + ratePct / 100));
    rows.push({ age, start: b, minPct, minimum, withdrawal, tax, end });
    b = end;
  }
  return rows;
}

export const RRIF_FREQUENCIES = {
  MONTHLY: { label: "Monthly", perYear: 12 },
  QUARTERLY: { label: "Quarterly", perYear: 4 },
  SEMI_ANNUAL: { label: "Semi-annually", perYear: 2 },
  ANNUAL: { label: "Annually", perYear: 1 },
} as const;
export type RrifFrequency = keyof typeof RRIF_FREQUENCIES;

/* ============================== Mortgage ============================== */

export const MORTGAGE_FREQUENCIES = {
  MONTHLY: { label: "Monthly", perYear: 12 },
  SEMI_MONTHLY: { label: "Semi-monthly", perYear: 24 },
  BI_WEEKLY: { label: "Bi-weekly", perYear: 26 },
  ACC_BI_WEEKLY: { label: "Accelerated bi-weekly", perYear: 26 },
  WEEKLY: { label: "Weekly", perYear: 52 },
  ACC_WEEKLY: { label: "Accelerated weekly", perYear: 52 },
} as const;
export type MortgageFrequency = keyof typeof MORTGAGE_FREQUENCIES;

export const INSURED_PRICE_CAP = 1_500_000;
export const MIN_QUALIFYING_RATE = 5.25;
export const GDS_LIMIT = 39;
export const TDS_LIMIT = 44;
export const RATE_HOLD_DAYS = 120;

export function minimumDownPayment(price: number) {
  if (price <= 0) return 0;
  if (price >= INSURED_PRICE_CAP) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 25_000 + (price - 500_000) * 0.1;
}

/** CMHC-style premium as % of the loan for high-ratio (insured) mortgages. */
export function insurancePremiumPct(loanToValue: number, amortYears: number) {
  if (loanToValue <= 0.8) return 0;
  const base = loanToValue <= 0.85 ? 2.8 : loanToValue <= 0.9 ? 3.1 : 4.0;
  return amortYears > 25 ? base + 0.2 : base;
}

export function qualifyingRate(contractRate: number) {
  return Math.max(contractRate + 2, MIN_QUALIFYING_RATE);
}

/** Effective rate per payment period with Canadian semi-annual compounding. */
function periodRate(ratePct: number, perYear: number) {
  return Math.pow(1 + ratePct / 100 / 2, 2 / perYear) - 1;
}

export function monthlyPayment(principal: number, ratePct: number, amortYears: number) {
  const i = periodRate(ratePct, 12);
  const n = amortYears * 12;
  if (principal <= 0) return 0;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

export function periodicPayment(principal: number, ratePct: number, amortYears: number, freq: MortgageFrequency) {
  const monthly = monthlyPayment(principal, ratePct, amortYears);
  if (freq === "MONTHLY") return monthly;
  if (freq === "ACC_BI_WEEKLY") return monthly / 2;
  if (freq === "ACC_WEEKLY") return monthly / 4;
  const perYear = MORTGAGE_FREQUENCIES[freq].perYear;
  const i = periodRate(ratePct, perYear);
  const n = amortYears * perYear;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/** Balance, interest paid and payoff time when paying `payment` each period. */
export function amortize(principal: number, ratePct: number, payment: number, freq: MortgageFrequency, termYears: number) {
  const perYear = MORTGAGE_FREQUENCIES[freq].perYear;
  const i = periodRate(ratePct, perYear);
  let balance = principal;
  let interestTerm = 0;
  let principalTerm = 0;
  let periods = 0;
  let interestTotal = 0;
  while (balance > 0.005 && periods < 100 * perYear) {
    const interest = balance * i;
    const paid = Math.min(balance, payment - interest);
    if (paid <= 0) break;
    balance -= paid;
    interestTotal += interest;
    periods++;
    if (periods <= termYears * perYear) {
      interestTerm += interest;
      principalTerm += paid;
    }
  }
  const balanceAtTerm = Math.max(0, principal - principalTerm);
  return { interestTerm, principalTerm, balanceAtTerm, interestTotal, payoffYears: periods / perYear };
}

export type MortgageInputs = {
  purchasePrice: number;
  downPayment: number;
  rate: number;
  amortYears: number;
  frequency: MortgageFrequency;
  termMonths: number;
  annualIncome: number;
  monthlyDebts: number;
  propertyTaxYearly: number;
  heatingMonthly: number;
  condoFeesMonthly: number;
};

export function assessMortgage(m: MortgageInputs) {
  const minDown = minimumDownPayment(m.purchasePrice);
  const baseLoan = Math.max(0, m.purchasePrice - m.downPayment);
  const ltv = m.purchasePrice > 0 ? baseLoan / m.purchasePrice : 0;
  const insured = ltv > 0.8;
  const premiumPct = insured ? insurancePremiumPct(ltv, m.amortYears) : 0;
  const premium = (baseLoan * premiumPct) / 100;
  const loan = baseLoan + premium;
  const payment = periodicPayment(loan, m.rate, m.amortYears, m.frequency);
  const monthly = monthlyPayment(loan, m.rate, m.amortYears);
  const term = amortize(loan, m.rate, payment, m.frequency, m.termMonths / 12);
  const qRate = qualifyingRate(m.rate);
  const qualifyingMonthly = monthlyPayment(loan, qRate, m.amortYears);
  const monthlyIncome = m.annualIncome / 12;
  const housing = qualifyingMonthly + m.propertyTaxYearly / 12 + m.heatingMonthly + m.condoFeesMonthly / 2;
  const gds = monthlyIncome > 0 ? (housing / monthlyIncome) * 100 : 0;
  const tds = monthlyIncome > 0 ? ((housing + m.monthlyDebts) / monthlyIncome) * 100 : 0;
  return {
    minDown,
    downOk: m.downPayment >= minDown - 0.005 && m.downPayment <= m.purchasePrice,
    baseLoan,
    ltv,
    insured,
    premiumPct,
    premium,
    loan,
    payment,
    monthly,
    term,
    qRate,
    qualifyingMonthly,
    gds,
    tds,
    qualifies: gds <= GDS_LIMIT && tds <= TDS_LIMIT,
  };
}

/** Highest purchase price that passes the stress test with the given down payment and costs. */
export function maxAffordablePrice(
  m: Omit<MortgageInputs, "purchasePrice" | "propertyTaxYearly"> & { propertyTaxPct: number },
) {
  let lo = 0;
  let hi = 5_000_000;
  for (let k = 0; k < 50; k++) {
    const price = (lo + hi) / 2;
    const a = assessMortgage({ ...m, purchasePrice: price, propertyTaxYearly: (price * m.propertyTaxPct) / 100 });
    if (a.downOk && a.qualifies) lo = price;
    else hi = price;
  }
  return Math.floor(lo / 1000) * 1000;
}

/* ============================== Applications ============================== */

export const RISK_LEVELS = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
export const HORIZONS = { SHORT: "Less than 3 years", MID: "3 to 5 years", LONG: "6 to 10 years", VERY_LONG: "More than 10 years" } as const;
export const KNOWLEDGE = { LIMITED: "Limited", GOOD: "Good", SOPHISTICATED: "Sophisticated" } as const;
export const MATURITY_INSTRUCTIONS = {
  RENEW: "Renew for the same term at the posted rate",
  TRANSFER: "Transfer to RRSP savings at maturity",
} as const;
export const RRIF_SUCCESSION = {
  SUCCESSOR: "Spouse as successor annuitant",
  BENEFICIARY: "Named beneficiary",
  ESTATE: "My estate",
} as const;
export const EMPLOYMENT = {
  FULL_TIME: "Full-time employed",
  PART_TIME: "Part-time employed",
  SELF_EMPLOYED: "Self-employed",
  RETIRED: "Retired / pension",
  OTHER: "Other",
} as const;
export const PROPERTY_TYPES = { DETACHED: "Detached house", SEMI: "Semi-detached", TOWNHOUSE: "Townhouse", CONDO: "Condo / apartment" } as const;
export const DOWN_SOURCES = {
  SAVINGS: "Personal savings",
  GIFT: "Gift from family",
  RRSP_HBP: "RRSP Home Buyers' Plan",
  FHSA: "First Home Savings Account",
  SALE: "Sale of existing property",
} as const;
export const CONTACT_TIMES = { MORNING: "Morning (9–12)", AFTERNOON: "Afternoon (12–5)", EVENING: "Evening (5–8)" } as const;

/** Portfolios at the top of the risk scale need a matching investor profile. */
export function suitabilityConcern(optionRate: number, risk: keyof typeof RISK_LEVELS, horizon: keyof typeof HORIZONS) {
  const aggressive = optionRate >= 6;
  if (aggressive && (risk === "LOW" || horizon === "SHORT")) {
    return "This portfolio may be riskier than your investor profile suggests. An advisor will review it with you.";
  }
  if (risk === "HIGH" && horizon === "SHORT") {
    return "Short time horizons are usually better suited to conservative investments.";
  }
  return null;
}

type Common = { option: string; sourceAccountId?: number; amount?: number };

export type ApplicationInput =
  | (Common & {
      kind: "TFSA_FUNDS";
      monthlyContribution: number;
      contributionDay: number;
      risk: keyof typeof RISK_LEVELS;
      horizon: keyof typeof HORIZONS;
      knowledge: keyof typeof KNOWLEDGE;
      confirmEligible: boolean;
      confirmFundFacts: boolean;
    })
  | (Common & {
      kind: "RRSP_GIC";
      maturity: keyof typeof MATURITY_INSTRUCTIONS;
      earnedIncome: number;
      beneficiaryName: string;
      beneficiaryRelationship: string;
      confirmLimit: boolean;
    })
  | (Common & {
      kind: "RRIF";
      frequency: RrifFrequency;
      paymentType: "MINIMUM" | "FIXED";
      fixedAnnual: number;
      depositAccountId: number;
      useSpouseAge: boolean;
      spouseBirthYear: number;
      succession: keyof typeof RRIF_SUCCESSION;
      beneficiaryName: string;
      confirmTerms: boolean;
    })
  | {
      kind: "MORTGAGE";
      option: string;
      purchasePrice: number;
      downPayment: number;
      downPaymentSource: keyof typeof DOWN_SOURCES;
      amortYears: number;
      frequency: MortgageFrequency;
      firstTimeBuyer: boolean;
      propertyType: keyof typeof PROPERTY_TYPES;
      propertyCity: string;
      employment: keyof typeof EMPLOYMENT;
      employer: string;
      yearsEmployed: number;
      annualIncome: number;
      monthlyDebts: number;
      propertyTaxYearly: number;
      heatingMonthly: number;
      condoFeesMonthly: number;
      consentCredit: boolean;
    }
  | { kind: "GENERAL"; option?: string; contactTime: keyof typeof CONTACT_TIMES; phone: string; message: string };

export type CleanApplication = {
  optionLabel: string | null;
  rate: number | null;
  termMonths: number | null;
  amount: number | null;
  sourceAccountId: number | null;
  details: Record<string, string | number | boolean>;
};

export type ApplicationContext = {
  options: ProductOption[];
  minAmount: number | null;
  age: number | null;
  birthYear: number | null;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const money2 = (v: unknown) => Math.round(num(v) * 100) / 100;
const pick = <T extends Record<string, unknown>>(map: T, v: unknown): keyof T | null =>
  typeof v === "string" && v in map ? (v as keyof T) : null;
const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates an application; returns user-facing errors and soft warnings for the reviewer. */
export function validateApplication(
  input: ApplicationInput,
  ctx: ApplicationContext,
): { ok: false; error: string } | { ok: true; app: CleanApplication; warnings: string[] } {
  const warnings: string[] = [];
  const option = ctx.options.find((o) => o.label === input.option) ?? (input.kind === "GENERAL" ? null : undefined);
  if (option === undefined) return { ok: false, error: "Choose one of the available options." };

  const fund = (i: Common) => {
    const amount = money2(i.amount);
    const min = ctx.minAmount ?? 0;
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount you'd like to invest." };
    if (amount < min) return { error: `The minimum for this product is $${min.toLocaleString("en-CA")}.` };
    if (amount > 1_000_000) return { error: "For amounts over $1,000,000 please book an appointment with an advisor." };
    const sourceAccountId = num(i.sourceAccountId);
    if (!Number.isInteger(sourceAccountId) || sourceAccountId <= 0) return { error: "Choose the account to fund it from." };
    return { amount, sourceAccountId };
  };

  switch (input.kind) {
    case "TFSA_FUNDS": {
      const f = fund(input);
      if ("error" in f) return { ok: false, error: f.error! };
      if (ctx.age !== null && ctx.age < 18) return { ok: false, error: "You must be 18 or older to open a TFSA." };
      const risk = pick(RISK_LEVELS, input.risk);
      const horizon = pick(HORIZONS, input.horizon);
      const knowledge = pick(KNOWLEDGE, input.knowledge);
      if (!risk || !horizon || !knowledge) return { ok: false, error: "Complete your investor profile." };
      if (!input.confirmEligible) return { ok: false, error: "Confirm that you're eligible to contribute to a TFSA." };
      if (!input.confirmFundFacts) return { ok: false, error: "Confirm that you've read the Fund Facts." };
      const monthly = money2(input.monthlyContribution || 0);
      if (!Number.isFinite(monthly) || monthly < 0 || monthly > 10_000) return { ok: false, error: "Enter a valid monthly contribution." };
      const day = num(input.contributionDay || 1);
      if (monthly > 0 && (!Number.isInteger(day) || day < 1 || day > 28)) return { ok: false, error: "Choose a contribution day between 1 and 28." };
      const { room } = tfsaLifetimeRoom(ctx.birthYear);
      if (f.amount > room) return { ok: false, error: `That's more than the maximum possible TFSA room ($${room.toLocaleString("en-CA")}).` };
      if (f.amount > TFSA_LIMIT_THIS_YEAR) warnings.push(`Exceeds the ${TAX_YEAR} annual limit — relies on carried-forward room.`);
      const concern = suitabilityConcern(option!.rate, risk, horizon);
      if (concern) warnings.push(concern);
      return {
        ok: true,
        warnings,
        app: {
          optionLabel: option!.label,
          rate: option!.rate,
          termMonths: null,
          amount: f.amount,
          sourceAccountId: f.sourceAccountId,
          details: {
            risk: RISK_LEVELS[risk],
            horizon: HORIZONS[horizon],
            knowledge: KNOWLEDGE[knowledge],
            monthlyContribution: monthly,
            ...(monthly > 0 ? { contributionDay: day } : {}),
            estimatedLifetimeRoom: room,
          },
        },
      };
    }

    case "RRSP_GIC": {
      const f = fund(input);
      if ("error" in f) return { ok: false, error: f.error! };
      if (ctx.age !== null && ctx.age > RRSP_MAX_AGE) {
        return { ok: false, error: "RRSP contributions end in the year you turn 71. Consider a RRIF instead." };
      }
      const maturity = pick(MATURITY_INSTRUCTIONS, input.maturity);
      if (!maturity) return { ok: false, error: "Choose what happens at maturity." };
      if (!input.confirmLimit) return { ok: false, error: "Confirm the contribution is within your RRSP deduction limit." };
      const income = money2(input.earnedIncome || 0);
      if (income > 0) {
        const limit = rrspDeductionLimit(income);
        if (f.amount > limit + RRSP_OVERCONTRIBUTION_BUFFER) {
          warnings.push(`Amount is above the new room from stated income ($${Math.round(limit).toLocaleString("en-CA")}); relies on unused room.`);
        }
      }
      const beneficiaryName = text(input.beneficiaryName, 80);
      return {
        ok: true,
        warnings,
        app: {
          optionLabel: option!.label,
          rate: option!.rate,
          termMonths: option!.months ?? 12,
          amount: f.amount,
          sourceAccountId: f.sourceAccountId,
          details: {
            maturityInstruction: MATURITY_INSTRUCTIONS[maturity],
            ...(income > 0 ? { earnedIncome: income } : {}),
            ...(beneficiaryName
              ? { beneficiary: beneficiaryName, relationship: text(input.beneficiaryRelationship, 40) || "Not specified" }
              : {}),
          },
        },
      };
    }

    case "RRIF": {
      const f = fund(input);
      if ("error" in f) return { ok: false, error: f.error! };
      const frequency = pick(RRIF_FREQUENCIES, input.frequency);
      if (!frequency) return { ok: false, error: "Choose how often you'd like to be paid." };
      const depositAccountId = num(input.depositAccountId);
      if (!Number.isInteger(depositAccountId) || depositAccountId <= 0) return { ok: false, error: "Choose where payments should go." };
      const succession = pick(RRIF_SUCCESSION, input.succession);
      if (!succession) return { ok: false, error: "Choose who receives the plan on death." };
      const beneficiaryName = text(input.beneficiaryName, 80);
      if (succession !== "ESTATE" && !beneficiaryName) return { ok: false, error: "Enter the name of your successor or beneficiary." };
      if (!input.confirmTerms) return { ok: false, error: "Confirm that you understand the minimum withdrawal rules." };

      let age = ctx.age ?? 71;
      if (input.useSpouseAge) {
        const y = num(input.spouseBirthYear);
        if (!Number.isInteger(y) || y < 1900 || y > TAX_YEAR - 18) return { ok: false, error: "Enter your spouse's birth year." };
        age = TAX_YEAR - y;
      }
      if (ctx.age !== null && ctx.age < 55) warnings.push("Customer is under 55 — confirm early RRIF conversion is intended.");
      const minPct = rrifMinimumPct(age + 1);
      const minimumNextYear = (f.amount * minPct) / 100;
      const paymentType = input.paymentType === "FIXED" ? "FIXED" : "MINIMUM";
      const fixed = money2(input.fixedAnnual || 0);
      if (paymentType === "FIXED" && (!Number.isFinite(fixed) || fixed < minimumNextYear || fixed > f.amount)) {
        return {
          ok: false,
          error: `A fixed payment must be between the minimum (${Math.ceil(minimumNextYear).toLocaleString("en-CA")}/yr) and the plan value.`,
        };
      }
      const annual = paymentType === "FIXED" ? fixed : minimumNextYear;
      return {
        ok: true,
        warnings,
        app: {
          optionLabel: option!.label,
          rate: option!.rate,
          termMonths: option!.months ?? null,
          amount: f.amount,
          sourceAccountId: f.sourceAccountId,
          details: {
            paymentFrequency: RRIF_FREQUENCIES[frequency].label,
            paymentType: paymentType === "FIXED" ? "Fixed amount" : "Government minimum",
            annualPayment: Math.round(annual * 100) / 100,
            paymentPerInstalment: Math.round((annual / RRIF_FREQUENCIES[frequency].perYear) * 100) / 100,
            minimumPctNextYear: minPct,
            basedOnAge: input.useSpouseAge ? `Spouse's age (${age})` : `Own age (${age})`,
            depositAccountId,
            succession: RRIF_SUCCESSION[succession],
            ...(beneficiaryName ? { beneficiary: beneficiaryName } : {}),
          },
        },
      };
    }

    case "MORTGAGE": {
      const price = money2(input.purchasePrice);
      const down = money2(input.downPayment);
      const income = money2(input.annualIncome);
      if (!(price >= 50_000 && price <= 5_000_000)) return { ok: false, error: "Enter a purchase price between $50,000 and $5,000,000." };
      if (!(down >= 0)) return { ok: false, error: "Enter your down payment." };
      if (!(income > 0)) return { ok: false, error: "Enter your gross annual household income." };
      const employment = pick(EMPLOYMENT, input.employment);
      const propertyType = pick(PROPERTY_TYPES, input.propertyType);
      const downSource = pick(DOWN_SOURCES, input.downPaymentSource);
      const frequency = pick(MORTGAGE_FREQUENCIES, input.frequency);
      if (!employment || !propertyType || !downSource || !frequency) return { ok: false, error: "Complete all required fields." };
      const city = text(input.propertyCity, 60);
      if (!city) return { ok: false, error: "Enter the city where you're buying." };
      if (!input.consentCredit) return { ok: false, error: "We need your consent to check your credit report." };
      const amortYears = num(input.amortYears);
      if (![15, 20, 25, 30].includes(amortYears)) return { ok: false, error: "Choose an amortization period." };

      const inputs: MortgageInputs = {
        purchasePrice: price,
        downPayment: down,
        rate: option!.rate,
        amortYears,
        frequency,
        termMonths: option!.months ?? 60,
        annualIncome: income,
        monthlyDebts: Math.max(0, money2(input.monthlyDebts || 0)),
        propertyTaxYearly: Math.max(0, money2(input.propertyTaxYearly || 0)),
        heatingMonthly: Math.max(0, money2(input.heatingMonthly || 0)),
        condoFeesMonthly: propertyType === "CONDO" ? Math.max(0, money2(input.condoFeesMonthly || 0)) : 0,
      };
      const a = assessMortgage(inputs);
      if (down > price) return { ok: false, error: "Down payment can't be more than the purchase price." };
      if (!a.downOk) {
        return { ok: false, error: `The minimum down payment for this price is $${Math.ceil(a.minDown).toLocaleString("en-CA")}.` };
      }
      if (a.insured && amortYears > 25 && !input.firstTimeBuyer) {
        return { ok: false, error: "30-year amortization with less than 20% down is only available to first-time buyers." };
      }
      if (!a.qualifies) {
        warnings.push(`Stress test not met: GDS ${a.gds.toFixed(1)}% / TDS ${a.tds.toFixed(1)}% (limits ${GDS_LIMIT}% / ${TDS_LIMIT}%).`);
      }
      if (employment === "SELF_EMPLOYED") warnings.push("Self-employed: request 2 years of T1 Generals and Notices of Assessment.");
      if (num(input.yearsEmployed) < 1 && employment !== "RETIRED") warnings.push("Less than 1 year with current employer (probation check).");
      return {
        ok: true,
        warnings,
        app: {
          optionLabel: option!.label,
          rate: option!.rate,
          termMonths: option!.months ?? 60,
          amount: Math.round(a.loan * 100) / 100,
          sourceAccountId: null,
          details: {
            purchasePrice: price,
            downPayment: down,
            downPaymentPct: Math.round((down / price) * 1000) / 10,
            downPaymentSource: DOWN_SOURCES[downSource],
            insured: a.insured,
            insurancePremium: Math.round(a.premium * 100) / 100,
            amortizationYears: amortYears,
            paymentFrequency: MORTGAGE_FREQUENCIES[frequency].label,
            payment: Math.round(a.payment * 100) / 100,
            qualifyingRate: Math.round(a.qRate * 100) / 100,
            gds: Math.round(a.gds * 10) / 10,
            tds: Math.round(a.tds * 10) / 10,
            meetsStressTest: a.qualifies,
            firstTimeBuyer: Boolean(input.firstTimeBuyer),
            propertyType: PROPERTY_TYPES[propertyType],
            propertyCity: city,
            employment: EMPLOYMENT[employment],
            employer: text(input.employer, 80) || "—",
            yearsEmployed: Math.max(0, Math.round(num(input.yearsEmployed) * 10) / 10 || 0),
            annualIncome: income,
            monthlyDebts: inputs.monthlyDebts,
            propertyTaxYearly: inputs.propertyTaxYearly,
            heatingMonthly: inputs.heatingMonthly,
            ...(inputs.condoFeesMonthly ? { condoFeesMonthly: inputs.condoFeesMonthly } : {}),
          },
        },
      };
    }

    case "GENERAL": {
      const time = pick(CONTACT_TIMES, input.contactTime);
      if (!time) return { ok: false, error: "Choose a time for us to call." };
      const phone = text(input.phone, 30);
      if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Enter a phone number we can reach you at." };
      return {
        ok: true,
        warnings,
        app: {
          optionLabel: option?.label ?? null,
          rate: option?.rate ?? null,
          termMonths: option?.months ?? null,
          amount: null,
          sourceAccountId: null,
          details: { contactTime: CONTACT_TIMES[time], phone, message: text(input.message, 500) || "—" },
        },
      };
    }
  }
}

/** Human labels for stored application details, used on admin and customer screens. */
export const DETAIL_LABELS: Record<string, string> = {
  risk: "Risk tolerance",
  horizon: "Time horizon",
  knowledge: "Investment knowledge",
  monthlyContribution: "Pre-authorized monthly contribution",
  contributionDay: "Contribution day of month",
  estimatedLifetimeRoom: "Max. possible TFSA room",
  maturityInstruction: "At maturity",
  earnedIncome: "Previous-year earned income",
  beneficiary: "Beneficiary / successor",
  relationship: "Relationship",
  paymentFrequency: "Payment frequency",
  paymentType: "Payment amount",
  annualPayment: "Annual payment",
  paymentPerInstalment: "Per payment",
  minimumPctNextYear: "Minimum withdrawal next year (%)",
  basedOnAge: "Minimum based on",
  depositAccount: "Payments deposited to",
  succession: "On death",
  purchasePrice: "Purchase price",
  downPayment: "Down payment",
  downPaymentPct: "Down payment (%)",
  downPaymentSource: "Down payment source",
  insured: "Mortgage default insurance",
  insurancePremium: "Insurance premium (added to loan)",
  amortizationYears: "Amortization (years)",
  payment: "Payment at contract rate",
  qualifyingRate: "Stress-test rate (%)",
  gds: "GDS ratio (%)",
  tds: "TDS ratio (%)",
  meetsStressTest: "Meets stress test",
  firstTimeBuyer: "First-time buyer",
  propertyType: "Property type",
  propertyCity: "City",
  employment: "Employment",
  employer: "Employer",
  yearsEmployed: "Years with employer",
  annualIncome: "Gross annual income",
  monthlyDebts: "Other monthly debt payments",
  propertyTaxYearly: "Property tax (yearly)",
  heatingMonthly: "Heating (monthly)",
  condoFeesMonthly: "Condo fees (monthly)",
  contactTime: "Best time to call",
  phone: "Phone",
  message: "Message",
  warnings: "Reviewer flags",
  rateHeldUntil: "Rate held until",
  sourceAccount: "Funded from",
  maturityDate: "Maturity date",
};

const MONEY_KEYS = new Set([
  "monthlyContribution",
  "estimatedLifetimeRoom",
  "earnedIncome",
  "annualPayment",
  "paymentPerInstalment",
  "purchasePrice",
  "downPayment",
  "insurancePremium",
  "payment",
  "annualIncome",
  "monthlyDebts",
  "propertyTaxYearly",
  "heatingMonthly",
  "condoFeesMonthly",
]);

const DETAIL_ORDER = Object.keys(DETAIL_LABELS);
const detailRank = (k: string) => {
  const i = DETAIL_ORDER.indexOf(k);
  return i === -1 ? DETAIL_ORDER.length : i;
};

// MySQL stores JSON object keys sorted, so display order comes from DETAIL_LABELS.
export function detailRows(details: unknown, fmtMoney: (n: number) => string) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>)
    .filter(([k, v]) => k !== "depositAccountId" && v !== null && v !== undefined && v !== "")
    .sort(([a], [b]) => detailRank(a) - detailRank(b))
    .map(([k, v]) => {
      let value: string;
      if (typeof v === "boolean") value = v ? "Yes" : "No";
      else if (Array.isArray(v)) value = v.join(" · ");
      else if (typeof v === "number" && MONEY_KEYS.has(k)) value = fmtMoney(v);
      else value = String(v);
      return { key: k, label: DETAIL_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), value };
    });
}
