import { ExerciseTemplate } from "../types";
import { seatedKneeExtensionTemplate } from "./seatedKneeExtension";
import { seatedBicepCurlTemplate } from "./seatedBicepCurl";
import { neckRotationTemplate } from "./neckRotation";

const TEMPLATE_REGISTRY: Record<string, ExerciseTemplate> = {
  "seated-knee-extension": seatedKneeExtensionTemplate,
  "seated-bicep-curl": seatedBicepCurlTemplate,
  "neck-rotation": neckRotationTemplate,
};

export function getTemplate(exerciseId: string): ExerciseTemplate | null {
  return TEMPLATE_REGISTRY[exerciseId] ?? null;
}

export { seatedKneeExtensionTemplate, seatedBicepCurlTemplate, neckRotationTemplate };
