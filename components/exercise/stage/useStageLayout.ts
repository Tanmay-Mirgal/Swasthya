"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { BodyBox } from "@/lib/movement/ui/movementUi";
import { bodyInStage, chooseLayout, sameLayout, stabilizeLayout, type LayoutState, type OverlayLayout, type StageSize } from "@/lib/movement/ui/overlayLayout";

/**
 * Keeps the stage's lanes off the person. It reads the person's box from the movement UI (about four times a second),
 * maps it onto the stage the way the video is drawn, asks the pure layout rules where the feedback may go, and only
 * switches layout after the person has really moved (see stabilizeLayout). Nothing here touches the frame loop.
 */
export function useStageLayout(opts: { bodyBox: BodyBox | null; viewScale: number; videoRef: RefObject<HTMLVideoElement | null> }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<StageSize>({ w: 1280, h: 720 });
  const [layout, setLayout] = useState<OverlayLayout>(() => chooseLayout(null, { w: 1280, h: 720 }, opts.viewScale));

  const latest = useRef({ ...opts, size });
  useEffect(() => {
    latest.current = { ...opts, size };
  });
  const state = useRef<LayoutState | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tick = () => {
      const { bodyBox, viewScale, size: sz, videoRef } = latest.current;
      const v = videoRef.current;
      const aspect = v && v.videoWidth > 0 && v.videoHeight > 0 ? v.videoWidth / v.videoHeight : 16 / 9;
      const body = bodyBox ? bodyInStage(bodyBox, aspect, sz) : null;
      state.current = stabilizeLayout(state.current, chooseLayout(body, sz, viewScale), performance.now());
      const next = state.current.current;
      setLayout((prev) => (sameLayout(prev, next) && Math.abs(prev.lane - next.lane) < 1 ? prev : next));
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 400);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  return { stageRef, layout, size };
}
