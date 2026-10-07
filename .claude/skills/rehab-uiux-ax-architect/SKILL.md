---
name: rehab-uiux-ax-architect
description: Senior UI + UX + accessibility (AX) + older-adult interaction design for Swasthya's patient experience, judged as one system. Use whenever the task is to design, review, critique, redesign or implement a patient-facing screen or flow, above all the live exercise screen (camera stage, rep verdicts, corrections, counters, rest, set and routine completion), or to decide how a state should look, read, sound and move, or to audit readability from 1-2 metres, older-adult usability, cognitive load, engagement or motivation. Also use for "is this accessible", "can they read this from the sofa", "does the UI say whether the rep counted", and before changing any patient copy, motion, colour-state or layout. Not for backend, the movement engine's judgement, or therapist-dashboard density (use DESIGN.md directly there).
---

# Swasthya UI + UX + AX architect

Swasthya is a therapist-supervised rehabilitation companion. Its patients are often older adults exercising at home, standing or sitting 1-2 m from the screen, looking at the camera, with reduced acuity, slower reactions, tremor, hearing loss or little tech confidence. **The interface must work from a distance.** Never assume a phone held at the face.

It must feel like **a calm, trustworthy rehabilitation companion**. Not a medical dashboard. Not a fitness game. Not a generic AI app.

UI, UX and AX are one decision system here, not three review passes. Every choice answers all three at once: what does it look like, what does the person understand and do, and can everyone get that meaning through more than one channel.

## Decision order

When goals conflict, the higher one wins: **1 Safety, 2 Clarity, 3 Accessibility, 4 Usability, 5 Trust, 6 Feedback quality, 7 Engagement, 8 Visual polish.** Polish never buys back clarity; engagement never buys back safety.

## How this fits the repo (read first)

- **`DESIGN.md` is the one design system** ("Physio's Handout": paper, toner ink, one green, highlighter for attention, coral for stop, ticks as the progress glyph, Pen face only for words a therapist wrote). `PRODUCT.md` holds the product rules (real data only, AI labelled, guidance not diagnosis). Do not create a second system.
- **Patient scale is an extension, not a fork.** `DESIGN.md` is tuned for a handheld, near-read app (14 px body, 44 px targets). Patient-facing exercise and flow screens use the larger scale in [references/distance-and-patient-scale.md](references/distance-and-patient-scale.md) (18 px body, 56 px primary targets, distance-tier type). Put any new tokens next to the existing ones in `app/globals.css` and record them in `DESIGN.md`. Therapist screens keep `DESIGN.md` density.
- **Siblings, in order of use:** `rehab-feedback-engine` (what is said and when: all wording lives in templates and `coach/`, not in JSX), `rehab-ui-review` (checklist for movement screens), `impeccable` (craft floor, `impeccable detect`), `design:accessibility-review` (WCAG pass), `design:ux-copy`, `exercise-qa` (before calling any movement UI done).
- **The code is the source of truth for rep semantics.** Since engine v4 **only valid reps are counted**; `CLAUDE.md` still describes the older "counted vs valid" model, so check `lib/movement/types.ts` (`rep_completed`, `rep_not_counted`, `partial_rep`, `uncertain_rep`) and `lib/movement/ui/movementUi.ts` before designing a verdict.

## Modes (pick the one the request needs)

1. **Research** (any review, or any redesign before code): do not touch code. Write down, for the screen: user goal, context, expectation, likely confusion, likely error, accessibility risk, distance readability, cognitive load, motivation opportunity, safety risk. Field guide and heuristic list: [references/review-template.md](references/review-template.md).
2. **Review**: output the 14-section report in that file. Measure, don't opine: run the distance check (below) and cite numbers.
3. **Design**: propose the smallest change that fixes the finding; show states, copy, motion, responsive behaviour and acceptance criteria. **Stop for approval** unless the user has already said to implement (an explicit "implement/fix/build it" is approval for that scoped change; state the plan in a few lines and proceed).
4. **Implement**: only after approval. See guardrails and test list below.

## Core rules

