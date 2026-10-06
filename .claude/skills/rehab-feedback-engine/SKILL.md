---
name: rehab-feedback-engine
description: Work on live coaching feedback: deterministic messages, error priority, the coach state machine, voice cooldowns and de-duplication, language-model wording (Groq) and its fallbacks, and the session report. Use when changing what the patient is told, when, and how it is spoken or generated.
---

# The feedback engine

Rule of the loop: **MediaPipe sees, biomechanics measures, the template defines correct, the deterministic engine judges, the coach decides what to say, voice speaks, Groq only rephrases.** The model never judges, never sees frames or landmarks, and the whole thing works with it switched off.

Files (`lib/movement/coach`): `messages.ts` (template wording, priority) → `coachState.ts` (graph-shaped reducer: events in, effects out; never per frame) → `voicePolicy.ts` (should it be spoken now?) → `llm.ts` (request + client) → server: `cueRequest.ts` (validation + prompt), `serverCue.ts` (Groq call), `app/api/coach/route.ts`.

## Invariants (tests enforce them)

- One cue at a time; priority: camera > major form > moderate > range > minor > tempo > praise.
- A problem is spoken once, then silent until its cooldown (12 s), then the NEXT escalation tier is used; never the same sentence twice in 30 s.
- Non-urgent corrections wait for a quiet moment (rest/peak), not mid-movement.
- A fixed problem is acknowledged once, and only if the patient had been told about it.
- A problem repeated in >= 3 reps and >= half the reps becomes a therapist observation: what was measured and how often, never a cause or a diagnosis.
- Language model: prefetched for the NEXT tier only, budgeted per set, validated (`cueValidation.cleanCue`: no digits, jargon, diagnosis, medication, "push through", >20 words), and the server rebuilds the plain-language fact from the template so the client cannot inject prompt text. Any failure → deterministic wording, no visible gap.
- Every deterministic message in every template passes the same `cleanCue` validation.

## Changing wording or behaviour

1. Edit the template (`rules[].low/high.texts`) or `COACH_CONFIG` (`coach/config.ts`), not scattered literals.
2. Run `npm run test:movement` (coach, serverCue, templates) and `npm run test:movement:e2e` (route auth, rate limit, fallback).
3. `npm run movement:replay -- lean` shows exactly what would be shown and spoken, with timestamps.

## Reports

`analytics/sessionReport.ts` builds facts from the STORED session only, a deterministic report, and validates any model rewrite (`acceptModelReport`: every number must already be in the facts; no causes, diagnosis or treatment). Always label it an automatic/AI summary, not a diagnosis, and keep it visually separate from the therapist's own assessment. The therapist stays the authority; nothing here changes a prescription.
