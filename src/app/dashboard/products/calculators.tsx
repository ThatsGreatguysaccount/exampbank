"use client";

import { useMemo, useState } from "react";
import {
  GDS_LIMIT,
  MORTGAGE_FREQUENCIES,
  RRIF_FREQUENCIES,
  RRSP_DEADLINE,
  RRSP_DOLLAR_LIMIT,
  RRSP_MAX_AGE,
  TAX_YEAR,
  TDS_LIMIT,
  TFSA_LIMIT_THIS_YEAR,
  amortize,
  assessMortgage,
  gicSchedule,
  maxAffordablePrice,
  minimumDownPayment,
  projectGrowth,
  rrifMinimumPct,
  rrifSchedule,
  rrifWithholdingPct,
  rrspDeductionLimit,
  termLabel,
  tfsaLifetimeRoom,
  type MortgageFrequency,
  type ProductOption,
  type RrifFrequency,
} from "@/lib/products";
import { RatioBar, StackedBars } from "./charts";

export type Prefill = { option?: string; amount?: number; values?: Record<string, string | number | boolean> };

export type CalcProps = {
  options: ProductOption[];
  defaultOption: string;
  fmt: (n: number) => string;
  age: number | null;
  birthYear: number | null;
  minAmount: number | null;
  onApply: (prefill: Prefill) => void;
};

const num = (v: string) => {
  const n = parseFloat(v.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const whole = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

function Money({ value, onChange, step = "100" }: { value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="amount-input">
      <input type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function OptionSelect({ options, value, onChange }: { options: ProductOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.label} value={o.label}>
          {o.label} — {o.rate}%
        </option>
      ))}
    </select>
  );
}

