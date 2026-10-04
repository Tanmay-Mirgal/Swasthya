/**
 * recommendationEngine.ts
 *
 * Robust, clinical-grade orthopedic recommendation algorithm for Swasthya.
 * Analyzes patient-reported concerns, anatomical segments, joint pathologies,
 * therapist assignments, and recent recovery sessions to compute accurate,
 * personalized rehabilitation recommendations.
 */

import { EXERCISE_REGISTRY, ExtendedExerciseConfig, getAllExercises } from "@/lib/exercises/registry";

export interface ClinicalProfile {
  id: string;
  name: string;
  bodySegment: "lower" | "upper" | "neck" | "spine";
  primaryJoint: string;
  secondaryJoints?: string[];
  targetMuscles: string[];
  indicatedConditions: string[]; // Specific pathologies and symptoms
  keywords: string[]; // Broader colloquial and clinical search tokens
  clinicalGoal: string; // Patient-friendly clinical reason
  contraindications?: string[];
  defaultSets: number;
  defaultReps: number;
  isAvailable: boolean;
}

export interface RecommendationResult {
  exerciseId: string;
  exercise: ExtendedExerciseConfig;
  score: number; // 0 - 100+
  confidencePercent: number; // 0 - 100
  matchedConcern?: string;
  matchType: "doctor_prescribed" | "direct_pathology" | "joint_mobility" | "segment_match" | "general_wellness";
  clinicalRationale: string;
  targetSets: number;
  targetReps: number;
  isAvailable: boolean;
}

