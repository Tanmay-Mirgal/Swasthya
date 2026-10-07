"use client";

/** The last few lines the coach said, as text, newest at the bottom. Works the same with the voice muted. */
export default function CaptionsBar({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div role="log" aria-label="What the coach said" aria-live="off" className="border-b border-slate-300 bg-slate-50 px-4 py-2.5 sm:px-5">
      <ul translate="no" className="space-y-0.5 text-base text-slate-900">
        {lines.map((l, i) => (
          <li key={`${i}-${l}`} className={i === lines.length - 1 ? "font-semibold" : "text-slate-700"}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