function Result({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className={`result${big ? " big" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

/* ============================== TFSA ============================== */

export function TfsaCalculator({ options, defaultOption, fmt, birthYear, minAmount, onApply }: CalcProps) {
  const [option, setOption] = useState(defaultOption);
  const [initial, setInitial] = useState(String(Math.max(minAmount ?? 0, 5000)));
  const [monthly, setMonthly] = useState("250");
  const [years, setYears] = useState(20);
  const [marginal, setMarginal] = useState("30");
  const rate = options.find((o) => o.label === option)?.rate ?? 0;

  const points = useMemo(() => projectGrowth(num(initial), num(monthly), rate, years), [initial, monthly, rate, years]);
  const last = points[points.length - 1];
  const growth = last.value - last.contributed;
  // Rough comparison: in a non-registered account the same growth would be taxed each year.
  const taxable = projectGrowth(num(initial), num(monthly), rate * (1 - num(marginal) / 100), years);
  const taxSaved = last.value - taxable[taxable.length - 1].value;
  const { room, eligibleFrom } = tfsaLifetimeRoom(birthYear);

  return (
    <div className="calc">
      <div className="calc-inputs">
        <Field label="Portfolio">
          <OptionSelect options={options} value={option} onChange={setOption} />
        </Field>
        <Field label="Initial investment">
          <Money value={initial} onChange={setInitial} />
        </Field>
        <Field label="Monthly contribution">
          <Money value={monthly} onChange={setMonthly} step="25" />
        </Field>
        <Field label={`Invest for ${years} year${years === 1 ? "" : "s"}`}>
          <input type="range" min={1} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} />
        </Field>
        <Field label="Marginal tax rate (for comparison)">
          <select value={marginal} onChange={(e) => setMarginal(e.target.value)}>
            <option value="20">~20% (income under $55k)</option>
            <option value="30">~30% ($55k – $110k)</option>
            <option value="40">~40% ($110k – $180k)</option>
            <option value="47">~47% (over $180k)</option>
          </select>
        </Field>
        <div className="info-card">
          <i className="fas fa-circle-info" />
          <div>
            {birthYear ? (
              <>
                Based on your birth year, you&apos;ve been eligible since <strong>{eligibleFrom}</strong>. If you&apos;ve never
                contributed, you could have up to <strong>{whole(room)}</strong> of TFSA room. The {TAX_YEAR} limit is{" "}
                {whole(TFSA_LIMIT_THIS_YEAR)}.
              </>
            ) : (
              <>The {TAX_YEAR} TFSA limit is {whole(TFSA_LIMIT_THIS_YEAR)}. Check your exact room on CRA My Account.</>
            )}
          </div>
        </div>
      </div>
      <div className="calc-results">
        <div className="result-grid">
          <Result big label={`Estimated value in ${years} yrs`} value={fmt(last.value)} sub={`at ${rate}% avg. annual return`} />
          <Result label="You contribute" value={fmt(last.contributed)} />
          <Result label="Tax-free growth" value={fmt(growth)} />
          <Result label="Tax saved vs. non-registered" value={fmt(Math.max(0, taxSaved))} sub="estimate" />
        </div>
        <StackedBars
          caption="Projected TFSA value by year"
          labels={points.map((p) => `Yr ${p.year}`)}
          series={[
            { label: "Contributions", color: "#8ecbd6", values: points.map((p) => p.contributed) },
            { label: "Growth", color: "#007287", values: points.map((p) => p.value - p.contributed) },
          ]}
          format={fmt}
        />
        {num(initial) > room ? (
          <p className="calc-warn">
            <i className="fas fa-triangle-exclamation" /> The initial amount is more than your maximum possible room.
          </p>
        ) : null}
        <button type="button" className="btn-primary" onClick={() => onApply({ option, amount: num(initial), values: { monthlyContribution: num(monthly) } })}>
          <i className="fas fa-arrow-right" /> Invest {fmt(num(initial))} in this portfolio
        </button>
      </div>
    </div>
  );
}

/* ============================== RRSP GIC ============================== */

/** Approximate 2026 combined federal + Saskatchewan marginal rates on ordinary income. */
function marginalRate(income: number) {
  if (income <= 16_000) return 0;
  if (income <= 54_500) return 24.5;
  if (income <= 58_000) return 26.5;
  if (income <= 109_000) return 33;
  if (income <= 152_000) return 39.5;
  if (income <= 166_000) return 41.5;
  if (income <= 237_000) return 43.5;
  return 47.5;
}

export function GicCalculator({ options, defaultOption, fmt, age, minAmount, onApply }: CalcProps) {
  const [option, setOption] = useState(defaultOption);
  const [amount, setAmount] = useState(String(Math.max(minAmount ?? 0, 10000)));
  const [income, setIncome] = useState("85000");
  const opt = options.find((o) => o.label === option) ?? options[0];
  const months = opt?.months ?? 12;
  const principal = num(amount);
  const sched = useMemo(() => gicSchedule(principal, opt?.rate ?? 0, months), [principal, opt, months]);
  const limit = rrspDeductionLimit(num(income));
  const mr = marginalRate(num(income));
  const deductible = Math.min(principal, limit);
  const refund = (deductible * mr) / 100;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <Field label="GIC term">
          <OptionSelect options={options} value={option} onChange={setOption} />
        </Field>
        <Field label="Contribution amount" hint={minAmount ? `Minimum ${whole(minAmount)}` : undefined}>
          <Money value={amount} onChange={setAmount} />
        </Field>
        <Field label={`Earned income in ${TAX_YEAR - 1}`} hint="Used to estimate your deduction limit and tax refund.">
          <Money value={income} onChange={setIncome} step="1000" />
        </Field>
        <div className="info-card">
          <i className="fas fa-calendar-day" />
          <div>
            Contribute by <strong>{RRSP_DEADLINE}</strong> to deduct it on your {TAX_YEAR} return. New room from this income:{" "}
            <strong>{whole(limit)}</strong> (18%, max {whole(RRSP_DOLLAR_LIMIT)}).
            {age !== null && age >= RRSP_MAX_AGE - 1 ? (
              <> You must convert your RRSP to a RRIF by December 31 of the year you turn {RRSP_MAX_AGE}.</>
            ) : null}
          </div>
        </div>
      </div>
      <div className="calc-results">
        <div className="result-grid">
          <Result big label={`Value at maturity (${termLabel(months)})`} value={fmt(sched.maturity)} sub={`${opt?.rate}% compounded annually`} />
          <Result label="Interest earned" value={fmt(sched.interest)} sub="guaranteed" />
          <Result label="Estimated tax refund" value={fmt(refund)} sub={`at ~${mr}% marginal rate`} />
          <Result label="Net cost after refund" value={fmt(principal - refund)} />
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Interest</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {sched.rows.map((r) => (
                <tr key={r.year}>
                  <td>{Number.isInteger(r.year) ? `Year ${r.year}` : `${termLabel(months)} (partial)`}</td>
                  <td className="num">{fmt(r.interest)}</td>
                  <td className="num">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {principal > limit && num(income) > 0 ? (
          <p className="calc-warn">
            <i className="fas fa-triangle-exclamation" /> This is more than the new room from your income — make sure you have
            unused room from previous years (see your Notice of Assessment).
          </p>
        ) : null}
        <button type="button" className="btn-primary" onClick={() => onApply({ option, amount: principal, values: { earnedIncome: num(income) } })}>
          <i className="fas fa-arrow-right" /> Buy this {termLabel(months)} GIC
        </button>
      </div>
    </div>
  );
}

/* ============================== RRIF ============================== */

export function RrifCalculator({ options, defaultOption, fmt, age, minAmount, onApply }: CalcProps) {
  const [option, setOption] = useState(defaultOption);
  const [balance, setBalance] = useState(String(Math.max(minAmount ?? 0, 250000)));
  const [startAge, setStartAge] = useState(String(Math.min(Math.max(age ?? 71, 55), 94)));
  const [mode, setMode] = useState<"MINIMUM" | "FIXED">("MINIMUM");
  const [fixed, setFixed] = useState("18000");
  const [freq, setFreq] = useState<RrifFrequency>("MONTHLY");
  const rate = options.find((o) => o.label === option)?.rate ?? 0;
  const a = Math.round(num(startAge));
  const rows = useMemo(
    () => rrifSchedule(num(balance), Math.min(Math.max(a, 50), 100), rate, mode, num(fixed)),
    [balance, a, rate, mode, fixed],
  );
  const first = rows[0];
  const per = first ? first.withdrawal / RRIF_FREQUENCIES[freq].perYear : 0;
  const lastsTo = rows.length && rows[rows.length - 1].end <= 0.005 ? rows[rows.length - 1].age : null;
  const excess = first ? first.withdrawal - first.minimum : 0;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <Field label="Invest in">
          <OptionSelect options={options} value={option} onChange={setOption} />
        </Field>
        <Field label="RRIF value on January 1">
          <Money value={balance} onChange={setBalance} step="1000" />
        </Field>
        <Field label="Age on January 1" hint="Use a younger spouse's age to lower your minimum.">
          <input type="number" min={50} max={100} value={startAge} onChange={(e) => setStartAge(e.target.value)} />
        </Field>
        <Field label="Payment amount">
          <div className="segmented">
            <input type="radio" id="rrif-min" checked={mode === "MINIMUM"} onChange={() => setMode("MINIMUM")} />
            <label htmlFor="rrif-min">Government minimum</label>
            <input type="radio" id="rrif-fixed" checked={mode === "FIXED"} onChange={() => setMode("FIXED")} />
            <label htmlFor="rrif-fixed">Fixed amount</label>
          </div>
        </Field>
        {mode === "FIXED" ? (
          <Field label="Annual payment">
            <Money value={fixed} onChange={setFixed} step="500" />
          </Field>
        ) : null}
        <Field label="Payment frequency">
          <select value={freq} onChange={(e) => setFreq(e.target.value as RrifFrequency)}>
            {Object.entries(RRIF_FREQUENCIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="calc-results">
        {first ? (
          <>
            <div className="result-grid">
              <Result big label={`${RRIF_FREQUENCIES[freq].label} payment`} value={fmt(per)} sub={`${fmt(first.withdrawal)} this year`} />
              <Result label={`Minimum at age ${first.age}`} value={`${rrifMinimumPct(first.age)}%`} sub={fmt(first.minimum)} />
              <Result
                label="Tax withheld"
                value={fmt(first.tax)}
                sub={excess > 0 ? `${rrifWithholdingPct(excess)}% on ${fmt(excess)} above minimum` : "none on the minimum"}
              />
              <Result label="Savings last until" value={lastsTo ? `Age ${lastsTo}` : "Age 95+"} sub={lastsTo ? undefined : `${fmt(rows[rows.length - 1].end)} left at 95`} />
            </div>
            <StackedBars
              caption="Yearly RRIF withdrawals and remaining balance"
              labels={rows.map((r) => String(r.age))}
              series={[{ label: "Balance on Jan 1", color: "#8ecbd6", values: rows.map((r) => r.start) }]}
              format={fmt}
            />
            <details className="schedule">
              <summary>
                <i className="fas fa-table" /> Year-by-year schedule
              </summary>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Age</th>
                      <th className="num">Jan 1 value</th>
                      <th className="num">Min %</th>
                      <th className="num">Withdrawal</th>
                      <th className="num">Withholding</th>
                      <th className="num">Year-end</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.age}>
                        <td>{r.age}</td>
                        <td className="num">{fmt(r.start)}</td>
                        <td className="num">{r.minPct}%</td>
                        <td className="num">{fmt(r.withdrawal)}</td>
                        <td className="num">{fmt(r.tax)}</td>
                        <td className="num">{fmt(r.end)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="empty">Enter your RRIF value to see your income.</div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            onApply({
              option,
              amount: num(balance),
              values: { paymentType: mode, fixedAnnual: num(fixed), frequency: freq },
            })
          }
        >
          <i className="fas fa-arrow-right" /> Set up this income plan
        </button>
      </div>
    </div>
  );
}

/* ============================== Mortgage ============================== */

export function MortgageCalculator({ options, defaultOption, fmt, onApply }: CalcProps) {
  const [option, setOption] = useState(defaultOption);
  const [price, setPrice] = useState("550000");
  const [down, setDown] = useState("55000");
  const [amort, setAmort] = useState("25");
  const [freq, setFreq] = useState<MortgageFrequency>("MONTHLY");
  const [income, setIncome] = useState("130000");
  const [debts, setDebts] = useState("450");
  const [tax, setTax] = useState("4800");
  const [heat, setHeat] = useState("120");
  const [condo, setCondo] = useState("0");
  const opt = options.find((o) => o.label === option) ?? options[0];
  const rate = opt?.rate ?? 0;
  const termMonths = opt?.months ?? 60;
  const p = num(price);
  const d = num(down);
  const years = Number(amort);

  const inputs = {
    purchasePrice: p,
    downPayment: d,
    rate,
    amortYears: years,
    frequency: freq,
    termMonths,
    annualIncome: num(income),
    monthlyDebts: num(debts),
    propertyTaxYearly: num(tax),
    heatingMonthly: num(heat),
    condoFeesMonthly: num(condo),
  };
  const a = assessMortgage(inputs);
  const monthlyBase = assessMortgage({ ...inputs, frequency: "MONTHLY" });
  const savedYears = freq.startsWith("ACC") ? years - a.term.payoffYears : 0;
  const savedInterest = freq.startsWith("ACC")
    ? amortize(monthlyBase.loan, rate, monthlyBase.payment, "MONTHLY", termMonths / 12).interestTotal - a.term.interestTotal
    : 0;
  const maxPrice = useMemo(
    () =>
      maxAffordablePrice({
        downPayment: d,
        rate,
        amortYears: years,
        frequency: "MONTHLY",
        termMonths,
        annualIncome: num(income),
        monthlyDebts: num(debts),
        heatingMonthly: num(heat),
        condoFeesMonthly: num(condo),
        propertyTaxPct: p > 0 ? (num(tax) / p) * 100 : 1,
      }),
    [d, rate, years, termMonths, income, debts, heat, condo, tax, p],
  );
  const balances = useMemo(() => {
    const out: number[] = [];
    for (let y = 0; y <= years; y++) {
      out.push(y === 0 ? a.loan : amortize(a.loan, rate, a.payment, freq, y).balanceAtTerm);
    }
    return out;
  }, [a.loan, a.payment, rate, freq, years]);
  const minDown = minimumDownPayment(p);
  const downPct = p > 0 ? (d / p) * 100 : 0;

  return (
    <div className="calc">
      <div className="calc-inputs">
        <div className="form-section-title">
          <i className="fas fa-house" /> Your home
        </div>
        <Field label="Purchase price">
          <Money value={price} onChange={setPrice} step="5000" />
        </Field>
        <Field
          label={`Down payment (${downPct.toFixed(1)}%)`}
          hint={
            d < minDown ? (
              <span className="err-text">Minimum down payment for this price is {whole(minDown)}.</span>
            ) : (
              `Minimum ${whole(minDown)}`
            )
          }
        >
          <Money value={down} onChange={setDown} step="1000" />
        </Field>
        <div className="form-grid">
          <Field label="Rate">
            <OptionSelect options={options} value={option} onChange={setOption} />
          </Field>
          <Field label="Amortization">
            <select value={amort} onChange={(e) => setAmort(e.target.value)}>
              {[15, 20, 25, 30].map((y) => (
                <option key={y} value={y}>
                  {y} years
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Payment frequency">
          <select value={freq} onChange={(e) => setFreq(e.target.value as MortgageFrequency)}>
            {Object.entries(MORTGAGE_FREQUENCIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-section-title">
          <i className="fas fa-scale-balanced" /> Can I qualify?
        </div>
        <div className="form-grid">
          <Field label="Household income / yr">
            <Money value={income} onChange={setIncome} step="1000" />
          </Field>
          <Field label="Other debt payments / mo" hint="Car loans, credit cards, lines of credit">
            <Money value={debts} onChange={setDebts} step="50" />
          </Field>
          <Field label="Property tax / yr">
            <Money value={tax} onChange={setTax} step="100" />
          </Field>
          <Field label="Heating / mo">
            <Money value={heat} onChange={setHeat} step="10" />
          </Field>
          <Field label="Condo fees / mo">
            <Money value={condo} onChange={setCondo} step="25" />
          </Field>
        </div>
      </div>
      <div className="calc-results">
        <div className="result-grid">
          <Result big label={`${MORTGAGE_FREQUENCIES[freq].label} payment`} value={fmt(a.payment)} sub={`${opt?.label} at ${rate}%`} />
          <Result label="Total mortgage" value={fmt(a.loan)} sub={a.insured ? `incl. ${fmt(a.premium)} CMHC premium (${a.premiumPct}%)` : "conventional — no insurance"} />
          <Result label={`Interest over ${termLabel(termMonths)} term`} value={fmt(a.term.interestTerm)} />
          <Result label="Balance at renewal" value={fmt(a.term.balanceAtTerm)} />
        </div>
        {savedYears > 0.05 ? (
          <p className="calc-good">
            <i className="fas fa-bolt" /> Accelerated payments pay off your mortgage in {a.term.payoffYears.toFixed(1)} years — saving
            about {fmt(Math.max(0, savedInterest))} in interest.
          </p>
        ) : null}
        <StackedBars
          caption="Mortgage balance by year"
          labels={balances.map((_, i) => `Yr ${i}`)}
          series={[{ label: "Balance", color: "#007287", values: balances }]}
          format={fmt}
        />
        <div className="stress">
          <div className="stress-head">
            <strong>Federal stress test</strong>
            <span className={`badge ${a.qualifies ? "badge-green" : "badge-red"}`}>{a.qualifies ? "Likely to qualify" : "May not qualify"}</span>
          </div>
          <p className="muted">
            Qualifying at {a.qRate.toFixed(2)}% (greater of contract rate + 2% or 5.25%): {fmt(a.qualifyingMonthly)}/month.
          </p>
          <RatioBar label="Gross debt service (housing costs)" value={a.gds} limit={GDS_LIMIT} />
          <RatioBar label="Total debt service (all debts)" value={a.tds} limit={TDS_LIMIT} />
          <div className="detail-row">
            <span>Maximum purchase price with {whole(d)} down</span>
            <strong>{whole(maxPrice)}</strong>
          </div>
        </div>
        {years > 25 && a.insured ? (
          <p className="calc-warn">
            <i className="fas fa-circle-info" /> With less than 20% down, a 30-year amortization is only available to first-time buyers.
          </p>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={!a.downOk}
          onClick={() =>
            onApply({
              option,
              values: {
                purchasePrice: p,
                downPayment: d,
                amortYears: years,
                frequency: freq,
                annualIncome: num(income),
                monthlyDebts: num(debts),
                propertyTaxYearly: num(tax),
                heatingMonthly: num(heat),
                condoFeesMonthly: num(condo),
              },
            })
          }
        >
          <i className="fas fa-arrow-right" /> Get pre-approved for {fmt(a.loan)}
        </button>
      </div>
    </div>
  );
}

export const CALCULATORS = {
  TFSA_FUNDS: TfsaCalculator,
  RRSP_GIC: GicCalculator,
  RRIF: RrifCalculator,
  MORTGAGE: MortgageCalculator,
} as const;
