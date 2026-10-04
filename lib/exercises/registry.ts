import { ExerciseConfig } from "./types";
import { seatedKneeExtensionConfig } from "./seatedKneeExtension";
import { seatedBicepCurlConfig } from "./seatedBicepCurl";
import { neckRotationConfig } from "./neckRotation";

export interface ExtendedExerciseConfig extends ExerciseConfig {
  bodySegment: "lower" | "upper" | "neck";
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
  "neck-rotation": {
    ...neckRotationConfig,
    bodySegment: "neck",
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
  "straight-leg-raise": {
    id: "straight-leg-raise",
    name: "Straight Leg Raise",
    category: "Lower Body",
    difficulty: "Beginner",
    targetReps: 10,
    primaryJoint: "hip",
    movement: "flexion",
    description: "Strengthen quadriceps and hip flexors without putting stress on knee joint.",
    instructions: ["Lie flat on back or sit supported", "Tighten quad and raise leg 12 inches", "Hold 3 seconds and lower slowly"],
    bodySegment: "lower",
    isAvailable: true,
  },
  "quad-stretch": {
    id: "quad-stretch",
    name: "Quad Stretch",
    category: "Flexibility & Mobility",
    difficulty: "Beginner",
    targetReps: 3,
    primaryJoint: "knee",
    movement: "flexion",
    description: "Elongates anterior thigh muscles, relieves patellar tension and improves flexibility.",
    instructions: ["Hold steady support", "Gently bend knee pulling heel toward glute", "Hold 30 seconds smoothly"],
    bodySegment: "lower",
    isAvailable: true,
  },
};

export function getExerciseById(id: string): ExtendedExerciseConfig | null {
  return EXERCISE_REGISTRY[id] || null;
}

export function getAllExercises(): ExtendedExerciseConfig[] {
  return Object.values(EXERCISE_REGISTRY);
}
