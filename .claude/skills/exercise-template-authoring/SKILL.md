---
name: exercise-template-authoring
description: Add or change a movement template (what correct movement means for one exercise) in lib/movement/template. Use when adding a new exercise, tuning a threshold, adding a form rule, or rewording a correction. Covers the schema, the rep cycle, rules, messages, tests and registration.
---

# Authoring an exercise template

A template is **plain data** in `lib/movement/template/templates/<camelCaseName>.ts`, registered in `lib/movement/template/registry.ts`. The generic engine (`lib/movement/judge/engine.ts`) reads it; no exercise-specific code lives in the engine. Adding an exercise must never require engine changes. If it seems to, stop and ask: the schema may need a new metric kind, not a special case.

Read first: `lib/movement/template/schema.ts` (every field is documented) and one finished template of the same view (`seatedKneeExtension.ts` side view, `neckRotation.ts` front view, `miniSquat.ts` two-leg front view).

## Steps

1. **Decide what is measured.** One *primary metric* drives the rep cycle (a joint angle, or a body-relative offset). Everything is body-relative: divide by `torso`, `shoulderWidth`, `hipWidth`, `shin` or `thigh`, never use raw pixels. Use `baseline` (`delta` / `ratioDrop`) when the person's own starting posture is the reference (heel height, squat depth, shrug).
2. **Pick landmarks.** `required` = joints that must be clearly seen or nothing is judged. Refs use `side: active` (the better-seen side is chosen) or explicit `left`/`right` (subject's side). Foot landmarks are the least reliable on the body: say so in the template comment.
3. **Write the rep cycle** (`rep`): `restThreshold < leaveThreshold < countThreshold < peakThreshold` in the direction of movement (`direction: increase | decrease`). A cycle reaching `countThreshold` is COUNTED (credits the prescription); reaching `peakThreshold` too, at a safe pace, makes it VALID. Set `minRepMs`, `debounceMs`, `returnStallMs`, `abandonMs`. `displayScale`/`unit` for non-degree metrics.
4. **Write rules** (`rules`): per-frame checks gated to the phases where they matter (`out`/`peak`/`back`), with `sustainMs` (>= 150, usually 400-600) so one noisy frame never turns anything red, and `release` (hysteresis) so a value hovering at the limit does not flap. `severity` decides priority; `invalidatesRep` decides whether the rep is flagged.
5. **Write messages.** Each rule/rep-rule needs `low` and/or `high` with `texts` (three or more, escalating: first, repeat, persistent) and an `observation` (a plain fact for the language model). Every text says WHAT, WHERE and HOW, names a body part, is under ~20 words, and never says "wrong", "incorrect", "bad posture", "try again", a number, a diagnosis, or "push through". `validateTemplate` and the coach tests enforce this.
6. **Set-up and camera.** `setup.conditions` must describe the starting position; `camera.minBodyFraction/maxBodyFraction` is the span of the required joints against the frame (use a replay to find sensible values).
7. **Register** the template and (optionally) add a reference photo to `lib/exercises/presentation.ts`. The exercise library, plan builder and tracker all derive from the registry.

## Tests (required)

- `npm run test:movement`: `templates.test.ts` validates every registered template automatically. Add behaviour tests in `lib/movement/__tests__/` using the synthetic skeleton (`lib/movement/testing/synth.ts`): clean reps are counted and valid with no errors; each rule fires on a deliberate fault; a shallow rep is counted-but-flagged; a partial attempt is not counted; too fast is flagged.
- `npm run movement:replay -- <scenario>` prints the event timeline for tuning.

## Honesty

Thresholds are engineering defaults, proven on synthetic data, not clinical advice and not yet tuned on real bodies. Say so in the template header comment, and ask for a physiotherapist's review before a new template is offered to patients.
