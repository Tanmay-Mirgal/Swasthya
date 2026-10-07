"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronLeft } from "lucide-react";
import type { StageKind } from "@/lib/movement/verdict/stageVerdict";
import type { Anchor, OverlayLayout } from "@/lib/movement/ui/overlayLayout";
import { cn } from "@/lib/utils";

/** The border around the whole stage: the state is readable from the other side of the room, with no text at all. */
const AMBIENT: Partial<Record<StageKind | "rest" | "countdown", CSSProperties>> = {
  good: { border: "10px solid #34d399" },
  corrected: { border: "10px solid #34d399" },
  not_counted: { border: "14px double #ff8f7a" },
  uncertain: { border: "10px dashed #f6d44b" },
  cant_see: { border: "10px dashed #f6d44b" },
  paused: { border: "8px dotted #aab2ad" },
  rest: { border: "8px solid #34d399" },
};

interface Props {
  stageRef: RefObject<HTMLDivElement | null>;
  layout: OverlayLayout;
  /** The stage's size in CSS px. */
  size: { w: number; h: number };
  /** The patient's reading-distance scale (1 to 2). */
  viewScale: number;
  /** Which ambient border to draw. */
  ambient: StageKind | "rest" | "countdown";
  title: string;
  subtitle?: string;
  /** A short tag next to the title, for example "Last one today". */
  tag?: string | null;
  backLabel?: string;
  onBack: () => void;
  actions?: ReactNode;
  camera: ReactNode;
  progress: ReactNode;
  verdict: ReactNode;
  /** Changes whenever the content changes shape, so the fit is measured afresh. */
  contentKey: string;
  /** The last spoken lines, when the patient asked for captions. */
  captions?: string[];
}

const STRIP = "clamp(60px, 8vh, 76px)";

const laneStyle = (anchor: Anchor, lane: number): CSSProperties => {
  const top = `calc(${STRIP} + 12px)`;
  switch (anchor) {
    case "left":
      return { left: 12, top, bottom: 12, width: lane };
    case "right":
      return { right: 12, top, bottom: 12, width: lane };
    case "top":
      return { left: 12, right: 12, top, height: lane };
    case "bottom":
      return { left: 12, right: 12, bottom: 12, height: lane };
  }
};

/**
 * The live exercise stage. The camera fills the whole screen; the good-rep count and the verdict sit in lanes on the
 * side(s) the person is not in, as solid panels you can read from across a room; the whole border changes with the
 * state. Nothing is drawn over the body: the lanes come from `chooseLayout`, which keeps clear of where the person is.
 */
export default function StageFrame({ stageRef, layout, size, viewScale, ambient, title, subtitle, tag, backLabel = "Stop", onBack, actions, camera, progress, verdict, contentKey, captions }: Props) {
  const shared = layout.progress === layout.verdict;
  const compactScale = layout.mode === "compact" ? 0.7 : 1;

  // Whatever the content, a lane must never be taller than the screen: a button out of reach is a stuck patient. If a lane
  // overflows, everything in it is scaled down a step at a time until it fits (and measured afresh when the content changes).
  const rootRef = stageRef;
  const [fit, setFit] = useState({ key: contentKey, f: 1 });
  const f = fit.key === contentKey ? fit.f : 1;
  const sizeKey = `${layout.mode}${layout.progress}${layout.verdict}${Math.round(layout.lane)}${Math.round(size.w)}${Math.round(size.h)}`;
  const lastSize = useRef(sizeKey);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const lanes = rootRef.current?.querySelectorAll<HTMLElement>(".stage-lane");
      const over = lanes ? [...lanes].some((l) => l.scrollHeight > l.clientHeight + 2) : false;
      setFit((cur) => {
        const base = cur.key === contentKey && lastSize.current === sizeKey ? cur.f : 1;
        lastSize.current = sizeKey;
        return { key: contentKey, f: over ? Math.max(0.5, base * 0.9) : base };
      });
    });
    return () => cancelAnimationFrame(id);
  }, [contentKey, sizeKey, f, rootRef]);

  const vs = Math.max(1, viewScale) * compactScale * f;
  const vertical = layout.progress === "left" || layout.progress === "right";
  // The width a card has for its text: the lane itself beside the person, or nearly the whole stage along a band.
  const laneW = (anchor: Anchor) => (anchor === "left" || anchor === "right" ? layout.lane : Math.max(240, size.w - 24));
  return (
    <div ref={stageRef} className="stage fixed inset-0 z-30 overflow-hidden bg-[var(--camera-black,#0f1311)] text-white" style={{ "--vs": viewScale } as CSSProperties}>
      <div className="absolute inset-0">{camera}</div>

      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-0 z-20 transition-[border-color] duration-300" style={AMBIENT[ambient]} key={ambient} />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-3 bg-black/80 px-3" style={{ height: STRIP, paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <button type="button" onClick={onBack} className="-ml-1 inline-flex min-h-14 min-w-14 items-center gap-1 rounded-lg px-2 text-lg font-bold text-white hover:bg-white/10">
          <ChevronLeft className="size-6" aria-hidden="true" />
          {backLabel}
        </button>
        <div className="min-w-0 flex-1 border-l border-white/30 pl-3">
          <h1 className="truncate font-bold leading-tight" style={{ fontSize: "var(--t-detail)" }}>{title}</h1>
          {(subtitle || tag) && (
            <p className="truncate text-white/80" style={{ fontSize: "calc(var(--t-detail) * 0.8)" }}>
              {subtitle}
              {tag && <span className="ml-2 rounded bg-white/15 px-2 py-0.5 font-semibold text-white">{tag}</span>}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {captions && captions.length > 0 && (
        <div role="log" aria-label="What the coach said" aria-live="off" className="pointer-events-none absolute inset-x-3 bottom-3 z-30 mx-auto max-w-3xl rounded-xl bg-black/85 px-4 py-2 text-center">
          {captions.slice(-2).map((l, i, a) => (
            <p key={`${i}-${l}`} className={i === a.length - 1 ? "font-semibold text-white" : "text-white/70"} style={{ fontSize: "calc(var(--t-detail) * 1.15)" }}>{l}</p>
          ))}
        </div>
      )}

      {shared ? (
        <div className={cn("stage-lane absolute z-30 flex gap-3 overflow-y-auto overscroll-contain", vertical ? "flex-col justify-start" : "flex-row items-stretch")} style={{ ...laneStyle(layout.progress, layout.lane), "--vs": vs, "--lane-w": `${laneW(layout.progress)}px` } as CSSProperties}>
          {progress}
          {verdict}
        </div>
      ) : (
        <>
          <div className="stage-lane absolute z-30 flex flex-col justify-start overflow-y-auto overscroll-contain" style={{ ...laneStyle(layout.progress, layout.lane), "--vs": vs, "--lane-w": `${laneW(layout.progress)}px` } as CSSProperties}>{progress}</div>
          <div className="stage-lane absolute z-30 flex flex-col justify-center overflow-y-auto overscroll-contain" style={{ ...laneStyle(layout.verdict, layout.lane), "--vs": vs, "--lane-w": `${laneW(layout.verdict)}px` } as CSSProperties}>{verdict}</div>
        </>
      )}
    </div>
  );
}
