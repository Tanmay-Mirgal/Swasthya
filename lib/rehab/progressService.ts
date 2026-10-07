/**
 * lib/rehab/progressService.ts
 *
 * Reads a patient's prescribed history for one exercise and turns it into the honest facts in progressFacts.
 * Free practice is left out on purpose: it has no plan day and no fixed dose, so it is not comparable.
 */
import ExerciseSession, { type IExerciseSession } from "@/models/ExerciseSession";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import type { HistorySession } from "./progressFacts";

const HISTORY_LIMIT = 40;

/** One stored exercise-day, as the evidence rules see it. */
export function toHistory(s: Pick<IExerciseSession, "dateKey" | "exerciseId" | "engineVersion" | "validReps" | "invalidReps" | "partialReps" | "rom" | "targetRom">): HistorySession | null {
  if (!s.dateKey) return null;
  const judged = (s.engineVersion ?? 0) >= 2 && s.validReps !== undefined && s.invalidReps !== undefined;
  return {
    dateKey: s.dateKey,
    exerciseId: s.exerciseId,
    judged,
    engine: s.engineVersion,
    validReps: s.validReps,
    invalidReps: s.invalidReps,
    partialReps: s.partialReps,
    rom: s.rom > 0 ? s.rom : undefined,
    romUnit: getMovementTemplate(s.exerciseId)?.rep.unit,
    targetRom: s.targetRom,
  };
}

/** The patient's prescribed sessions of one exercise, newest first. */
export async function historyFor(patientId: string, exerciseId: string): Promise<HistorySession[]> {
  const rows = await ExerciseSession.find(
    { patientId, exerciseId, prescriptionId: { $exists: true }, dateKey: { $exists: true } },
    { dateKey: 1, exerciseId: 1, engineVersion: 1, validReps: 1, invalidReps: 1, partialReps: 1, rom: 1, targetRom: 1 }
  )
    .sort({ date: -1 })
    .limit(HISTORY_LIMIT)
    .lean<IExerciseSession[]>();
  return rows.map(toHistory).filter((h): h is HistorySession => h !== null);
}