### Distance first
Design the exercise screen at 1 m, 1.5 m and 2 m. From there the person must be able to tell, without reading small text: **which exercise, good-rep count, whether the last movement counted, what to correct, continue or pause, whether the set is done.** Never fix distance by enlarging sidebar text. Change the information architecture: camera → body → visual state → large actionable feedback → progress, not camera + dense dashboard. Use `lib/movement/ui/distance.ts` (tiers: counter 0.75°, verdict 0.5°, instruction 0.3°, details 0.25° at 0.6 m); mark elements with `data-distance="counter|verdict|instruction|details"` and open `/ui-preview?screen=distance-<scenario>` (for example `distance-error`), which overlays a report of every marked element's rendered size against its tier. Worked sizes and the device table are in the patient-scale reference.

### One screen, one job
Exercise: "perform this movement correctly". Rest: "recover". Completion: "understand your achievement". Progress: "understand your journey". Never combine them. For every element ask: needed **now** / can wait / can hide / say it visually / say it in audio / must persist. Order during exercise: **movement state, correction, valid progress, safety, controls.** Tiers: PRIMARY (immediate action or state), SECONDARY (context), TERTIARY (details, behind a tap or on another screen). Do not expose every metric.

### Rep verdicts: the person must know instantly whether it counted
| Outcome (engine) | Mark + word | Colour (reinforces only) | Counter |
|---|---|---|---|
| valid (`rep_completed`) | ✓ **Good** | green | +1 |
| invalid (`rep_not_counted`) | ✕ **Not counted** + the one fix | coral, calm, no shake | unchanged |
| partial (`partial_rep`) | ↗ **Almost** / "Not counted, a little farther" | neutral/ink | unchanged |
| uncertain (`uncertain_rep`, low confidence) | ? **Couldn't see clearly** | highlighter ring, **never red** | unchanged |

Never increment silently for anything but a valid rep. "Almost" must never read as "counted". Never make an invalid movement feel like the person failed: "That one wasn't counted", not "Wrong". Low confidence freezes judgement and is not a mistake. Note: `Verdict` in `coach/coachState.ts` has no `uncertain` kind today, so an uncertain verdict is an engine-adjacent change (use `rehab-feedback-engine`), not a UI-only one.

### Feedback loop: detect, explain, correct, confirm
Detect (engine) → explain ("Not counted") → correct ("Raise your arm a little higher") → confirm ("Nice correction ✓"). **One primary correction at a time**, picked by the coach's priority, never four stacked errors. The UI renders `ui.cue` / `ui.verdict`; it must not pick its own cue.

### WHERE, WHAT, HOW TO FIX
Every correction says where (the affected body part highlighted on the skeleton), what (short state word), how to fix (plain instruction, optional directional cue). Example: red head + "Not counted" + "Turn your head a little farther", then green head + "Nice correction ✓". The skeleton is part of the interaction, not a debug overlay: clear joint states, affected-part emphasis, subtle target arrow, no clutter.

### Camera is the canvas, and nothing covers the body
`DESIGN.md` keeps solid bars around the video and only the camera-advice banner and Paused/Rest scrims over it. Reconcile "feedback near the body" with that: anchor the **where** on the skeleton (drawn in `components/movement/overlay.ts`), and put the large **verdict and instruction in a solid band adjacent to the camera**, sized by distance tier. Never place large UI over the face or torso. On wide screens the camera stays dominant; on a phone keep only essential feedback and controls.

### Every important state has more than one channel
Visual + text + optional audio + optional haptics. Never colour alone: green + ✓ + "Good"; coral + ✕ + "Not counted"; yellow + visibility icon + "I can't see you clearly". Skeleton shapes (ring, disc with cross, dashed ring, dot) already encode this; keep it. Voice goes through `useVoiceCoach` / `coach/voicePolicy` (cooldowns, de-dup); captions exist for hearing loss. Haptics are optional (`navigator.vibrate`, short, off by default if unsupported), never the only signal.

### Older-adult UX
Confidence over sophistication. Body text 18 px where practical, large primary numbers, **primary targets >= 56 px**, strong contrast, generous spacing, plain language, no hover-only interaction, no icon-only controls, no unnecessary gestures, no dense dashboard mid-exercise, no flashing, no aggressive animation, **no time pressure** unless clinically required (the 3·2·1 countdown exists so nobody is rushed). Never show: *landmark, confidence threshold, angle, pose estimation, tracking state*. Say "I can't see your arm clearly", "Turn a little farther", "Try moving more slowly". Units and measurements live in the details panel only.

