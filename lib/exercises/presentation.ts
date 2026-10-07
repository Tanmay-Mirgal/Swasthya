import type { ExtendedExerciseConfig } from "./registry";

/** Real exercise guide photos that exist in /public/exercise-guides. */
const GUIDE_IMAGES: Record<string, string> = {
  "neck-rotation": "/exercise-guides/neck-rotation.jpg",
  "seated-bicep-curl": "/exercise-guides/seated-bicep-curl.jpg",
  "seated-knee-extension": "/exercise-guides/seated-knee-extension.jpg",
  "sit-to-stand": "/exercise-guides/sit-to-stand.png",
  "shoulder-abduction": "/exercise-guides/shoulder-abduction.png",
  "heel-raise": "/exercise-guides/heel-raise.png",
  "mini-squat": "/exercise-guides/mini-squat.png",
  "straight-leg-raise": "/exercise-guides/straight-leg-raise.png",
  "quad-stretch": "/exercise-guides/quad-stretch.png",
};

export function exerciseGuideImage(exerciseId: string): string | undefined {
  return GUIDE_IMAGES[exerciseId];
}

const SEGMENT_LABEL: Record<ExtendedExerciseConfig["bodySegment"], string> = {
  upper: "Upper body",
  lower: "Lower body",
  neck: "Neck and spine",
};

export function bodySegmentLabel(segment: ExtendedExerciseConfig["bodySegment"]): string {
  return SEGMENT_LABEL[segment] ?? "Whole body";
}

export function titleCase(value?: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
