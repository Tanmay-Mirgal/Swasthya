/**
 * lib/movement/ui/distance.ts
 *
 * Can this text be read from where the patient sits? Pure arithmetic from visual angle, so the exercise screen can be
 * checked against a number instead of an opinion.
 *
 *   cap height (mm)  = font px x 0.72 x mm per px          (capital letters are ~72% of the font size)
 *   visual angle     = atan(cap height / distance)
 *   required font px = tan(angle) x distance / (0.72 x mm per px)
 *
 * The angles are ENGINEERING DEFAULTS for an older adult with reduced acuity (about 6/18, whose threshold letter is
 * ~0.25 degrees). They are meant to be confirmed with the human distance test, not treated as clinical facts.
 * The browser cannot know the physical size of a screen, so `mmPerPx` comes from a device table (or, in the product,
 * from the patient's own calibration of "can you read this from where you will sit").
 */

export type DistanceTier = "counter" | "verdict" | "instruction" | "details";

/** Minimum visual angle, in degrees, for each kind of text. */
export const TIER_ANGLE_DEG: Record<DistanceTier, number> = {
  /** The good-rep count: read at a glance from the farthest seat. */
  counter: 0.75,
  /** GOOD / NOT COUNTED / I CAN'T SEE YOU CLEARLY. */
  verdict: 0.5,
  /** The one short instruction ("Turn a little farther"). */
  instruction: 0.3,
  /** Tally, measurements, guide: only read at the device. */
  details: 0.25,
};

/** The distances each tier has to work at. Details are only read close to the device. */
export const TIER_DISTANCES_M: Record<DistanceTier, number[]> = {
  counter: [1, 1.5, 2],
  verdict: [1, 1.5, 2],
  instruction: [1, 1.5],
  details: [0.6],
};

export interface DeviceProfile {
  id: string;
  label: string;
  /** Physical size of one CSS pixel at 100% browser zoom, in millimetres. */
  mmPerPx: number;
}

/** Approximate sizes. Real devices vary; the product asks the patient to calibrate instead. */
export const DEVICES: DeviceProfile[] = [
  { id: "laptop13", label: "13-inch laptop", mmPerPx: 0.2 },
  { id: "tablet", label: "Tablet", mmPerPx: 0.2 },
  { id: "monitor24", label: "24-inch monitor", mmPerPx: 0.28 },
  { id: "phone", label: "Phone, landscape", mmPerPx: 0.165 },
];

const CAP_RATIO = 0.72;
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Height of a capital letter, in millimetres, for text set at `fontPx` on a screen with `mmPerPx` (zoom 1 = 100%). */
export function capHeightMm(fontPx: number, mmPerPx: number, zoom = 1): number {
  return fontPx * CAP_RATIO * mmPerPx * zoom;
}

/** Visual angle, in degrees, of a letter of `capMm` seen from `distanceM` metres. */
export function visualAngleDeg(capMm: number, distanceM: number): number {
  return deg(Math.atan(capMm / (distanceM * 1000)));
}

/** The smallest font size (CSS px) whose capitals subtend `angleDeg` at `distanceM`. */
export function requiredFontPx(angleDeg: number, distanceM: number, mmPerPx: number, zoom = 1): number {
  return Math.round((Math.tan(rad(angleDeg)) * distanceM * 1000) / (CAP_RATIO * mmPerPx * zoom));
}

export interface DistanceElement {
  tier: DistanceTier;
  label: string;
  /** Computed font size in CSS px, after any view-scale. */
  fontPx: number;
}

export interface DistanceRow {
  tier: DistanceTier;
  label: string;
  distanceM: number;
  fontPx: number;
  requiredPx: number;
  angleDeg: number;
  ok: boolean;
}

export interface DistanceReport {
  rows: DistanceRow[];
  failures: number;
  /** Largest shortfall as a multiple (required / actual), 1 when everything passes. */
  worstFactor: number;
}

/** Checks every element at every distance its tier must work at. */
export function checkDistance(elements: DistanceElement[], device: DeviceProfile, zoom = 1): DistanceReport {
  const rows: DistanceRow[] = [];
  for (const e of elements) {
    for (const d of TIER_DISTANCES_M[e.tier]) {
      const angleDeg = visualAngleDeg(capHeightMm(e.fontPx, device.mmPerPx, zoom), d);
      const requiredPx = requiredFontPx(TIER_ANGLE_DEG[e.tier], d, device.mmPerPx, zoom);
      rows.push({ tier: e.tier, label: e.label, distanceM: d, fontPx: e.fontPx, requiredPx, angleDeg, ok: angleDeg >= TIER_ANGLE_DEG[e.tier] - 1e-9 });
    }
  }
  const failures = rows.filter((r) => !r.ok).length;
  const worstFactor = rows.reduce((w, r) => (r.ok ? w : Math.max(w, r.requiredPx / Math.max(1, r.fontPx))), 1);
  return { rows, failures, worstFactor };
}
