"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface FocusFrameProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: ReactNode;
  camera: ReactNode;
  panel: ReactNode;
  /** Shown above the controls, outside their scroll position (for example captions). */
  panelTop?: ReactNode;
}

/**
 * Full-screen frame for tasks where movement is the interface (camera setup, live exercise).
 * Solid bars above and beside the camera mean nothing is ever drawn over the body or the skeleton.
 * Phone: camera on top, controls underneath within thumb reach. Desktop: camera left, panel right.
 */
export default function FocusFrame({ title, subtitle, backHref, backLabel = "Back", onBack, actions, camera, panel, panelTop }: FocusFrameProps) {
  const backClass =
    "-ml-1 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-800 hover:bg-slate-100";
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[var(--paper)] text-slate-900">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-slate-900 px-3 sm:px-5"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
      >
        {backHref ? (
          <Link href={backHref} className={backClass}>
            <ChevronLeft className="size-5" aria-hidden="true" />
            {backLabel}
          </Link>
        ) : (
          <button type="button" onClick={onBack} className={backClass}>
            <ChevronLeft className="size-5" aria-hidden="true" />
            {backLabel}
          </button>
        )}
        <div className="min-w-0 flex-1 border-l border-slate-300 pl-3">
          <h1 className="truncate text-base font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 bg-slate-950">{camera}</div>
        <section
          aria-label="Exercise controls"
          className="max-h-[50dvh] shrink-0 overflow-y-auto border-t border-slate-900 bg-[var(--paper)] lg:max-h-none lg:w-[24rem] lg:border-l lg:border-t-0"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {panelTop}
          {panel}
        </section>
      </div>
    </div>
  );
}
