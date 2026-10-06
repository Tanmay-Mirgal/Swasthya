---
name: pose-analysis-review
description: Review or debug pose tracking quality in the movement pipeline: landmark stabilisation, confidence levels, camera advice, aspect-ratio correct geometry, body-relative measurement, jitter, left/right and mirroring. Use when reps miscount, joints flicker, a camera is "not seen", or measurements change with distance or device.
---

# Reviewing pose analysis

Pipeline (all under `lib/movement`, pure TypeScript, no React):
`signal/stabilizer.ts` (One Euro filter, time-based) → `signal/confidence.ts` (HIGH/MEDIUM/LOW, debounced) → `framing/cameraCheck.ts` (advice) → `geometry/geometry.ts` + `judge/metrics.ts` (aspect-corrected, body-relative) → `judge/engine.ts`.

## Checklist when something is off

1. **Reproduce without a camera.** `npm run movement:replay -- <scenario>` or build a case with `testing/synth.ts` (frame size, `pxPerM` for distance, `noisePx`, per-landmark `vis`). If it cannot be reproduced synthetically, record landmarks from the browser into the trace JSON format described in `scripts/movement_replay.ts`.
2. **Geometry.** x in MediaPipe is normalised by width and y by height. 2D angles MUST go through `angle2D(..., aspect)`; a raw-normalised angle on a 16:9 frame is wrong by tens of degrees. Missing input returns `NaN`, never `0`. Never compare raw pixel distances: divide by a body scale (`metrics.ts` `scale()`).
3. **Confidence gate.** No rep, no error and no red while confidence is LOW. Weak joints go yellow (`JOINT_UNCERTAIN`) and the person gets camera advice. Any change that lets judgment run on a low-confidence frame is a bug.
4. **Smoothing.** One Euro: `minCutoff` (jitter at rest) vs `beta` (lag while moving). Tests pin both (`signal.test.ts`: jitter cut >= 60%, lag < 0.02 normalised, frame-rate independence). Do not add a fixed-alpha average on top.
5. **Side handling.** `sideMode: auto` picks the better-seen side with hysteresis and never switches mid-rep. Left/right are the SUBJECT's side; the video and canvas are mirrored only by CSS (`scale-x-[-1]`), never in the maths.
6. **Distance/size invariance.** The same exercise must count the same at other resolutions, portrait, distance and body sizes (`engine.test.ts` covers four frame configurations). Keep that test green.
7. **Camera advice thresholds** (`cameraCheck.ts`): span is measured in image-height units against the frame's shorter side so portrait phones are judged fairly.

## What to report

State what is verified on synthetic geometry and what needs a real camera (MediaPipe's own accuracy, GPU/CPU delegate, lighting, occlusion, lying poses which it tracks poorly). Never claim real-camera accuracy that was not measured.
