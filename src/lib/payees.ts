/** Payee rules shared by the dashboard forms and the server actions. */

export type PayeeType = "BILL" | "ETRANSFER" | "INTERNATIONAL";

export const PAYEE_TYPE_LABELS: Record<PayeeType, string> = {
  BILL: "Bill payee",
  ETRANSFER: "Interac e-Transfer",
  INTERNATIONAL: "International wire",
};

export const PAYEE_TYPE_ICONS: Record<PayeeType, string> = {
  BILL: "fa-file-invoice",
  ETRANSFER: "fa-paper-plane",
  INTERNATIONAL: "fa-globe",
};

/** ISO 3166 code → [name, default currency, IBAN length if the country uses IBAN]. */
export const COUNTRIES: Record<string, [string, string, number?]> = {
  AE: ["United Arab Emirates", "AED", 23],
  AR: ["Argentina", "ARS"],
  AT: ["Austria", "EUR", 20],
  AU: ["Australia", "AUD"],
  BE: ["Belgium", "EUR", 16],
  BG: ["Bulgaria", "BGN", 22],
  BH: ["Bahrain", "BHD", 22],
  BR: ["Brazil", "BRL", 29],
  CA: ["Canada", "CAD"],
  CH: ["Switzerland", "CHF", 21],
  CL: ["Chile", "CLP"],
  CN: ["China", "CNY"],
  CO: ["Colombia", "COP"],
  CY: ["Cyprus", "EUR", 28],
  CZ: ["Czech Republic", "CZK", 24],
  DE: ["Germany", "EUR", 22],
  DK: ["Denmark", "DKK", 18],
  EE: ["Estonia", "EUR", 20],
  EG: ["Egypt", "EGP", 29],
  ES: ["Spain", "EUR", 24],
  FI: ["Finland", "EUR", 18],
  FR: ["France", "EUR", 27],
  GB: ["United Kingdom", "GBP", 22],
  GE: ["Georgia", "GEL", 22],
  GH: ["Ghana", "GHS"],
  GR: ["Greece", "EUR", 27],
  HK: ["Hong Kong", "HKD"],
  HR: ["Croatia", "EUR", 21],
  HU: ["Hungary", "HUF", 28],
  ID: ["Indonesia", "IDR"],
  IE: ["Ireland", "EUR", 22],
  IL: ["Israel", "ILS", 23],
  IN: ["India", "INR"],
  IS: ["Iceland", "ISK", 26],
  IT: ["Italy", "EUR", 27],
  JM: ["Jamaica", "JMD"],
  JO: ["Jordan", "JOD", 30],
  JP: ["Japan", "JPY"],
  KE: ["Kenya", "KES"],
  KR: ["South Korea", "KRW"],
  KW: ["Kuwait", "KWD", 30],
  KZ: ["Kazakhstan", "KZT", 20],
  LB: ["Lebanon", "LBP", 28],
  LT: ["Lithuania", "EUR", 20],
  LU: ["Luxembourg", "EUR", 20],
  LV: ["Latvia", "EUR", 21],
  MA: ["Morocco", "MAD"],
  MT: ["Malta", "EUR", 31],
  MX: ["Mexico", "MXN"],
  MY: ["Malaysia", "MYR"],
  NG: ["Nigeria", "NGN"],
  NL: ["Netherlands", "EUR", 18],
  NO: ["Norway", "NOK", 15],
  NZ: ["New Zealand", "NZD"],
  PH: ["Philippines", "PHP"],
  PK: ["Pakistan", "PKR", 24],
  PL: ["Poland", "PLN", 28],
  PT: ["Portugal", "EUR", 25],
  QA: ["Qatar", "QAR", 29],
  RO: ["Romania", "RON", 24],
  RS: ["Serbia", "RSD", 22],
  SA: ["Saudi Arabia", "SAR", 24],
  SE: ["Sweden", "SEK", 24],
  SG: ["Singapore", "SGD"],
  SI: ["Slovenia", "EUR", 19],
  SK: ["Slovakia", "EUR", 24],
  TH: ["Thailand", "THB"],
  TR: ["Turkey", "TRY", 26],
  TW: ["Taiwan", "TWD"],
  UA: ["Ukraine", "UAH", 29],
  US: ["United States", "USD"],
  VN: ["Vietnam", "VND"],
  ZA: ["South Africa", "ZAR"],
};

