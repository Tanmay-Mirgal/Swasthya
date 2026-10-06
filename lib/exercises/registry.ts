/**
 * lib/exercises/registry.ts
 *
 * The exercise library shown to people. Every exercise the camera can actually judge is
 * derived from its movement template (lib/movement/template), so a template is the one
 * place an exercise is defined. A few well-known exercises with no template yet are listed
 * as unavailable ("coming soon"); they are never offered for tracking or prescribing.
 */
import type { ExerciseConfig } from "./types";
import { getAllMovementTemplates } from "@/lib/movement/template/registry";
import type { MovementTemplate } from "@/lib/movement/template/schema";

export interface ExtendedExerciseConfig extends ExerciseConfig {
  bodySegment: "lower" | "upper" | "neck";
  isAvailable: boolean;
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
    isAvailable: true,
  };
}

/** Listed so people can see what is planned; no camera tracking exists for these yet. */
const COMING_SOON: ExtendedExerciseConfig[] = [
  {
    id: "straight-leg-raise",
    name: "Straight Leg Raise",
    category: "Lower Body",
    difficulty: "Beginner",
    targetReps: 10,
    primaryJoint: "hip",
    movement: "flexion",
    description: "Strengthen the quadriceps and hip flexors without stress on the knee joint.",
    instructions: ["Lie flat or sit supported", "Tighten the thigh and raise the leg", "Hold, then lower slowly"],
    bodySegment: "lower",
    isAvailable: false,
  },
  {
    id: "quad-stretch",
    name: "Quad Stretch",
    category: "Flexibility & Mobility",
    difficulty: "Beginner",
    targetReps: 3,
    primaryJoint: "knee",
    movement: "flexion",
    description: "Lengthens the front of the thigh and improves flexibility.",
    instructions: ["Hold a steady support", "Gently bend the knee, heel toward buttock", "Hold smoothly"],
    bodySegment: "lower",
    isAvailable: false,
  },
];

export const EXERCISE_REGISTRY: Record<string, ExtendedExerciseConfig> = Object.fromEntries(
  [...getAllMovementTemplates().map(fromTemplate), ...COMING_SOON].map((e) => [e.id, e])
);

export function getExerciseById(id: string): ExtendedExerciseConfig | null {
  return EXERCISE_REGISTRY[id] || null;
}

export function getAllExercises(): ExtendedExerciseConfig[] {
  return Object.values(EXERCISE_REGISTRY);
}
