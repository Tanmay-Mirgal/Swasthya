import { ExerciseConfig } from "./types";
import { seatedKneeExtensionConfig } from "./seatedKneeExtension";
import { seatedBicepCurlConfig } from "./seatedBicepCurl";

export interface ExtendedExerciseConfig extends ExerciseConfig {
  bodySegment: "lower" | "upper";
  isAvailable: boolean;
}

export const EXERCISE_REGISTRY: Record<string, ExtendedExerciseConfig> = {
  "seated-bicep-curl": {
    ...seatedBicepCurlConfig,
    bodySegment: "upper",
    isAvailable: true,
  },
  "seated-knee-extension": {
    ...seatedKneeExtensionConfig,
    bodySegment: "lower",
    isAvailable: true,
  },
  "shoulder-raise": {
    id: "shoulder-raise",
    name: "Shoulder Lateral Raise",
    category: "Upper Body",
    difficulty: "Beginner",
    targetReps: 10,
    primaryJoint: "shoulder",
    movement: "abduction",
    description: "Raise arm laterally to shoulder height while sitting upright.",
    instructions: ["Raise arm to side", "Lower smoothly"],
    bodySegment: "upper",
    isAvailable: false,
  },
};

export function getExerciseById(id: string): ExtendedExerciseConfig | null {
  return EXERCISE_REGISTRY[id] || null;
}

export function getAllExercises(): ExtendedExerciseConfig[] {
  return Object.values(EXERCISE_REGISTRY);
}
