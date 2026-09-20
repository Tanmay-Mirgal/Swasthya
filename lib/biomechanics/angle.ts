import { NormalizedLandmark } from "../pose/landmarks";

/**
 * Calculates the 2D interior angle at point B formed by points A, B, and C.
 * For knee angle: A = Hip, B = Knee (vertex), C = Ankle.
 * Returns angle in degrees [0 - 180].
 */
export function calculateAngle(
  a: NormalizedLandmark | null,
  b: NormalizedLandmark | null,
  c: NormalizedLandmark | null
): number {
  if (!a || !b || !c) return 0;

  // Vector BA = A - B
  const baX = a.x - b.x;
  const baY = a.y - b.y;

  // Vector BC = C - B
  const bcX = c.x - b.x;
  const bcY = c.y - b.y;

  // Dot product: BA • BC
  const dotProduct = baX * bcX + baY * bcY;

  // Magnitudes ||BA|| and ||BC||
  const magBA = Math.hypot(baX, baY);
  const magBC = Math.hypot(bcX, bcY);

  if (magBA === 0 || magBC === 0) return 0;

  // cos(theta) = (BA • BC) / (||BA|| * ||BC||)
  const cosTheta = Math.max(-1, Math.min(1, dotProduct / (magBA * magBC)));
  const radians = Math.acos(cosTheta);

  // Convert to degrees
  return Math.round((radians * 180) / Math.PI);
}