// Comprehensive Clinical Ontology for Rehabilitation
export const CLINICAL_EXERCISE_PROFILES: Record<string, ClinicalProfile> = {
  "seated-knee-extension": {
    id: "seated-knee-extension",
    name: "Seated Knee Extension",
    bodySegment: "lower",
    primaryJoint: "knee",
    secondaryJoints: ["patellofemoral"],
    targetMuscles: ["Quadriceps femoris", "Vastus medialis oblique (VMO)", "Rectus femoris"],
    indicatedConditions: [
      "knee",
      "knee pain",
      "acl",
      "acl recovery",
      "post-op acl",
      "meniscus",
      "meniscus tear",
      "patella",
      "patellofemoral pain syndrome",
      "pfps",
      "patellar tendonitis",
      "runner's knee",
      "jumper's knee",
      "knee stiffness",
      "knee osteoarthritis",
      "tka",
      "total knee arthroplasty",
      "knee replacement",
      "quadriceps weakness",
      "terminal extension deficit",
      "leg pain",
      "lower limb recovery",
    ],
    keywords: [
      "knee",
      "quad",
      "leg",
      "patella",
      "meniscus",
      "acl",
      "knee joint",
      "extension",
      "thigh",
      "lower",
    ],
    clinicalGoal:
      "Isolates the quadriceps and activates the vastus medialis in an open-chain seated position, rebuilding terminal 0° knee extension without harmful compressive load.",
    defaultSets: 3,
    defaultReps: 10,
    isAvailable: true,
  },

  "neck-rotation": {
    id: "neck-rotation",
    name: "Cervical Neck Rotation",
    bodySegment: "neck",
    primaryJoint: "neck",
    secondaryJoints: ["cervical spine", "atlanto-axial"],
    targetMuscles: ["Sternocleidomastoid", "Splenius capitis", "Upper trapezius", "Levator scapulae"],
    indicatedConditions: [
      "neck",
      "neck pain",
      "neck stiffness",
      "tech neck",
      "forward head posture",
      "cervical",
      "cervical spine",
      "cervicalgia",
      "cervical spondylosis",
      "whiplash",
      "trapezius spasm",
      "tension headache",
      "cervicogenic headache",
      "upper spine stiffness",
      "stiff neck",
    ],
    keywords: [
      "neck",
      "cervical",
      "head",
      "throat",
      "trapezius",
      "upper back",
      "c1",
      "c2",
      "c7",
      "posture",
      "stiffness",
    ],
    clinicalGoal:
      "Restores transverse-plane cervical axial rotation, decompresses suboccipital tension, and mitigates forward head posture from prolonged desk work.",
    defaultSets: 2,
    defaultReps: 10,
    isAvailable: true,
  },

  "seated-bicep-curl": {
    id: "seated-bicep-curl",
    name: "Seated Bicep Curl",
    bodySegment: "upper",
    primaryJoint: "elbow",
    secondaryJoints: ["forearm", "wrist"],
    targetMuscles: ["Biceps brachii", "Brachialis", "Brachioradialis"],
    indicatedConditions: [
      "arm",
      "elbow",
      "bicep",
      "elbow pain",
      "tennis elbow",
      "lateral epicondylitis",
      "golfer's elbow",
      "medial epicondylitis",
      "biceps tendonitis",
      "elbow stiffness",
      "arm weakness",
      "flexor strain",
      "forearm strain",
      "elbow recovery",
    ],
    keywords: [
      "arm",
      "elbow",
      "bicep",
      "forearm",
      "curl",
      "flexion",
      "upper limb",
      "hand",
      "wrist",
    ],
    clinicalGoal:
      "Re-educates elbow sagittal flexion and strengthens biceps tendinous insertion while maintaining spinal neutral posture.",
    defaultSets: 3,
    defaultReps: 10,
    isAvailable: true,
  },

  "shoulder-raise": {
    id: "shoulder-raise",
    name: "Shoulder Lateral Raise",
    bodySegment: "upper",
    primaryJoint: "shoulder",
    secondaryJoints: ["scapulothoracic", "glenohumeral"],
    targetMuscles: ["Lateral deltoid", "Supraspinatus", "Trapezius"],
    indicatedConditions: [
      "shoulder",
      "shoulder pain",
      "rotator cuff",
      "rotator cuff tear",
      "subacromial impingement",
      "frozen shoulder",
      "adhesive capsulitis",
      "deltoid strain",
      "shoulder mobility",
      "overhead reach pain",
      "bursitis",
    ],
    keywords: [
      "shoulder",
      "rotator",
      "cuff",
      "deltoid",
      "impingement",
      "arm raise",
      "scapula",
      "overhead",
    ],
    clinicalGoal:
      "Enhances coronal plane glenohumeral abduction and stabilizes the rotator cuff force couple during arm elevation.",
    defaultSets: 3,
    defaultReps: 10,
    isAvailable: false,
  },

  "straight-leg-raise": {
    id: "straight-leg-raise",
    name: "Straight Leg Raise",
    bodySegment: "lower",
    primaryJoint: "hip",
    secondaryJoints: ["knee", "lumbar spine"],
    targetMuscles: ["Quadriceps (Rectus Femoris)", "Iliopsoas", "Tensor Fasciae Latae"],
    indicatedConditions: [
      "knee",
      "knee pain",
      "knee rehabilitation",
      "quadriceps weakness",
      "acl recovery",
      "patellar tendonitis",
      "post-op knee",
      "hip flexor strain",
      "lower limb rehabilitation",
      "sports injury",
    ],
    keywords: ["leg raise", "straight leg", "quad", "knee recovery", "knee pain", "patella"],
    clinicalGoal:
      "Strengthens the primary knee extensor and anterior hip chain with zero compressive patellofemoral shear.",
    defaultSets: 3,
    defaultReps: 10,
    isAvailable: true,
  },

  "quad-stretch": {
    id: "quad-stretch",
    name: "Quad Stretch",
    bodySegment: "lower",
    primaryJoint: "knee",
    secondaryJoints: ["hip", "quadriceps tendon"],
    targetMuscles: ["Rectus femoris", "Vastus lateralis", "Vastus medialis"],
    indicatedConditions: [
      "knee",
      "knee pain",
      "knee stiffness",
      "tight quads",
      "patellar tracking",
      "runner's knee",
      "patellofemoral pain",
      "mobility issues",
      "rehabilitation",
    ],
    keywords: ["quad stretch", "thigh stretch", "knee flexion", "knee tightness", "flexibility"],
    clinicalGoal:
      "Elongates rectus femoris and relieves tension on the superior patellar pole, promoting fluid knee excursion.",
    defaultSets: 3,
    defaultReps: 3,
    isAvailable: true,
  },
};

