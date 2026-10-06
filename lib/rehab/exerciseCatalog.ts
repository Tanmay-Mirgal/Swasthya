/**
 * lib/rehab/exerciseCatalog.ts
 *
 * The exercises a therapist can prescribe. Only exercises the camera engine can
 * actually track (they have an engine template) are prescribable: prescribing a
 * movement the app cannot count would give the patient a plan it cannot support.
 * Importable on both the server (validation) and the client (picker).
 */

import { getAllExercises, type ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { getMovementTemplate } from "@/lib/movement/template/registry";
import { bodySegmentLabel, exerciseGuideImage } from "@/lib/exercises/presentation";

export interface CatalogExercise {
  id: string;
  name: string;
  bodyArea: string;
  bodySegment: ExtendedExerciseConfig["bodySegment"];
  category: string;
  difficulty: string;
  primaryJoint: string;
  description: string;
  instructions: string[];
  defaultReps: number;
  cameraNote: string;
  guideImage?: string;
}


function toCatalog(ex: ExtendedExerciseConfig): CatalogExercise {
  return {
    id: ex.id,
    name: ex.name,
    bodyArea: bodySegmentLabel(ex.bodySegment),
    bodySegment: ex.bodySegment,
    category: ex.category,
    difficulty: ex.difficulty,
    primaryJoint: ex.primaryJoint,
    description: ex.description,
    instructions: ex.instructions,
    defaultReps: ex.targetReps,
    cameraNote: getMovementTemplate(ex.id)?.camera.hint ?? "Make sure the joint being moved is fully visible.",
    guideImage: exerciseGuideImage(ex.id),
  };
}

export function getPrescribableExercises(): CatalogExercise[] {
  return getAllExercises()
    .filter((ex) => ex.isAvailable && getMovementTemplate(ex.id) !== null)
    .map(toCatalog)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPrescribableExercise(id: string): CatalogExercise | null {
  return getPrescribableExercises().find((e) => e.id === id) ?? null;
}

export function searchCatalog(
  list: CatalogExercise[],
  q: { text?: string; bodyArea?: string; difficulty?: string; category?: string }
): CatalogExercise[] {
  const text = q.text?.trim().toLowerCase();
  return list.filter((e) => {
    if (q.bodyArea && e.bodyArea !== q.bodyArea) return false;
    if (q.difficulty && e.difficulty !== q.difficulty) return false;
    if (q.category && e.category !== q.category) return false;
    if (!text) return true;
    return [e.name, e.bodyArea, e.category, e.primaryJoint, e.description].some((f) => f.toLowerCase().includes(text));
  });
}
