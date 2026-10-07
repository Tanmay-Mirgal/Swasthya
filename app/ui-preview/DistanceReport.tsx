"use client";

import { useEffect, useState } from "react";
import { checkDistance, DEVICES, type DistanceElement, type DistanceReport as Report, type DistanceTier } from "@/lib/movement/ui/distance";

const ZOOMS = [1, 1.25, 1.5] as const;

/** Finds every element marked `data-distance="counter|verdict|instruction|details"` and reads its rendered font size. */
function scan(): DistanceElement[] {
  const seen = new Set<string>();
  const out: DistanceElement[] = [];
  document.querySelectorAll<HTMLElement>("[data-distance]").forEach((el) => {
    const tier = el.dataset.distance as DistanceTier;
    const fontPx = parseFloat(getComputedStyle(el).fontSize);
    const label = (el.dataset.distanceLabel ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 28) || tier;
    const key = `${tier}:${label}:${Math.round(fontPx)}`;
    if (!Number.isFinite(fontPx) || seen.has(key)) return;
    seen.add(key);
    out.push({ tier, label, fontPx });
  });
  return out;
}

/** Lanes whose content is taller than the lane: a button could be out of reach. */
function lanesOverflowing(): number {
  if (typeof document === "undefined") return 0;
  return [...document.querySelectorAll<HTMLElement>(".stage-lane")].filter((l) => l.scrollHeight > l.clientHeight + 2).length;
}

/**
 * Development aid: how readable is the text on this page from 1, 1.5 and 2 m, for a chosen screen and browser zoom?
 * It measures what is really rendered, so it also catches a regression in the type scale. It cannot replace the
 * human test with older adults; it only stops the numbers from being a matter of opinion.
 */
export default function DistanceReport() {
  const [deviceId, setDeviceId] = useState("laptop13");
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    const device = DEVICES.find((d) => d.id === deviceId)!;
    const run = () => setReport(checkDistance(scan(), device, zoom));
    const first = setTimeout(run, 600);
    const t = setInterval(run, 1500);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [deviceId, zoom]);

  const fails = report?.rows.filter((r) => !r.ok) ?? [];
  const overflowing = lanesOverflowing();
  return (
    <aside data-distance-report className="fixed bottom-2 left-2 z-50 max-h-[60dvh] w-[min(34rem,calc(100vw-1rem))] overflow-auto rounded-lg border border-slate-900 bg-white p-3 text-xs text-slate-900 shadow-xl">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">Distance check</strong>
        <select aria-label="Screen" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="rounded border border-slate-400 px-1 py-0.5">
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        <select aria-label="Browser zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value) as (typeof ZOOMS)[number])} className="rounded border border-slate-400 px-1 py-0.5">
          {ZOOMS.map((z) => (
            <option key={z} value={z}>{Math.round(z * 100)}% zoom</option>
          ))}
        </select>
        <span data-lanes-overflowing={overflowing} className={overflowing ? "font-bold text-red-700" : "text-slate-700"}>{overflowing ? `${overflowing} lane(s) overflow` : "all lanes fit"}</span>
        <span data-distance-summary className="ml-auto font-bold">
          {report ? (report.failures === 0 ? "PASS" : `FAIL: ${report.failures} of ${report.rows.length} (worst ${report.worstFactor.toFixed(1)}x too small)`) : "measuring"}
        </span>
      </div>
      {report && (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="text-left"><th>Text</th><th>Tier</th><th>m</th><th>px</th><th>need</th><th>deg</th><th /></tr>
          </thead>
          <tbody>
            {report.rows.map((r, i) => (
              <tr key={i} className={r.ok ? "" : "bg-red-50"}>
                <td className="max-w-[9rem] truncate">{r.label}</td><td>{r.tier}</td><td>{r.distanceM}</td><td>{Math.round(r.fontPx)}</td><td>{r.requiredPx}</td><td>{r.angleDeg.toFixed(2)}</td><td>{r.ok ? "ok" : "FAIL"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {fails.length === 0 && report && <p className="mt-1">Everything marked on this screen is large enough at these distances.</p>}
    </aside>
  );
}
