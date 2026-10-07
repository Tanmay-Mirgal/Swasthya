"use client";

interface Props {
  count: number;
  /** Shown above the number. */
  label?: string;
}

/**
 * The 3 · 2 · 1 before a set. Large, calm and plain: the number is the only thing that changes, nothing flashes,
 * and it is announced to screen readers once per second. Sits over the camera window (which is not showing a
 * skeleton yet) or on its own page in manual mode.
 */
export default function Countdown({ count, label = "Get ready" }: Props) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-slate-950/60 p-4 text-center">
      <p className="text-xl font-bold text-white">{label}</p>
      <p role="timer" aria-live="assertive" aria-label={`Starting in ${count}`} className="font-mono text-[7rem] font-bold leading-none text-white tabular sm:text-[9rem]">
        {count}
      </p>
      <p className="text-base text-slate-100">Take your starting position.</p>
    </div>
  );
}
