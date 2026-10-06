import type { MovementTemplate } from "../schema";

/**
 * Mini Squat, from the front. Camera in front, both legs and hips in view. Depth is measured
 * from the front as how much the thigh appears to shorten against the shin, relative to the
 * person's own standing posture (captured during set-up). Knee alignment is measured as how
 * far each knee drifts toward the middle of the body, off the line from hip to ankle, as a
 * share of hip width. Both are best-effort from one camera angle: depth in particular depends
 * on the camera being near hip height. Hold a steady support if balance is a concern.
 */
export const miniSquat: MovementTemplate = {
  id: "mini-squat",
  version: 1,
  name: "Mini Squat",
  description: "Bend your knees a short way, as if starting to sit, keeping your knees in line with your feet, then stand tall again.",
  category: "Lower Body",
  difficulty: "Intermediate",
  bodyPart: "Hip and knee",
  bodySegment: "lower",
  primaryJoint: "knee",
  movement: "flexion",
  defaultReps: 10,
  instructions: [
    "Stand tall facing the camera with your feet about shoulder-width apart, near a steady support.",
    "Place the camera at about hip height so both legs are in view.",
    "Bend your knees a short way, pushing your hips back, keeping your knees over your feet.",
    "Stand tall again, slowly.",
  ],
  camera: {
    view: "front",
    minBodyFraction: 0.25,
    maxBodyFraction: 0.9,
    hint: "Front view at about hip height, about 2 to 2.5 m away, so both hips, knees and feet are in frame.",
    segmentWord: "legs",
  },
  sideMode: "left",
  landmarks: {
    required: [
      { joint: "hip", side: "left" },
      { joint: "hip", side: "right" },
      { joint: "knee", side: "left" },
      { joint: "knee", side: "right" },
      { joint: "ankle", side: "left" },
      { joint: "ankle", side: "right" },
    ],
    optional: [],
  },
  metrics: {
    depth: {
      kind: "verticalRatio",
      a: { joint: "hip", side: "left" },
      b: { joint: "knee", side: "left" },
      c: { joint: "knee", side: "left" },
      d: { joint: "ankle", side: "left" },
      baseline: "ratioDrop",
    },
    kneeInLeft: { kind: "lineOffsetInward", point: { joint: "knee", side: "left" }, end1: { joint: "hip", side: "left" }, end2: { joint: "ankle", side: "left" }, scale: "hipWidth" },
    kneeInRight: { kind: "lineOffsetInward", point: { joint: "knee", side: "right" }, end1: { joint: "hip", side: "right" }, end2: { joint: "ankle", side: "right" }, scale: "hipWidth" },
  },
  setup: {
    instruction: "Stand tall facing the camera, feet shoulder-width apart, near a steady support.",
    holdMs: 1200,
    stableWithin: 0.06,
  },
  phaseLabels: { rest: "Standing", out: "Bending", peak: "Low point", back: "Standing up" },
  phaseCues: {
    rest: "Ready. Bend your knees a short way.",
    out: "Keep bending slowly, knees over your feet.",
    peak: "Good. Now stand back up slowly.",
    back: "Stand tall again, with control.",
  },
  rep: {
    metric: "depth",
    direction: "increase",
    restThreshold: 0.04,
    leaveThreshold: 0.06,
    countThreshold: 0.12,
    peakThreshold: 0.18,
    returnDrop: 0.04,
    minRepMs: 2200,
    maxRepMs: 16000,
    debounceMs: 1000,
    returnStallMs: 4500,
    abandonMs: 30000,
    displayScale: 100,
    unit: "pct",
  },
  repRules: {
    range: {
      id: "insufficient_depth",
      label: "Did not bend the knees far enough",
      severity: "minor",
      invalidatesRep: true,
      landmarks: [{ joint: "knee", side: "left" }, { joint: "knee", side: "right" }],
      low: {
        observation: "the knees did not bend as far as the target depth",
        texts: [
          "Bend your knees a little further, pushing your hips back.",
          "Lower your hips a little more, keeping your weight over your feet.",
          "Take your time and bend your knees a little deeper, only as far as is comfortable.",
        ],
      },
      ack: "Good, that was a deeper bend.",
    },
    tooFast: {
      id: "too_fast",
      label: "Moved too quickly",
      severity: "moderate",
      invalidatesRep: false,
      landmarks: [{ joint: "knee", side: "left" }, { joint: "knee", side: "right" }],
      low: {
        observation: "the squat was quicker than the controlled pace",
        texts: [
          "Slow down. Lower your hips over about two seconds.",
          "Control the way down so your knees stay steady.",
          "Count two seconds as your knees bend and two as you stand back up.",
        ],
      },
      ack: "Nice, that was a controlled pace.",
    },
    incompleteReturn: {
      id: "incomplete_return",
      label: "Did not stand fully",
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "hip", side: "left" }, { joint: "hip", side: "right" }],
      high: {
        observation: "the person did not stand all the way back up before the next squat",
        texts: [
          "Stand all the way up, with your hips and knees straight, before the next squat.",
          "Finish standing tall, with your hips and knees straight, at the top of each squat.",
          "Straighten your hips and knees fully before you bend again.",
        ],
      },
    },
  },
  rules: [
    {
      id: "knee_inward_left",
      label: "Left knee drifting inward",
      kind: "alignment",
      metric: "kneeInLeft",
      phases: ["out", "peak", "back"],
      max: 0.25,
      release: 0.06,
      sustainMs: 400,
      recoverMs: 300,
      severity: "moderate",
      invalidatesRep: true,
      landmarks: [{ joint: "knee", side: "left" }],
      bones: [[{ joint: "hip", side: "left" }, { joint: "knee", side: "left" }], [{ joint: "knee", side: "left" }, { joint: "ankle", side: "left" }]],
      high: {
        observation: "the left knee is drifting toward the middle of the body",
        texts: [
          "Your left knee is drifting inward. Keep it in line with your left foot.",
          "Push your left knee out slightly so it stays over your foot as you lower.",
          "Slow down and keep your left knee directly over your left foot.",
        ],
      },
      ack: "Good correction, your left knee is lined up.",
    },
    {
      id: "knee_inward_right",
      label: "Right knee drifting inward",
      kind: "alignment",
      metric: "kneeInRight",
      phases: ["out", "peak", "back"],
      max: 0.25,
      release: 0.06,
      sustainMs: 400,
      recoverMs: 300,
      severity: "moderate",
      invalidatesRep: true,
      landmarks: [{ joint: "knee", side: "right" }],
      bones: [[{ joint: "hip", side: "right" }, { joint: "knee", side: "right" }], [{ joint: "knee", side: "right" }, { joint: "ankle", side: "right" }]],
      high: {
        observation: "the right knee is drifting toward the middle of the body",
        texts: [
          "Your right knee is drifting inward. Keep it in line with your right foot.",
          "Push your right knee out slightly so it stays over your foot as you lower.",
          "Slow down and keep your right knee directly over your right foot.",
        ],
      },
      ack: "Good correction, your right knee is lined up.",
    },
  ],
  statusJoints: [
    { label: "Left hip", ref: { joint: "hip", side: "left" } },
    { label: "Left knee", ref: { joint: "knee", side: "left" } },
    { label: "Left ankle", ref: { joint: "ankle", side: "left" } },
    { label: "Right hip", ref: { joint: "hip", side: "right" } },
    { label: "Right knee", ref: { joint: "knee", side: "right" } },
    { label: "Right ankle", ref: { joint: "ankle", side: "right" } },
  ],
  commonMistakes: ["Knees drifting inward", "Dropping quickly", "Heels lifting", "Not standing fully between reps"],
};