export const COUNTRY_OPTIONS = Object.entries(COUNTRIES)
  .map(([code, [name]]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const WIRE_CURRENCIES = [
  ...new Set(["USD", "EUR", "GBP", "CAD", ...Object.values(COUNTRIES).map(([, currency]) => currency)]),
];

export const WIRE_PURPOSES = [
  "Family support",
  "Payment for goods",
  "Payment for services",
  "Tuition / education",
  "Salary / payroll",
  "Rent or property purchase",
  "Investment",
  "Loan repayment",
  "Gift",
  "Personal savings transfer",
  "Other",
];

export function countryName(code: string | null | undefined) {
  return code ? (COUNTRIES[code]?.[0] ?? code) : "";
}

/** Label for the national bank code that some countries need in addition to the account number. */
export function routingLabel(country: string | null | undefined) {
  switch (country) {
    case "US":
      return "ABA routing number";
    case "GB":
      return "Sort code";
    case "IN":
      return "IFSC code";
    case "AU":
      return "BSB number";
    case "CA":
      return "Transit and institution number";
    case "MX":
      return "CLABE";
    case "ZA":
      return "Branch code";
    default:
      return "Bank / routing code";
  }
}

export function routingRequired(country: string | null | undefined) {
  return country === "US" || country === "GB" || country === "IN" || country === "AU" || country === "CA";
}

export const SWIFT_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function normalizeSwift(v: string) {
  return v.replace(/\s+/g, "").toUpperCase();
}

/** Country encoded in a SWIFT/BIC (characters 5–6), if it looks valid. */
export function swiftCountry(swift: string) {
  const s = normalizeSwift(swift);
  return SWIFT_RE.test(s) ? s.slice(4, 6) : null;
}

export function normalizeIban(v: string) {
  return v.replace(/[\s-]+/g, "").toUpperCase();
}

export function looksLikeIban(v: string) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalizeIban(v));
}

