"use client";

import { useCallback, useState } from "react";
import { getViewScale, normalizeViewScale, setViewScale, VIEW_SCALES, type ViewScale } from "@/lib/preferences";

/**
 * The patient's reading-distance text scale. `calibrated` is false until they have said "yes, I can read this".
 * "Make it bigger" only tries the next size on screen; nothing is remembered until they confirm one.
 */
export function useViewScale() {
  const [stored, setStored] = useState<ViewScale | null>(() => getViewScale());
  const [trial, setTrial] = useState<ViewScale | null>(null);
  const viewScale: ViewScale = trial ?? stored ?? 1.25;
  const last = VIEW_SCALES[VIEW_SCALES.length - 1];

  const confirm = useCallback(() => {
    setViewScale(viewScale);
    setStored(viewScale);
    setTrial(null);
  }, [viewScale]);

  const bigger = useCallback(() => {
    const i = VIEW_SCALES.indexOf(viewScale);
    setTrial(VIEW_SCALES[Math.min(VIEW_SCALES.length - 1, i + 1)]);
  }, [viewScale]);

  const choose = useCallback((s: number) => {
    const v = normalizeViewScale(s);
    setViewScale(v);
    setStored(v);
    setTrial(null);
  }, []);

  return { viewScale, calibrated: stored !== null, canGrow: viewScale < last, bigger, confirm, setViewScale: choose };
}
