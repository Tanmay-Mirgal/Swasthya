"use client";

import { useState } from "react";

/** Range of motion over time for one exercise: a plain line chart with labelled axes and a table alternative. */
export default function RomChart({ points }: { points: { date: Date; rom: number }[] }) {
  const [asTable, setAsTable] = useState(false);
  if (points.length === 0) return null;

  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 14, t: 14, b: 30 };
  const roms = points.map((p) => p.rom);
  const lo = Math.max(0, Math.floor((Math.min(...roms) - 5) / 10) * 10);
  const hi = Math.ceil((Math.max(...roms) + 5) / 10) * 10;
  const t0 = points[0].date.getTime();
  const t1 = points[points.length - 1].date.getTime();
  const x = (t: number) => pad.l + (t1 === t0 ? (W - pad.l - pad.r) / 2 : ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo, lo + (hi - lo) / 2, hi];
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date.getTime()).toFixed(1)},${y(p.rom).toFixed(1)}`).join(" ");
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      {asTable ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Range of motion by session</caption>
          <thead>
            <tr className="border-b border-slate-900 text-left">
              <th scope="col" className="py-1.5 font-semibold">Date</th>
              <th scope="col" className="py-1.5 text-right font-semibold">Range of motion</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-1.5">{fmt(p.date)}</td>
                <td className="py-1.5 text-right font-mono tabular">{p.rom}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Range of motion from ${points[0].rom} degrees on ${fmt(points[0].date)} to ${points[points.length - 1].rom} degrees on ${fmt(points[points.length - 1].date)}`} className="w-full">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-slate-500)" className="tabular">{Math.round(t)}°</text>
            </g>
          ))}
          <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={x(p.date.getTime())} cy={y(p.rom)} r="4.5" fill="#fff" stroke="var(--brand)" strokeWidth="2.5" />
          ))}
          <text x={pad.l} y={H - 8} fontSize="12" fill="var(--color-slate-600)">{fmt(points[0].date)}</text>
          <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize="12" fill="var(--color-slate-600)">{fmt(points[points.length - 1].date)}</text>
        </svg>
      )}
      <button type="button" onClick={() => setAsTable((v) => !v)} className="mt-1 text-sm font-semibold text-emerald-700 underline underline-offset-4">
        {asTable ? "Show chart" : "Show as table"}
      </button>
    </div>
  );
}
