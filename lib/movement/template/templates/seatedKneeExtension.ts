import type { MovementTemplate } from "../schema";

/**
 * Seated Knee Extension. Camera side-on, 1.5 to 2.5 m away, whole leg and torso in frame.
 * Primary metric: the knee's interior angle (hip-knee-ankle). Rest ~90 degrees, peak near straight.
 */
export const seatedKneeExtension: MovementTemplate = {
  id: "seated-knee-extension",
  version: 2,
  name: "Seated Knee Extension",
  description: "Sit upright on a stable chair and slowly extend one leg forward until it is straight, then lower it under control.",
  category: "Lower Body",
  difficulty: "Beginner",
  bodyPart: "Knee",
  bodySegment: "lower",
  primaryJoint: "knee",
  movement: "extension",
  defaultReps: 10,
  instructions: [
    "Sit upright on a chair with your feet flat on the floor.",
    "Place the camera at the side so your shoulder, hip, knee and ankle are all in view.",
    "Slowly straighten one leg forward until it is straight.",
    "Lower your leg back down in a slow, controlled motion.",
  ],
  camera: {
    view: "side",
    minBodyFraction: 0.3,
    maxBodyFraction: 0.88,
    hint: "Side view, about 1.5 to 2.5 m away, so the whole leg is in frame.",
    segmentWord: "leg",
  },
  sideMode: "auto",
  landmarks: {
    required: [{ joint: "shoulder" }, { joint: "hip" }, { joint: "knee" }, { joint: "ankle" }],
    optional: [{ joint: "foot" }, { joint: "heel" }],
  },
  metrics: {
    knee: { kind: "angle", a: { joint: "hip" }, b: { joint: "knee" }, c: { joint: "ankle" } },
    trunk: { kind: "fromVertical", a: { joint: "shoulder" }, b: { joint: "hip" } },
  },
  setup: {
    instruction: "Sit tall with your knee bent about 90 degrees and your side to the camera.",
    holdMs: 900,
    conditions: [{ metric: "trunk", max: 25 }],
  },
  phaseLabels: { rest: "Ready", out: "Straightening", peak: "Top", back: "Lowering" },
  phaseCues: {
    rest: "Ready. Slowly straighten your leg.",
    out: "Keep straightening your leg.",
    peak: "Good. Hold briefly, then lower.",
    back: "Lower your leg slowly.",
  },
  rep: {
    metric: "knee",
    direction: "increase",
    restThreshold: 108,
    leaveThreshold: 116,
    countThreshold: 130,
    peakThreshold: 150,
    returnDrop: 10,
    minRepMs: 1600,
    maxRepMs: 14000,
    debounceMs: 800,
    returnStallMs: 3500,
    abandonMs: 25000,
    unit: "deg",
  },
  repRules: {
    range: {
      id: "insufficient_extension",
      label: "Knee not straightened fully",
      severity: "minor",
      invalidatesRep: true,
      landmarks: [{ joint: "knee" }, { joint: "ankle" }],
      bones: [[{ joint: "knee" }, { joint: "ankle" }]],
      low: {
        observation: "the knee stopped before it reached the target straightness",
        texts: [
          "Straighten your knee a little more at the top.",
          "Reach your heel forward until your leg is nearly straight.",
          "Take your time and straighten the knee as far as is comfortable.",
        ],
      },
      ack: "Good, that was a fuller extension.",
    },
    tooFast: {
      id: "too_fast",
      label: "Moved too quickly",
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "knee" }],
      low: {
        observation: "the repetition was quicker than the controlled pace",
        texts: [
          "Slow down. Take about two seconds to straighten your leg.",
          "Move more slowly and keep your knee steady as it lowers.",
          "Count two seconds as your leg straightens and two as it lowers.",
        ],
      },
      ack: "Nice, that was a controlled pace.",
    },
    incompleteReturn: {
      id: "incomplete_return",
      label: "Did not lower fully",
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "knee" }, { joint: "ankle" }],
      high: {
        observation: "the leg was not lowered back to the starting position",
        texts: [
          "Lower your foot all the way back down before the next lift.",
          "Let your foot return to the floor, with your knee bent, before lifting again.",
          "Finish lowering your leg slowly so your foot rests on the floor.",
        ],
      },
    },
  },
  rules: [
    {
      id: "trunk_lean",
      label: "Leaning the trunk",
      kind: "alignment",
      metric: "trunk",
      phases: ["out", "peak", "back"],
      max: 18,
      release: 4,
      sustainMs: 500,
      recoverMs: 300,
      severity: "major",
      invalidatesRep: true,
      landmarks: [{ joint: "shoulder" }, { joint: "hip" }],
      bones: [[{ joint: "shoulder" }, { joint: "hip" }]],
      high: {
        observation: "the upper body is leaning away from upright",
        texts: [
          "Your back is leaning. Sit tall and lift your chest as the leg moves.",
          "Keep your back upright against the chair while your leg straightens.",
          "Slow the leg down and keep your back tall against the chair.",
        ],
      },
      ack: "Good correction, your back is upright.",
    },
  ],
  statusJoints: [
    { label: "Shoulder", ref: { joint: "shoulder" } },
    { label: "Hip", ref: { joint: "hip" } },
    { label: "Knee", ref: { joint: "knee" } },
    { label: "Ankle", ref: { joint: "ankle" } },
  ],
  commonMistakes: ["Leaning back to lift the leg", "Kicking up quickly instead of a controlled lift", "Not lowering the foot all the way", "Stopping short of straight"],
};
