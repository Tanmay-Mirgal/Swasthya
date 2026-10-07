# Research mode, heuristic review and report template

Use when reviewing or redesigning an existing screen. **Do not modify code first.** Inspect, measure, then recommend.

## A. Research pass (write these down first)

| Field | Question |
|---|---|
| USER GOAL | What is the person trying to do right now? (mid-set: "do this movement correctly") |
| USER CONTEXT | Where, how far from the screen, which device, alone, in pain, tired, one hand? |
| USER EXPECTATION | What do they expect to happen next? |
| USER CONFUSION | Where would an older adult hesitate or misread? |
| USER ERROR | What mistake is likely, and can they recover without help? |
| ACCESSIBILITY RISK | Colour-only meaning, small targets, motion, no text alternative, no audio alternative? |
| DISTANCE READABILITY | Which `data-distance` tiers fail at 1 / 1.5 / 2 m (numbers from `checkDistance`)? |
| COGNITIVE LOAD | How many things compete for attention? Does the screen do one job? |
| MOTIVATION OPPORTUNITY | Where can real progress or a real therapist note be shown honestly? |
| SAFETY RISK | Can they stop instantly? Could the UI encourage pushing through pain? |

For each screen also ask: what must the person know NOW, what can wait, what can be hidden, what can be shown visually, what can be said in audio, what must stay persistent.

## B. Heuristic review

Rate each (pass / risk / fail) with evidence:

1. Visibility of system status (does it say whether the rep counted, whether the camera sees them?)
2. Match between system and real world (plain words, no jargon)
3. User control and freedom (pause, stop, undo)
4. Consistency (same mark, word, colour for the same state everywhere)
5. Error prevention (setup check before starting, no rushed start)
6. Recognition over recall (instruction visible, not remembered)
7. Flexibility and efficiency (voice, captions, hands-free rest)
8. Aesthetic and minimalist design (one job per screen)
9. Error recovery (kind wording, one fix, a way out)
10. Accessibility: WCAG 2.2 AA (contrast, target size, focus, reflow, text spacing, motion, status messages) plus older-adult usability, rehabilitation safety, distance readability

## C. Report (output in this order)

### 1. Current UX problems
### 2. Accessibility problems
### 3. Distance-usability problems
Cite measured sizes against tier minimums.
### 4. Cognitive-load problems
### 5. Interaction problems
### 6. Visual hierarchy problems
### 7. Engagement problems
### 8. Safety problems
### 9. Recommended redesign
The idea in a few sentences: what the person sees first, where feedback sits relative to the body, what moved or was removed.
### 10. Exact component changes
File-by-file (`components/exercise/LivePanel.tsx`, `components/movement/MovementStage.tsx`, `components/movement/overlay.ts`, `components/exercise/FocusFrame.tsx`, ...): what changes, what is reused, what is left alone. Flag any file on the "never casually modify" list.
### 11. States and interactions
Per state from [state-catalogue.md](state-catalogue.md): copy, interaction, audio, motion, transition, exit.
### 12. Responsive behavior
390 portrait and landscape, tablet, laptop, large desktop; what stays, what collapses.
### 13. Accessibility behavior
Keyboard order, focus, live regions, screen-reader names, reduced motion, text zoom, captions, optional haptics.
### 14. Acceptance criteria
Testable statements, for example:
- At 2 m on a 13-inch laptop, `counter` and `verdict` elements pass `checkDistance` (no failures in the distance lab).
- A good rep increments the counter; a not-counted, almost or uncertain attempt never does, and each shows mark + word + (colour).
- Exactly one correction is on screen at a time.
- Every verdict is understandable with colour removed and with sound off.
- Pause is >= 56 px, visible and unobstructed in every active state.
- With `prefers-reduced-motion`, every state change is still legible.
- No engine, mapping, mirroring or canvas-scale file was changed (or the change is called out and tested).
- All 22 states have a defined look, copy and exit.

## D. Implementation test list (after approval)

Reuse existing components; avoid a duplicate design system; preserve business logic and engine behaviour; keep accessibility semantics. Then test: all important states, at distance, 200% text, reduced motion, keyboard only, screen reader where relevant, 390 px and large desktop, `npm run test:movement`, replay scenarios, and `exercise-qa`. Report what needs a real camera or device and was not verified.
