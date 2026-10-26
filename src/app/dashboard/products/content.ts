import type { ProductKind } from "@/lib/products";
import {
  RATE_HOLD_DAYS,
  RRSP_DEADLINE,
  RRSP_DOLLAR_LIMIT,
  TAX_YEAR,
  TFSA_LIMIT_THIS_YEAR,
} from "@/lib/products";

export type ProductContent = {
  eyebrow: string;
  applyLabel: string;
  rateHeading: string;
  rateColumn: string;
  features: { icon: string; title: string; text: string }[];
  steps: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  legal: string[];
};

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

const DEPOSIT_GUARANTEE =
  "Deposits, including registered plan deposits and GICs, are 100% guaranteed by the Credit Union Deposit Guarantee Corporation (CUDGC) of Saskatchewan.";

export const PRODUCT_CONTENT: Record<ProductKind, ProductContent> = {
  TFSA_FUNDS: {
    eyebrow: "Tax-Free Savings Account",
    applyLabel: "Open a TFSA investment",
    rateHeading: "Portfolios available in your TFSA",
    rateColumn: "Avg. annual return (5-yr)",
    features: [
      { icon: "fa-leaf", title: "100% tax-free growth", text: "Interest, dividends and capital gains earned inside a TFSA are never taxed — not even when you withdraw." },
      { icon: "fa-rotate-left", title: "Withdraw any time", text: "Take money out for any reason. Whatever you withdraw is added back to your contribution room on January 1." },
      { icon: "fa-user-tie", title: "Professionally managed", text: "Diversified portfolios rebalanced by our investment team so they stay true to your risk level." },
      { icon: "fa-calendar-check", title: "Pre-authorized contributions", text: "Invest automatically from chequing every month — start with as little as $25 per contribution." },
    ],
    steps: [
      { title: "Build your investor profile", text: "Tell us your risk tolerance, time horizon and investment experience (Know-Your-Client)." },
      { title: "Choose a portfolio", text: "Pick the portfolio that fits your profile. We'll flag anything that may be too aggressive." },
      { title: "Fund it from your account", text: "Your initial investment is held from the account you choose until a licensed advisor approves it." },
      { title: "Track it on your dashboard", text: "Your new TFSA appears alongside your other accounts as soon as it's opened." },
    ],
    faqs: [
      {
        q: `How much can I contribute in ${TAX_YEAR}?`,
        a: `The annual TFSA dollar limit for ${TAX_YEAR} is ${cad(TFSA_LIMIT_THIS_YEAR)}. Unused room carries forward, so if you were 18 or older and a resident of Canada in 2009 and have never contributed, your total room is ${cad(109_000)}. Your exact room is on your CRA My Account.`,
      },
      {
        q: "What happens if I over-contribute?",
        a: "The CRA charges a 1% tax per month on the highest excess amount in each month until it's withdrawn. Withdrawals only restore room the following calendar year, so re-contributing in the same year can cause an over-contribution.",
      },
      {
        q: "Are mutual funds guaranteed?",
        a: "No. Unlike deposits and GICs, mutual funds are not guaranteed by CUDGC or any government deposit insurer. Their values change frequently and past performance may not be repeated.",
      },
      {
        q: "What does the MER mean?",
        a: "The Management Expense Ratio is the annual cost of running the fund, expressed as a percentage of its value. It's already deducted from the returns shown.",
      },
      {
        q: "Can I hold a TFSA if I leave Canada?",
        a: "You can keep your TFSA and growth stays tax-free in Canada, but you can't contribute while you're a non-resident. Your new country may tax the income.",
      },
    ],
    legal: [
      "Mutual funds are offered through Prairie CU Investment Services Inc. Commissions, trailing commissions, management fees and expenses may all be associated with mutual fund investments. Please read the Fund Facts before investing.",
      "Returns shown are historical annual compounded total returns over 5 years, net of fees, and are not guaranteed. Mutual funds are not guaranteed, their values change frequently and past performance may not be repeated.",
    ],
  },

  RRSP_GIC: {
    eyebrow: "Registered Retirement Savings Plan",
    applyLabel: "Buy an RRSP GIC",
    rateHeading: "RRSP GIC rates",
    rateColumn: "Annual rate",
    features: [
      { icon: "fa-shield-halved", title: "Principal 100% guaranteed", text: "Your money and the interest it earns are fully guaranteed — no market risk." },
      { icon: "fa-receipt", title: "Lower your taxes today", text: "Contributions are deducted from your taxable income, which often means a bigger tax refund." },
      { icon: "fa-seedling", title: "Tax-sheltered growth", text: "Interest compounds inside your RRSP and isn't taxed until you withdraw it in retirement." },
      { icon: "fa-house-chimney", title: "Home Buyers' Plan ready", text: "First-time buyers can withdraw up to $60,000 tax-free for a home and repay it over 15 years." },
    ],
    steps: [
      { title: "Choose a term", text: "Lock in a guaranteed rate from 1 to 5 years, or keep access with a cashable GIC." },
      { title: "Fund your GIC", text: "Move money from chequing or savings — the contribution counts towards your deduction limit." },
      { title: "Get your tax slip", text: "We'll send your RRSP contribution receipt for the first 60 days of the year or the rest of the year." },
      { title: "Decide at maturity", text: "Renew automatically at the posted rate or move the funds to RRSP savings." },
    ],
    faqs: [
      {
        q: `What's the ${TAX_YEAR} RRSP contribution deadline?`,
        a: `Contributions made by ${RRSP_DEADLINE} can be deducted on your ${TAX_YEAR} tax return.`,
      },
      {
        q: "How much can I contribute?",
        a: `Your deduction limit is 18% of last year's earned income up to ${cad(RRSP_DOLLAR_LIMIT)} for ${TAX_YEAR}, plus any unused room from prior years, minus any pension adjustment. It's printed on your Notice of Assessment.`,
      },
      {
        q: "Can I cash a non-redeemable GIC early?",
        a: "Non-redeemable GICs can't be cashed before maturity except in exceptional circumstances such as death. Choose the 1-year cashable GIC if you may need the money sooner.",
      },
      {
        q: "What happens at 71?",
        a: "You must close your RRSP by December 31 of the year you turn 71 — usually by converting it to a RRIF so your savings stay tax-sheltered.",
      },
      {
        q: "How is interest paid?",
        a: "Interest is compounded annually and paid at maturity. For terms longer than one year, each year's interest earns interest too.",
      },
    ],
    legal: [
      DEPOSIT_GUARANTEE,
      "Rates are annual, subject to change without notice and are those in effect on the day your GIC is opened. Minimum investment applies. Tax refund estimates are illustrations only and depend on your personal tax situation.",
    ],
  },

  RRIF: {
    eyebrow: "Registered Retirement Income Fund",
    applyLabel: "Start my RRIF income",
    rateHeading: "Where your RRIF is invested",
    rateColumn: "Annual rate",
    features: [
      { icon: "fa-money-bill-wave", title: "Reliable retirement income", text: "Choose monthly, quarterly, semi-annual or annual payments deposited straight to your account." },
      { icon: "fa-umbrella", title: "Still tax-sheltered", text: "Money left in your RRIF keeps growing tax-deferred. You only pay tax on what you withdraw." },
      { icon: "fa-user-group", title: "Use your spouse's age", text: "Basing minimums on a younger spouse's age lowers required withdrawals and stretches your savings." },
      { icon: "fa-percent", title: "No withholding on the minimum", text: "We don't withhold tax on the government minimum — only on amounts you take above it." },
    ],
    steps: [
      { title: "Choose how it's invested", text: "Keep it flexible in RRIF savings, or ladder GICs for higher guaranteed rates." },
      { title: "Set your payment", text: "Take the government minimum or a fixed amount, on the schedule that works for you." },
      { title: "Name a successor", text: "A spouse can take over as successor annuitant so payments simply continue." },
      { title: "Receive your income", text: "Payments are deposited into your chequing or savings account automatically." },
    ],
    faqs: [
      {
        q: "When do I have to convert my RRSP?",
        a: "By December 31 of the year you turn 71. You can convert earlier if you'd like to start income sooner; the first minimum payment is due the year after the RRIF is opened.",
      },
      {
        q: "How is the minimum withdrawal calculated?",
        a: "It's a percentage of your RRIF's value on January 1. Before 71 it's 1 ÷ (90 − your age); from 71 the CRA's prescribed factors apply, starting at 5.28% and reaching 20% at age 95.",
      },
      {
        q: "Is tax withheld?",
        a: "Nothing is withheld on the minimum. Amounts above it have tax withheld at 10% (up to $5,000), 20% ($5,000–$15,000) or 30% (over $15,000). You may owe more or less when you file.",
      },
      {
        q: "Can I take more than the minimum?",
        a: "Yes — there's no maximum. You can also request a lump-sum withdrawal at any time from RRIF savings.",
      },
      {
        q: "What happens to my RRIF when I die?",
        a: "With a spouse as successor annuitant, the plan transfers and payments continue tax-deferred. Otherwise its value is generally taxable on your final return and paid to your beneficiary or estate.",
      },
    ],
    legal: [
      DEPOSIT_GUARANTEE,
      `Minimum withdrawal factors and withholding rates are those prescribed by the Canada Revenue Agency for ${TAX_YEAR} (outside Quebec). Projections assume a constant rate and are for illustration only.`,
    ],
  },

  MORTGAGE: {
    eyebrow: "Home financing",
    applyLabel: "Get pre-approved",
    rateHeading: "Mortgage rates",
    rateColumn: "Special rate",
    features: [
      { icon: "fa-lock", title: `${RATE_HOLD_DAYS}-day rate hold`, text: "Lock in today's rate while you shop. If rates fall before you close, you get the lower rate." },
      { icon: "fa-piggy-bank", title: "Pay it off faster", text: "Prepay up to 20% of the original amount each year and increase payments by up to 20% — without penalty." },
      { icon: "fa-calendar-days", title: "Flexible payments", text: "Pay monthly, semi-monthly, bi-weekly or weekly. Accelerated payments can save years of interest." },
      { icon: "fa-truck-moving", title: "Portable & assumable", text: "Moving? Take your mortgage and rate with you to your new home." },
    ],
    steps: [
      { title: "Tell us about you", text: "Income, debts and the home you're looking for. It takes about 5 minutes." },
      { title: "We check your credit", text: "With your consent we review your credit report and run the federal stress test." },
      { title: "Get your pre-approval", text: `A specialist confirms the amount and holds your rate for ${RATE_HOLD_DAYS} days.` },
      { title: "Shop with confidence", text: "When your offer is accepted, send us the agreement and we'll finalize the mortgage." },
    ],
    faqs: [
      {
        q: "How much do I need for a down payment?",
        a: "5% of the first $500,000, plus 10% of the portion between $500,000 and $1,499,999. Homes priced at $1.5 million or more need at least 20% down.",
      },
      {
        q: "What is mortgage default insurance?",
        a: "With less than 20% down, your mortgage must be insured (e.g. by CMHC). The premium — 2.80% to 4.00% of the loan depending on your down payment — is added to your mortgage.",
      },
      {
        q: "What is the stress test?",
        a: "Federal rules require you to qualify at the greater of your contract rate + 2% or 5.25%. Your housing costs (GDS) must be at most 39% of income and total debts (TDS) at most 44%.",
      },
      {
        q: "Can I get a 30-year amortization?",
        a: "Yes, for uninsured mortgages (20%+ down). With less than 20% down, 30 years is available to first-time home buyers and buyers of new builds.",
      },
      {
        q: "Is a pre-approval a guarantee?",
        a: "It's a conditional commitment. Final approval depends on the property appraisal, verifying your income and down payment, and no material change to your finances.",
      },
    ],
    legal: [
      `Rates are subject to change without notice and are offered on approved credit. Pre-approved rates are held for ${RATE_HOLD_DAYS} days. Rates shown are for owner-occupied residential properties with an amortization of 25 years or less.`,
      "Calculator results are estimates only and do not include closing costs such as land transfer tax, legal fees or a home inspection. Annual percentage rate (APR) equals the interest rate shown when no fees are charged.",
    ],
  },

  GENERAL: {
    eyebrow: "Personal banking",
    applyLabel: "Request a call back",
    rateHeading: "Options",
    rateColumn: "Rate",
    features: [
      { icon: "fa-headset", title: "Talk to a specialist", text: "A member of our team will call you at a time that suits you." },
      { icon: "fa-handshake", title: "Advice that fits", text: "We'll take the time to understand your goals before recommending anything." },
    ],
    steps: [
      { title: "Request a call", text: "Tell us when it's best to reach you." },
      { title: "We'll be in touch", text: "Usually within one business day." },
    ],
    faqs: [],
    legal: [DEPOSIT_GUARANTEE],
  },
};
