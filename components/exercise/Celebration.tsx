"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buzz, playCheer } from "@/lib/sound/cheer";

/**
 * The party popper: a short burst of paper and ticks when a set (or an exercise, or the day) is finished.
 *
 * Why it exists: finishing a set is the moment a patient most deserves to feel they did something. It marks that moment and
 * nothing else, so it only ever plays at a REST or DONE screen, when the camera is no longer judging the movement, and it
 * never covers a control (it ignores the pointer).
 *
 * Kept calm on purpose: a couple of seconds, no flashing (pieces fall smoothly; nothing blinks), brand greens and ink only
 * (yellow means "look at this" and coral means "stop" in this app, so neither is used), and nothing at all when the device
 * asks for reduced motion: the tick, the words and the milestone card still say it. The pieces are paper strips and the
 * product's own tick mark, which is the only glyph Swasthya uses for progress.
 */
export interface Burst {
  /** Changes with every burst so two in a row both play. */
  id: number;
  /** 1 = a set, 2 = a milestone or an exercise, 3 = today's routine. */
  level: 1 | 2 | 3;
}

// Greens from the brand, with a rare dark piece for contrast. Never yellow (it means "look at this") or coral (it means "stop").
const COLORS = ["#1f6b4f", "#2f8a68", "#5aa786", "#bbdbc8", "#185540", "#8fc7aa", "#1f6b4f", "#2f8a68", "#5aa786", "#8fc7aa", "#1a1f1d"];
const PLAN = {
  1: { pieces: 70, ms: 2400, waves: 1 },
  2: { pieces: 115, ms: 3200, waves: 2 },
  3: { pieces: 165, ms: 4400, waves: 3 },
} as const;

type Shape = "strip" | "tick" | "dot" | "ring";
interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: Shape;
  /** Seconds after the start before this piece leaves the popper. */
  delay: number;
  flutter: number;
  flutterSpeed: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const SHAPES: Shape[] = ["strip", "strip", "strip", "tick", "tick", "dot", "ring"];

/** Two poppers in the bottom corners aim up and inward; the biggest celebration also showers from the top. */
function makePieces(level: 1 | 2 | 3, w: number, h: number): Piece[] {
  const { pieces, waves } = PLAN[level];
  const scale = Math.min(w, h) / 760;
  const out: Piece[] = [];
  for (let i = 0; i < pieces; i++) {
    const wave = i % waves;
    const left = i % 2 === 0;
    const fromTop = level === 3 && wave === waves - 1 && i % 3 === 0;
    const angle = (left ? 1 : -1) * rand(10, 46) * (Math.PI / 180); // measured from straight up, leaning inward
    const speed = rand(1050, 1900) * Math.max(0.8, scale);
    out.push({
      x: fromTop ? rand(0, w) : left ? w * 0.04 : w * 0.96,
      y: fromTop ? -20 : h + 10,
      vx: fromTop ? rand(-60, 60) : Math.sin(angle) * speed,
      vy: fromTop ? rand(60, 160) : -Math.cos(angle) * speed,
      rot: rand(0, Math.PI * 2),
      vr: rand(-6, 6),
      size: rand(6, 13) * Math.max(0.85, Math.min(1.4, scale + 0.35)),
      color: pick(COLORS),
      shape: pick(SHAPES),
      delay: wave * 0.38 + rand(0, 0.12),
      flutter: rand(0, Math.PI * 2),
      flutterSpeed: rand(5, 11),
    });
  }
  return out;
}

function draw(ctx: CanvasRenderingContext2D, p: Piece, alpha: number, t: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  const s = p.size;
  if (p.shape === "strip") {
    ctx.scale(Math.cos(p.flutter + t * p.flutterSpeed), 1); // paper turning over in the air
    ctx.fillRect(-s * 0.3, -s, s * 0.6, s * 2);
  } else if (p.shape === "tick") {
    ctx.lineWidth = Math.max(2.5, s * 0.28);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, 0);
    ctx.lineTo(-s * 0.25, s * 0.65);
    ctx.lineTo(s * 0.95, -s * 0.7);
    ctx.stroke();
  } else if (p.shape === "dot") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(2, s * 0.2);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** The canvas that plays one burst. Renders nothing, and plays nothing, when the device asks for reduced motion. */
export default function Celebration({ burst }: { burst: Burst | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!burst || !canvas) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { ms } = PLAN[burst.level];
    const pieces = makePieces(burst.level, w, h);
    const gravity = 1500 * Math.max(0.75, Math.min(w, h) / 760);
    const start = performance.now();
    let last = start;
    let raf = 0;

    const step = (p: Piece, dt: number) => {
      p.vx *= Math.pow(0.9, dt * 6); // air drag, so pieces slow, hang and drift
      p.vy = (p.vy + gravity * dt) * Math.pow(0.94, dt * 6);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    };

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      // Real-time speed on slow devices too: a long frame is advanced in several small steps instead of being slowed down.
      let remaining = Math.min(0.6, (now - last) / 1000);
      last = now;
      while (remaining > 1e-4) {
        const dt = Math.min(1 / 60, remaining);
        remaining -= dt;
        for (const p of pieces) if (t >= p.delay) step(p, dt);
      }
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of pieces) {
        if (t < p.delay) {
          alive++;
          continue;
        }
        const life = ((t - p.delay) * 1000) / ms;
        const alpha = life < 0.65 ? 1 : Math.max(0, 1 - (life - 0.65) / 0.35);
        if (alpha <= 0 || p.y > h + 40) continue;
        alive++;
        draw(ctx, p, alpha, t);
      }
      if (alive > 0 && t * 1000 < ms + 1200) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [burst]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] size-full" />;
}

/** Fires a burst and its sound together. `enabled` is the person's "celebrate finished sets" setting. */
export function useCelebration(enabled: boolean) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const seq = useRef(0);
  const fire = useCallback(
    (level: 1 | 2 | 3, sound: { on: boolean; volume: number }) => {
      if (!enabled) return;
      seq.current += 1;
      setBurst({ id: seq.current, level });
      if (sound.on) playCheer(level, sound.volume);
      buzz(level);
    },
    [enabled]
  );
  return { burst, fire };
}

/** A hand-drawn party popper in the brand greens: a cone with bands, and paper flying out of the mouth. */
export function PartyPopperIcon({ className, popping = false }: { className?: string; popping?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <g className={popping ? "popper-pop" : undefined} style={{ transformOrigin: "10px 38px" }}>
        <path d="M6 42 L16 16 L32 32 Z" fill="#1f6b4f" />
        <path d="M13 24 L22 33" stroke="#bbdbc8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M10 33 L17 40" stroke="#bbdbc8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 16 L32 32" stroke="#185540" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <path d="M30 14 q3 -5 7 -3" stroke="#2f8a68" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M36 22 q5 -1 6 3" stroke="#1a1f1d" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 8 l1 4 M26 4 l-1 5" stroke="#1f6b4f" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="40" cy="12" r="2" fill="#5aa786" />
      <circle cx="34" cy="6" r="1.7" fill="#1a1f1d" />
      <path d="M40 31 l2 2.6 l4 -5" stroke="#1f6b4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
