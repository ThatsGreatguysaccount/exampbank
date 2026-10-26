"use client";

import { useState } from "react";

export type Series = { label: string; color: string; values: number[] };

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function short(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

/** Stacked bar chart with a hover read-out; `labels[i]` names each bar. */
export function StackedBars({
  labels,
  series,
  format,
  caption,
}: {
  labels: string[];
  series: Series[];
  format: (v: number) => string;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  if (!n) return null;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i] ?? 0), 0));
  const max = niceMax(Math.max(...totals));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / n;
  const bar = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const every = Math.ceil(n / 10);
  const shown = hover ?? n - 1;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * t)} y2={y(max * t)} className="grid" />
            <text x={PAD.left - 8} y={y(max * t) + 4} textAnchor="end" className="axis">
              {short(max * t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => {
          let base = 0;
          const x = PAD.left + slot * i + (slot - bar) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {series.map((s) => {
                const v = Math.max(0, s.values[i] ?? 0);
                const top = y(base + v);
                const h = y(base) - top;
                base += v;
                return <rect key={s.label} x={x} y={top} width={bar} height={Math.max(0, h)} rx={2} fill={s.color} />;
              })}
              {(i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? (
                <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="axis">
                  {l}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <strong>{labels[shown]}</strong>
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}: {format(s.values[shown] ?? 0)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Horizontal gauge comparing a ratio against its limit. */
export function RatioBar({ label, value, limit }: { label: string; value: number; limit: number }) {
  const ok = value <= limit;
  const scale = Math.max(limit * 1.4, value);
  return (
    <div className="ratio">
      <div className="ratio-head">
        <span>{label}</span>
        <strong className={ok ? "ok-text" : "err-text"}>
          {value.toFixed(1)}% <small>/ {limit}% max</small>
        </strong>
      </div>
      <div className="ratio-track">
        <div className={`ratio-fill ${ok ? "" : "bad"}`} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
        <div className="ratio-limit" style={{ left: `${(limit / scale) * 100}%` }} />
      </div>
    </div>
  );
}