/**
 * Normalizes text for robust token and phrase matching
 */
function cleanTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Robust Clinical Match Score Calculator
 */
export function scoreExerciseForConcerns(
  profile: ClinicalProfile,
  concerns: string[],
  activePrescriptions: { exerciseId: string; targetSets?: number; targetReps?: number }[] = [],
  recentSessionExerciseIds: string[] = []
): { score: number; matchedConcern?: string; matchType: RecommendationResult["matchType"]; rationale: string } {
  let score = 0;
  let matchedConcern: string | undefined;
  let matchType: RecommendationResult["matchType"] = "general_wellness";
  let rationale = profile.clinicalGoal;

  // 1. Doctor Prescription Override (Highest Clinical Priority)
  const prescription = activePrescriptions.find((p) => p.exerciseId === profile.id);
  if (prescription) {
    return {
      score: 150,
      matchedConcern: "Physiotherapist Prescription",
      matchType: "doctor_prescribed",
      rationale: `Directly prescribed by your physical therapist for your recovery plan (${prescription.targetSets || 3} sets × ${prescription.targetReps || 10} reps).`,
    };
  }

  // 2. Multi-tier Semantic Evaluation across all patient concerns
  let bestConcernScore = 0;
  let bestConcernMatch: string | undefined;
  let bestMatchType: RecommendationResult["matchType"] = "general_wellness";

  for (const rawConcern of concerns) {
    if (!rawConcern || typeof rawConcern !== "string") continue;
    const concernLower = rawConcern.toLowerCase().trim();
    const concernTokens = cleanTokens(rawConcern);

    let concernScore = 0;
    let localMatchType: RecommendationResult["matchType"] = "general_wellness";

    // A. Direct Indication Match (e.g. "Knee Rehabilitation" or "ACL Recovery")
    for (const condition of profile.indicatedConditions) {
      if (concernLower.includes(condition) || condition.includes(concernLower)) {
        concernScore = Math.max(concernScore, 80);
        localMatchType = "direct_pathology";
        break;
      }
    }

    // B. Joint Match (e.g. concern has "Knee", exercise joint is "knee")
    if (concernLower.includes(profile.primaryJoint)) {
      concernScore = Math.max(concernScore, 65);
      if (localMatchType === "general_wellness") localMatchType = "joint_mobility";
    }

    if (profile.secondaryJoints?.some((sj) => concernLower.includes(sj))) {
      concernScore = Math.max(concernScore, 50);
      if (localMatchType === "general_wellness") localMatchType = "joint_mobility";
    }

    // C. Keyword & Token Overlap
    const matchingKeywords = profile.keywords.filter((kw) => concernTokens.includes(kw));
    if (matchingKeywords.length > 0) {
      concernScore = Math.max(concernScore, 40 + matchingKeywords.length * 10);
      if (localMatchType === "general_wellness") localMatchType = "joint_mobility";
    }

    // D. Segment Level Match (e.g. concern mentions "leg" / "lower" -> lower body)
    if (profile.bodySegment === "lower" && (concernLower.includes("lower") || concernLower.includes("leg"))) {
      concernScore = Math.max(concernScore, 35);
      if (localMatchType === "general_wellness") localMatchType = "segment_match";
    }
    if (profile.bodySegment === "upper" && (concernLower.includes("upper") || concernLower.includes("arm"))) {
      concernScore = Math.max(concernScore, 35);
      if (localMatchType === "general_wellness") localMatchType = "segment_match";
    }
    if (profile.bodySegment === "neck" && concernLower.includes("spine")) {
      concernScore = Math.max(concernScore, 35);
      if (localMatchType === "general_wellness") localMatchType = "segment_match";
    }

    if (concernScore > bestConcernScore) {
      bestConcernScore = concernScore;
      bestConcernMatch = rawConcern;
      bestMatchType = localMatchType;
    }
  }

  score += bestConcernScore;
  matchedConcern = bestConcernMatch;
  matchType = bestMatchType;

  // 3. Live Vision Readiness Boost (+15 pts)
  // Ensures patient gets an active camera experience immediately
  if (profile.isAvailable) {
    score += 15;
  }

  // 4. Session Adherence Bonus
  // If the user hasn't exercised this joint in recent sessions, prioritize it
  const performedRecently = recentSessionExerciseIds.filter((id) => id === profile.id).length;
  if (performedRecently === 0 && score > 20) {
    score += 10; // Prioritize unaddressed body parts
  }

  // 5. Tailor Clinical Rationale Text
  if (matchedConcern) {
    if (matchType === "direct_pathology") {
      rationale = `Customized for your ${matchedConcern}: ${profile.clinicalGoal}`;
    } else if (matchType === "joint_mobility") {
      rationale = `Targeted for your ${profile.primaryJoint} joint mobility: ${profile.clinicalGoal}`;
    } else if (matchType === "segment_match") {
      rationale = `Calibrated for ${profile.bodySegment} body rehabilitation: ${profile.clinicalGoal}`;
    }
  }

  return {
    score,
    matchedConcern,
    matchType,
    rationale,
  };
}