### Safety is a UI feature
Pause/stop is always reachable, >= 56 px, never covered, never hidden behind a menu. Pain or discomfort has a one-tap path (`/api/patient/plan/discomfort`) and the copy always allows stopping ("It's fine to stop here"). Never "push through", never promise recovery, never diagnose; the product gives movement guidance, not clinical conclusions. Safety beats engagement beats polish.

### Engagement without a game
Do not use XP, coins, leaderboards, aggressive streaks, guilt, punishment, confetti, or fake achievements. Use the rehabilitation journey, personal milestones, exercise mastery, daily goals, consistency, personal best, improvement highlights, and therapist-connected moments. The feeling is "I am getting better", not "I must not break my streak". Show progress with the tick-box glyph. A "personal best" or "improvement" claim must come from real stored data and only compare comparable engine versions (`lib/movement/analytics/trends.ts`, `lib/movement/version.ts`); if the data is not there, say nothing or show an honest empty state.

### Micro-interactions and motion
Each one must answer: why does this exist, what emotion should it create, does it improve comprehension? If not, remove it. First valid rep "Great start."; correction "Nice correction ✓"; "Set complete ✓"; "Exercise complete."; "Today's routine complete." Motion communicates state change, progress, confirmation, transition or hierarchy, never decoration. Patient-facing durations 200-400 ms, ease-out, no bounce, never over landmarks or instructions, honour `prefers-reduced-motion` (a state change must still be legible with motion off: the mark and word carry it).

### Therapist context, only when real
"Your therapist's tip", "Your therapist reviewed your session", "Prescribed by Dr. X" appear **only when that data exists**. Therapist-written words are set in the Pen face with attribution; machine output is never in handwriting; AI summaries carry the "not a medical diagnosis" disclosure and stay separate from the therapist's assessment. Never invent therapist activity.

### Every state is designed
The 22 states (LOADING ... EMPTY_STATE) and the per-state spec (hierarchy, copy, interaction, accessibility, audio, animation, transition, exit condition) are in [references/state-catalogue.md](references/state-catalogue.md). No two states may look alike, and every state has a way out.

## Guardrails: preserve working logic

Before modifying an existing component: inspect it, understand its state and dependencies, identify regression-sensitive behaviour, propose the minimal safe change, keep the logic. **Never casually modify** MediaPipe coordinate mapping, canvas scaling, mirroring, pose detection, the movement engine, exercise judgement, WebRTC, or authentication, unless the task requires it, and then say so and run the relevant sibling skill (`pose-analysis-review`, `rehab-feedback-engine`) and tests. Overlay drawing lives in `overlay.ts` and is imperative; React state changes only on events and ~4 Hz (`movementUi.ts`), so do not push per-frame values into React. Reuse `components/ui/*` (`StatusMark`, `TickBoxes`, `Notice`, `EmptyState`, `Authorship`); don't add a parallel set.

## Implementation checklist

Test every important state in `/ui-preview?screen=...` (`replay-<scenario>` and `distance-<scenario>` with scenario `ok|error|notcounted|lowconf|camera|paused|stuck`, `setup`, `ready`, `intro`, `countdown`, `rest`, `paused`, `home`, `empty`, `stage`, `session-report`, `trend`) and with `npm run movement:replay -- clean|shallow|partial|lean|lowconf|dropout`. Check: at distance (the distance report must show no failures for counter, verdict and instruction), 390 px portrait and landscape, tablet, laptop, large desktop, 200% text zoom, `prefers-reduced-motion`, keyboard only (visible focus, logical order, Space/Enter on controls), screen reader (live regions announce verdicts without repeating every frame; `role="status"` for non-urgent, `role="alert"` for blocking), colour-blind simulation, and a real device for what a headless run cannot show (camera permission prompts, speech voices, real lighting, real distance). Finish with the `exercise-qa` skill. State plainly what could not be verified without a camera.

## The questions to keep asking

- Can an older adult understand this without thinking?
- Can they understand it from 2 metres away?
- Can they recover from a mistake?
- Does the UI clearly tell them whether their movement counted?
- Does the interface make them feel supported rather than judged?
- Does this help them understand their progress?
- Is it accessible without being ugly or complicated?

If any answer is "no" or "not sure", that is the finding.
