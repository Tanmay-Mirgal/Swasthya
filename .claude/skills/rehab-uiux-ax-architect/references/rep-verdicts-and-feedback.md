# Rep verdicts, feedback loop, plain language, body-anchored cues

## 1. Verdict language (one visual vocabulary, used everywhere)

| Verdict | Engine source | Mark | Word (stage) | Plain follow-up | Skeleton | Counter | Audio |
|---|---|---|---|---|---|---|---|
| VALID | `rep_completed` | ✓ | Good | (first rep) "Great start." | joints green ring | +1 | short, calm, not every rep (voicePolicy) |
| INVALID | `rep_not_counted` | ✕ | Not counted | the ONE correction, e.g. "Turn your head a little farther." | affected part: large disc with cross | unchanged | "That one wasn't counted." then the correction |
| PARTIAL | `partial_rep` (`almost`) | ↗ | Almost | "A little farther." / "Go a bit further." | target cue toward the peak | unchanged | "Not counted. A little farther." |
| UNCERTAIN | `uncertain_rep`, low confidence, camera advice | ? | Couldn't see clearly | "I can't see your arm clearly. Step back a little." | dashed hollow ring | unchanged | camera advice only, no blame |

Rules:
- The counter moves only on VALID. ALMOST and NOT COUNTED never nudge it, and the wording never implies they did.
- UNCERTAIN is the system's limit, not the person's mistake: never red, never "wrong", never counted against streaks or observations.
- A verdict is visible long enough to read from 2 m (about 2-3 s) and is announced to assistive tech once (`role="status"`, keyed by `Verdict.seq`), not every frame.
- Today `coach/coachState.ts` `Verdict.kind` is `good | not_counted | partial`. There is no `uncertain` kind, so low-confidence moments reach the screen through the camera-advice banner and `ConfidenceBadge`. Giving UNCERTAIN a first-class verdict is a coach change (see `rehab-feedback-engine`), not a UI-only tweak. Raise it as a recommendation.
- Reps are never silently dropped: `AttemptRecord` keeps every non-counted attempt for the report; the live UI just frames them kindly.

## 2. Feedback loop: DETECT → EXPLAIN → CORRECT → CONFIRM

```
engine detects (insufficient range / broken rule)
  -> EXPLAIN   "Not counted"                      verdict band, ✕ + word
  -> CORRECT   "Raise your arm a little higher"   one instruction, same band; affected part highlighted
  -> person corrects
  -> engine: movement_corrected
  -> CONFIRM   "Nice correction ✓"                body part turns green, ✓, once
```

- **One primary correction at a time.** The coach chooses by priority (camera > major form > moderate > range > minor > tempo > praise) and respects cooldowns; the UI shows `ui.cue` and `ui.verdict` only. If the UI is tempted to show a list of errors, the design is wrong; the detail goes to the end-of-set summary or the therapist report.
- Corrections wait for a quiet moment (rest/peak), not mid-movement, except safety/camera.
- A fixed problem is acknowledged once, only if the person had been told about it.
- Never repeat the same sentence twice in 30 s; never escalate to alarm. The next tier is more specific, not louder.
- Wording lives in `lib/movement/template/templates/*.ts` and `coach/messages.ts` / `coach/config.ts`, validated by `coach/cueValidation.ts` (no digits, jargon, diagnosis, "push through", > 20 words). Propose copy in a design doc, but implement it through the template, via the `rehab-feedback-engine` skill.

## 3. WHERE · WHAT · HOW TO FIX

| Question | Channel |
|---|---|
| WHERE | Affected body part highlighted on the skeleton (`components/movement/overlay.ts`), optional directional arrow, joint strip repeats it in words |
| WHAT | Verdict word + mark in the stage band |
| HOW TO FIX | One plain instruction (visual + optional voice + optional caption) |

Example: red head → "✕ Not counted" → "Turn your head a little farther." After correction: green head → "✓ Nice correction". The skeleton is part of the interaction: clear states, affected-part emphasis, subtle target cue, state transitions, and never clutter. Do not draw large UI over the face or torso. Any new overlay drawing is made in `overlay.ts` and must respect mirroring and canvas scaling; do not touch the coordinate mapping to achieve it.

## 4. Plain language (never expose the machinery)

| Never say | Say |
|---|---|
| landmark / pose estimation / tracking lost | "I can't see your arm clearly." |
| confidence below threshold | "I'm not sure I can see you. Step back a little." |
| angle too low / ROM insufficient | "Raise your arm a little higher." |
| invalid rep / rule violation | "That one wasn't counted." |
| partial rep | "Almost. A little farther." |
| error / failed / wrong posture | say what to do ("Keep your knee over your foot") |
| tempo violation | "Try moving more slowly." |
| camera permission denied | "The camera is off. You can allow it, or count your reps yourself." |

Tone: second person, short, kind, no blame, no urgency, no medical claims. Numbers appear only where a person needs them (rep count, set count, seconds of rest); degrees and percentages stay in the details panel and therapist views. Sentences at most ~12 words on the stage.

## 5. Micro-interaction moments

| Moment | Copy | Why it exists / emotion | Motion |
|---|---|---|---|
| First valid rep | "Great start." | Confirms it works; confidence | counter swap only |
| Valid rep (rest) | "Good" (verdict) | Instant yes/no | 200 ms fade |
| Correction accepted | "Nice correction ✓" | Learning is rewarded, not just success | body part green, 300 ms |
| Set complete | "Set complete ✓" | Chunk the effort; permission to rest | one tick draw, 400 ms |
| Exercise complete | "Exercise complete." | Closure | calm, no confetti |
| Routine complete | "Today's routine complete." | Daily goal met | one tick row fills |
| Personal best (only with real, comparable data) | "That's your best range so far." | "I am getting better" | quiet highlight |

If a moment cannot state why it exists and what feeling it produces, delete it.

## 6. Engagement, honestly

Build the "I am getting better" loop from real stored data: personal best range, consistency across the week (tick row), mastery of an exercise (share of good reps over time, `trends.ts`), daily goal met, a therapist's real note or review. Do not use XP, coins, leaderboards, aggressive streaks, guilt, punishment, confetti everywhere or fake achievements. Never compare sessions from different engine versions (`engineVersion`, `version.ts`). When there is no data, design an honest empty state with the one next step.

## 7. Therapist presence

Show therapist context only from real records (`Prescription` instructions and notes, `WeeklyReview`, session reviews): "Your therapist's tip", "Your therapist reviewed your session", "Prescribed by Dr. X". Therapist-written words use `Authorship by="therapist"` and the Pen face; automated output uses `Authorship by="automated"` and Geist. AI summaries carry the disclosure string from `reportService` and sit apart from the therapist's assessment. Never fabricate therapist activity or presence.