/**
 * Main Recommendation Engine Entrypoint
 */
export function getClinicalRecommendations({
  concerns = [],
  activePrescriptions = [],
  recentSessionExerciseIds = [],
}: {
  concerns?: string[];
  activePrescriptions?: { exerciseId: string; targetSets?: number; targetReps?: number }[];
  recentSessionExerciseIds?: string[];
}): {
  primary: RecommendationResult;
  ranked: RecommendationResult[];
  patientConcerns: string[];
} {
  const allExercises = getAllExercises();
  const scoredResults: RecommendationResult[] = [];

  for (const ex of allExercises) {
    const profile = CLINICAL_EXERCISE_PROFILES[ex.id] || {
      id: ex.id,
      name: ex.name,
      bodySegment: ex.bodySegment,
      primaryJoint: ex.primaryJoint || "general",
      targetMuscles: [],
      indicatedConditions: [ex.primaryJoint || "", ex.category.toLowerCase()],
      keywords: [ex.primaryJoint || "", ex.category.toLowerCase()],
      clinicalGoal: ex.description,
      defaultSets: 3,
      defaultReps: ex.targetReps || 10,
      isAvailable: ex.isAvailable,
    };

    const { score, matchedConcern, matchType, rationale } = scoreExerciseForConcerns(
      profile,
      concerns,
      activePrescriptions,
      recentSessionExerciseIds
    );

    // Compute 0-100 normalized confidence
    const confidencePercent = Math.min(100, Math.round((score / 120) * 100));

    // Check if therapist specified custom target reps
    const docPrescription = activePrescriptions.find((p) => p.exerciseId === ex.id);

    scoredResults.push({
      exerciseId: ex.id,
      exercise: ex,
      score,
      confidencePercent: Math.max(50, confidencePercent),
      matchedConcern,
      matchType,
      clinicalRationale: rationale,
      targetSets: docPrescription?.targetSets || profile.defaultSets,
      targetReps: docPrescription?.targetReps || profile.defaultReps,
      isAvailable: ex.isAvailable,
    });
  }

  // Sort descending by score, prioritizing available exercises on ties
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.isAvailable !== a.isAvailable) return b.isAvailable ? 1 : -1;
    return 0;
  });

  const primary = scoredResults[0];

  return {
    primary,
    ranked: scoredResults,
    patientConcerns: concerns,
  };
}
