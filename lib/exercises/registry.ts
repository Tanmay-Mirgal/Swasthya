/**
 * lib/exercises/registry.ts
 *
 * The exercise library shown to people. Every exercise is derived from its movement template
 * (lib/movement/template), so a template is the one place an exercise is defined. An exercise
 * with no template does not exist here: the camera could not judge it, so it is neither listed,
 * practised, recommended nor prescribed.
 */
import type { ExerciseConfig } from "./types";
import { getAllMovementTemplates } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";

export interface ExtendedExerciseConfig extends ExerciseConfig {
  bodySegment: "lower" | "upper" | "neck";
}

function fromTemplate(t: MovementTemplate): ExtendedExerciseConfig {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    difficulty: t.difficulty,
    targetReps: t.defaultReps,
    primaryJoint: t.primaryJoint,
    movement: t.movement,
    description: t.description,
    instructions: t.instructions,
    bodySegment: t.bodySegment,
  };
}

export const EXERCISE_REGISTRY: Record<string, ExtendedExerciseConfig> = Object.fromEntries(
  getAllMovementTemplates().map(fromTemplate).map((e) => [e.id, e])
);

export function getExerciseById(id: string): ExtendedExerciseConfig | null {
  return EXERCISE_REGISTRY[id] || null;
}

export function getAllExercises(): ExtendedExerciseConfig[] {
  return Object.values(EXERCISE_REGISTRY);
}
