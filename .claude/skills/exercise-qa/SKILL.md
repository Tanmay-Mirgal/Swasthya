---
name: exercise-qa
description: Verify the exercise tracking system end to end before calling it done: unit and e2e tests, synthetic replays, lint, typecheck, production build, prescription and session integrity, and a clear statement of what could not be verified without a camera. Use before finishing any change to movement, templates, coaching, reports or the live exercise screens.
---

# Exercise QA

Run, in this order, and report each result honestly (a skipped or failing check is stated, not hidden):

```bash
npx tsc --noEmit                    # the real type check (next.config ignores build type errors); ignore stale .next/types noise
npm run lint                        # compare to the baseline; new/changed files must be clean
npm run test:movement               # pure engine, coach, templates, reports, trends, overlay
npm run test:movement:e2e           # route handlers on a throw-away mongod, Groq stubbed
npm run test:rehab                  # schedule + rep chunking
npm run test:rehab:e2e              # prescriptions, sessions, reviews, recordings, cron, email
npm run test:realtime               # chat/calls (flaky once before; re-run, then diagnose if it repeats)
NEXT_DIST_DIR=.next-verify npx next build   # then remove .next-verify
```

## Must-hold behaviours

- Prescriptions are untouched: 8 + 7 = 15 reps still fills a 15-rep set exactly once; invalid reps count toward the prescription and are flagged; partial attempts do not count; therapist targets never change.
- Low confidence never produces a rep, an error or red. Yellow only.
- With `GROQ_API_KEY` unset or Groq failing, everything works with built-in wording and the report still exists.
- Free practice stores only measured values (no defaulted ROM/tempo).
- Old sessions (no engine version) still render everywhere and are never given a form score or compared with the new one.

## Visual check without a camera

`/ui-preview?screen=replay-ok | replay-error | replay-lowconf | live | setup | trend | session-report` drive the real engine, coach and overlay with a synthetic person. Check desktop and 390 px (no horizontal scroll). `/ui-preview?screen=stage` mounts the real live hook (model load, camera request). These prove logic and drawing, not real-camera tracking.

## Always say what was NOT verified

Real camera + MediaPipe accuracy on real bodies, GPU/CPU delegate on user devices, real lighting, real Groq output, signed-in flows in a browser (no Clerk sign-in is available to the agent), and physiotherapist review of thresholds.