/** Validates an IBAN's country length and ISO 7064 mod-97 checksum. */
export function ibanError(raw: string): string | null {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return "The IBAN format is not valid.";
  const expected = COUNTRIES[iban.slice(0, 2)]?.[2];
  if (expected && iban.length !== expected) {
    return `IBANs for ${countryName(iban.slice(0, 2))} have ${expected} characters (you entered ${iban.length}).`;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1 ? null : "The IBAN check digits don't match. Please double-check it.";
}

export function formatIban(v: string) {
  return normalizeIban(v).replace(/(.{4})/g, "$1 ").trim();
}

export function maskAccount(v: string | null | undefined) {
  if (!v) return "";
  const clean = v.replace(/\s+/g, "");
  return clean.length <= 4 ? clean : `•••• ${clean.slice(-4)}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Canadian / North American mobile numbers: 10 digits, optional leading 1. */
export function normalizePhone(v: string) {
  const digits = v.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{9}$/.test(ten) ? ten : null;
}

export function formatPhone(v: string | null | undefined) {
  if (!v) return "";
  return v.length === 10 ? `(${v.slice(0, 3)}) ${v.slice(3, 6)}-${v.slice(6)}` : v;
}

export type PayeeInput =
  | { type: "BILL"; name: string; accountNumber: string }
  | { type: "ETRANSFER"; name: string; email?: string; phone?: string }
  | {
      type: "INTERNATIONAL";
      name: string;
      beneficiaryAddress: string;
      beneficiaryCity: string;
      beneficiaryCountry: string;
      bankName: string;
      swiftBic: string;
      accountNumber: string;
      routingCode?: string;
      currency: string;
    };

export type CleanPayee = {
  type: PayeeType;
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

const text = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** Validates and normalizes payee input. Returns an error message or the cleaned record. */
export function validatePayee(input: PayeeInput): { ok: false; error: string } | { ok: true; payee: CleanPayee } {
  const base: CleanPayee = {
    type: input.type,
    name: text(input.name, 80),
    accountNumber: null,
    email: null,
    phone: null,
    swiftBic: null,
    bankName: null,
    bankCountry: null,
    routingCode: null,
    beneficiaryAddress: null,
    beneficiaryCity: null,
    beneficiaryCountry: null,
    currency: null,
  };
  if (base.name.length < 2) {
    return { ok: false, error: input.type === "INTERNATIONAL" ? "Enter the beneficiary's full name." : "Enter the payee name." };
  }

  if (input.type === "BILL") {
    const accountNumber = text(input.accountNumber, 40);
    if (!accountNumber) return { ok: false, error: "Enter your account / reference number with this payee." };
    return { ok: true, payee: { ...base, accountNumber } };
  }

  if (input.type === "ETRANSFER") {
    const email = text(input.email, 120).toLowerCase();
    const phoneRaw = text(input.phone, 30);
    if (email) {
      if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
      return { ok: true, payee: { ...base, email } };
    }
    if (!phoneRaw) return { ok: false, error: "Enter the contact's email or mobile number." };
    const phone = normalizePhone(phoneRaw);
    if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };
    return { ok: true, payee: { ...base, phone } };
  }

  const beneficiaryCountry = text(input.beneficiaryCountry, 2).toUpperCase();
  if (!COUNTRIES[beneficiaryCountry]) return { ok: false, error: "Choose the beneficiary's country." };
  const beneficiaryAddress = text(input.beneficiaryAddress, 120);
  const beneficiaryCity = text(input.beneficiaryCity, 60);
  if (!beneficiaryAddress || !beneficiaryCity) return { ok: false, error: "Enter the beneficiary's street address and city." };

  const swiftBic = normalizeSwift(String(input.swiftBic ?? ""));
  if (!SWIFT_RE.test(swiftBic)) return { ok: false, error: "Enter a valid SWIFT / BIC code (8 or 11 characters)." };
  const bankCountry = swiftBic.slice(4, 6);
  if (!COUNTRIES[bankCountry]) return { ok: false, error: "We can't send wires to the country of this SWIFT / BIC code." };
  const bankName = text(input.bankName, 100);
  if (bankName.length < 2) return { ok: false, error: "Enter the beneficiary's bank name." };

  const usesIban = Boolean(COUNTRIES[bankCountry][2]);
  let accountNumber = String(input.accountNumber ?? "").trim();
  if (usesIban || looksLikeIban(accountNumber)) {
    const err = ibanError(accountNumber);
    if (err) return { ok: false, error: usesIban ? `${countryName(bankCountry)} uses IBANs. ${err}` : err };
    accountNumber = normalizeIban(accountNumber);
    if (accountNumber.slice(0, 2) !== bankCountry) {
      return { ok: false, error: "The IBAN country doesn't match the bank's SWIFT / BIC country." };
    }
  } else {
    accountNumber = accountNumber.replace(/[\s-]+/g, "").toUpperCase();
    if (!/^[A-Z0-9]{4,34}$/.test(accountNumber)) return { ok: false, error: "Enter the beneficiary's account number." };
  }

  const routingCode = text(input.routingCode, 30).replace(/[\s-]/g, "").toUpperCase() || null;
  if (!usesIban && routingRequired(bankCountry) && !routingCode) {
    return { ok: false, error: `Enter the ${routingLabel(bankCountry)} for this bank.` };
  }
  if (bankCountry === "US" && routingCode && !/^\d{9}$/.test(routingCode)) {
    return { ok: false, error: "ABA routing numbers have 9 digits." };
  }
  if (bankCountry === "GB" && routingCode && !/^\d{6}$/.test(routingCode)) {
    return { ok: false, error: "UK sort codes have 6 digits." };
  }
  if (bankCountry === "IN" && routingCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(routingCode)) {
    return { ok: false, error: "IFSC codes have 11 characters, e.g. HDFC0001234." };
  }

  const currency = text(input.currency, 3).toUpperCase();
  if (!WIRE_CURRENCIES.includes(currency)) return { ok: false, error: "Choose the currency the beneficiary will receive." };

  return {
    ok: true,
    payee: {
      ...base,
      accountNumber,
      swiftBic,
      bankName,
      bankCountry,
      routingCode,
      beneficiaryAddress,
      beneficiaryCity,
      beneficiaryCountry,
      currency,
    },
  };
}
