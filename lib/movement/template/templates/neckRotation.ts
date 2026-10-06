import type { MovementTemplate } from "../schema";

/**
 * Neck Rotation. Camera in front at about eye level, head and both shoulders in frame.
 * Primary metric: how far the nose has moved sideways from where it was at the start,
 * as a fraction of shoulder width (so it does not depend on camera distance). A turn to
 * EITHER side and back to centre is one repetition. Shown to the patient as a percentage.
 */
export const neckRotation: MovementTemplate = {
  id: "neck-rotation",
  version: 2,
  name: "Neck Rotation",
  description: "Gently turn your head side to side while seated upright. Helps neck movement and eases stiffness.",
  category: "Neck & Upper Body",
  difficulty: "Beginner",
  bodyPart: "Neck",
  bodySegment: "neck",
  primaryJoint: "cervical",
  movement: "rotation",
  defaultReps: 8,
  instructions: [
    "Sit upright facing the camera with your shoulders level.",
    "Slowly turn your head to one side as far as is comfortable, then return to centre.",
    "Then turn to the other side and return to centre.",
    "Each turn and return to centre counts as one repetition.",
  ],
  camera: {
    view: "front",
    minBodyFraction: 0.08,
    maxBodyFraction: 0.7,
    hint: "Front view at about eye level, with your head and both shoulders in frame.",
    segmentWord: "head and shoulders",
  },
  sideMode: "left",
  landmarks: {
    required: [{ joint: "nose" }, { joint: "shoulder", side: "left" }, { joint: "shoulder", side: "right" }],
    optional: [{ joint: "ear", side: "left" }, { joint: "ear", side: "right" }],
  },
  metrics: {
    turn: {
      kind: "offsetX",
      point: { joint: "nose" },
      ref1: { joint: "shoulder", side: "left" },
      ref2: { joint: "shoulder", side: "right" },
      scale: "shoulderWidth",
      baseline: "delta",
      abs: true,
    },
    turnRaw: {
      kind: "offsetX",
      point: { joint: "nose" },
      ref1: { joint: "shoulder", side: "left" },
      ref2: { joint: "shoulder", side: "right" },
      scale: "shoulderWidth",
    },
    shoulderSlope: {
      kind: "offsetY",
      point: { joint: "shoulder", side: "left" },
      from: { joint: "shoulder", side: "right" },
      scale: "shoulderWidth",
    },
  },
  setup: {
    instruction: "Face the camera with your head centred and your shoulders level.",
    holdMs: 1000,
    stableWithin: 0.05,
    conditions: [
      { metric: "turnRaw", min: -0.14, max: 0.14 },
      { metric: "shoulderSlope", min: -0.18, max: 0.18 },
    ],
  },
  phaseLabels: { rest: "Centred", out: "Turning", peak: "Turned", back: "Returning" },
  phaseCues: {
    rest: "Ready. Slowly turn your head to one side.",
    out: "Keep turning as far as is comfortable.",
    peak: "Good. Now return slowly to the centre.",
    back: "Come back to centre, then turn the other way.",
  },
  rep: {
    metric: "turn",
    direction: "increase",
    restThreshold: 0.05,
    leaveThreshold: 0.07,
    countThreshold: 0.1,
    peakThreshold: 0.12,
    returnDrop: 0.03,
    minRepMs: 1200,
    maxRepMs: 12000,
    debounceMs: 600,
    returnStallMs: 3500,
    abandonMs: 20000,
    displayScale: 100,
    unit: "pct",
  },
  repRules: {
    range: {
      id: "insufficient_turn",
      label: "Head not turned far enough",
      severity: "minor",
      invalidatesRep: true,
      landmarks: [{ joint: "nose" }],
      low: {
        observation: "the head turned less far than the target range",
        texts: [
          "Turn your head a little further, as far as is comfortable.",
          "Look a bit further over your shoulder, staying within comfort.",
          "Take your time and turn your head a little further without forcing it.",
        ],
      },
      ack: "Good, that turn went further.",
    },
    tooFast: {
      id: "too_fast",
      label: "Moved too quickly",
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "nose" }],
      low: {
        observation: "the head turn was quicker than the controlled pace",
        texts: [
          "Turn your head more slowly and keep the movement smooth.",
          "Slow your head turn down so it takes a couple of seconds each way.",
          "Count two seconds turning your head and two returning to centre.",
        ],
      },
      ack: "Nice, that was smooth and slow.",
    },
    incompleteReturn: {
      id: "incomplete_return",
      label: "Did not return to centre",
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "nose" }],
      high: {
        observation: "the head did not come back to the centre",
        texts: [
          "Bring your head back to the centre before you turn again.",
          "Return your nose to the middle, between your shoulders.",
          "Finish coming back to centre slowly before the next turn.",
        ],
      },
    },
  },
  rules: [
    {
      id: "shoulders_uneven",
      label: "Shoulders lifting or tilting",
      kind: "compensation",
      metric: "shoulderSlope",
      phases: ["out", "peak", "back"],
      min: -0.2,
      max: 0.2,
      release: 0.04,
      sustainMs: 600,
      recoverMs: 300,
      severity: "minor",
      invalidatesRep: false,
      landmarks: [{ joint: "shoulder", side: "left" }, { joint: "shoulder", side: "right" }],
      bones: [[{ joint: "shoulder", side: "left" }, { joint: "shoulder", side: "right" }]],
      low: {
        observation: "the shoulders are not level",
        texts: [
          "Keep both shoulders level and relaxed as your head turns.",
          "Let your shoulders drop and stay even while you turn.",
          "Relax your shoulders and move only your head.",
        ],
      },
      high: {
        observation: "the shoulders are not level",
        texts: [
          "Keep both shoulders level and relaxed as your head turns.",
          "Let your shoulders drop and stay even while you turn.",
          "Relax your shoulders and move only your head.",
        ],
      },
      ack: "Good correction, your shoulders are level.",
    },
  ],
  statusJoints: [
    { label: "Head", ref: { joint: "nose" } },
    { label: "Left shoulder", ref: { joint: "shoulder", side: "left" } },
    { label: "Right shoulder", ref: { joint: "shoulder", side: "right" } },
  ],
  commonMistakes: ["Lifting a shoulder while turning", "Tilting the head instead of turning it", "Turning too quickly", "Forcing past comfort"],
};
