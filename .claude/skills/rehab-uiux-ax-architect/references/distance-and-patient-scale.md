# Distance, patient scale, motion and responsive audit

## 1. Distance tiers (computed, not guessed)

`lib/movement/ui/distance.ts` turns "can it be read from there" into arithmetic: capital height is ~72% of font size, visual angle = atan(cap height / distance). The angles are engineering defaults for an older adult with reduced acuity (about 6/18), to be confirmed with the human distance test, not clinical facts.

| Tier (`data-distance`) | What belongs in it | Min angle | Must work at |
|---|---|---|---|
| `counter` | Good-rep count | 0.75° | 1, 1.5, 2 m |
| `verdict` | GOOD / NOT COUNTED / ALMOST / COULDN'T SEE CLEARLY | 0.5° | 1, 1.5, 2 m |
| `instruction` | The one short correction | 0.3° | 1, 1.5 m |
| `details` | Set tally, measurements, guide, history | 0.25° | 0.6 m (at the device) |

Required CSS px at the strictest distance per tier (recomputed from the constants on 2026-10-07; re-run `checkDistance` rather than trusting this table if the constants change):

| Device (mm per px) | counter @ 2 m | verdict @ 2 m | instruction @ 1.5 m | details @ 0.6 m |
|---|---|---|---|---|
| 13-inch laptop / tablet (0.20) | 182 | 121 | 55 | 18 |
| 24-inch monitor (0.28) | 130 | 87 | 39 | 13 |
| Phone, landscape (0.165) | 220 | 147 | 66 | 22 |

Consequences for design:
- A 48 px counter in a side panel fails the 2 m tier on every device by roughly 3-4x. That is not a font-size bug, it is an **architecture** bug: the counter and verdict need their own stage-scale zone (a band beside or below the camera, or the camera region itself when the layout allows), not a sidebar row.
- A phone cannot reach counter size at 2 m without the number dominating the screen. Acceptable answer: on phone, the stage shows counter + verdict + one instruction only; everything else moves behind a tap. Do not shrink the camera until the body is unreadable.
- Only `details` may be small. Anything a person needs mid-movement is `counter`, `verdict` or `instruction`.
- Provide calibration where possible ("can you read this from where you will sit?") because the browser cannot know physical screen size.

Procedure: tag elements with `data-distance`, open `/ui-preview?screen=distance-<scenario>` (scenarios: `ok`, `error`, `notcounted`, `lowconf`, `camera`, `paused`, `stuck`, for example `distance-notcounted`), read the failures, fix the layout, repeat. Test at browser zoom 100% and 200%.

## 2. Patient-scale tokens (extension of DESIGN.md)

Use these on patient-facing flows and the live stage; they extend, not replace, `DESIGN.md` (same palette, same Geist/Geist Mono/Kalam, same ticks). Add as CSS custom properties beside the existing tokens in `app/globals.css`, then record in `DESIGN.md`.

| Token | Value | Notes |
|---|---|---|
| Body (patient) | 18 px / 1.55, 400-500 | Therapist screens stay 14 px |
| Secondary text | >= 16 px | Never `ink-muted` lighter than DESIGN.md allows |
| Primary number | Geist Mono 700, tabular, stage-scale (tier above) | Reps, set count, countdown |
| Verdict word | Geist 800, stage-scale, sentence case allowed; ALL CAPS only for the 1-2 word verdict | Pair with mark |
| Pen (therapist note) | Kalam >= 17 px, attributed | Only for therapist-written words |
| Primary target | >= 56 px tall, >= 56 px wide, 12-16 px gap to the next target | One green primary per screen |
| Secondary target | >= 48 px | Never below 44 px (WCAG 2.5.5 spirit) |
| Contrast | text >= 7:1 on stage verdicts, >= 4.5:1 elsewhere; non-text (rings, marks) >= 3:1 | Check on Camera Black as well |
| Focus | 2 px green outline, offset 2 px (white on dark grounds) | Must be visible at distance on keyboard/switch use |
| Spacing rhythm | 8 / 12 / 16 / 24 / 32 px | Generous: patient screens breathe |
| State colours | green = done/good, coral = stop/not counted, highlighter = needs a person's attention / can't see clearly | Always with mark + word. Highlighter is never success |
| Shape language | tick ✓, cross ✕, dash −, dashed ring, arrow ↗ | Defined once, reused everywhere |

State colours on the camera (skeleton) are brighter than page colours because they sit on Camera Black; they are the only place those hues appear. Low confidence never shows red.

Components: reuse `Button`, `StatusMark`, `TickBoxes`, `Notice`, `EmptyState`, `Authorship`, `Dialog`, `Toast`. Cards stay ruled, not floating (no shadow). Status indicators are mark + word + colour. Progress is ticks (sets x reps grid), with a spoken equivalent ("6 of 10 good reps"). Patient and therapist density differ: patient = simple, large, calm; therapist = information-rich, analytical.

## 3. Motion tokens

| Use | Duration | Easing | Notes |
|---|---|---|---|
| Verdict appears | 200 ms | ease-out | Fade + 8 px settle; no shake, no bounce |
| Verdict clears | 300 ms | ease-in | Leave after ~2-3 s (the coach expires it) unless it carries a correction |
| Correction -> corrected | 300 ms | ease-out | Highlight colour change on the body part; mark swaps ✕ → ✓ |
| Counter increment | 250 ms | ease-out | Number swaps; optional single tick-draw (260 ms) |
| Set / exercise / routine complete | 400 ms | ease-out | One calm tick draw. No confetti |
| Screen transition | 250-400 ms | ease-in-out | Cross-fade; never slide content over the camera |

Rules: animation must not cover landmarks or the instruction; no flashing above 3 Hz, ever; no looping decoration; `prefers-reduced-motion: reduce` replaces motion with an instant change, and the mark + word still carry the state. Each animation must answer: why does it exist, what emotion does it create, does it help comprehension.

## 4. Responsive audit

Check each; the camera stays the dominant surface everywhere.

| Viewport | Expectation |
|---|---|
| 390 px portrait | Camera on top, verdict/instruction band under it, controls at the thumb, no horizontal scroll; counter + verdict + one instruction only mid-set |
| Phone landscape | Camera left/fills; verdict band beside it; this is the likely propped-up use at distance, design it first |
| Tablet (768-1024) | Propped at distance: stage-scale type; do not fall back to the desktop sidebar |
| Laptop (1280-1440) | Camera dominant; verdict/counter in the stage band; details panel collapsed by default |
| Desktop / large (1920+) | Cap camera width so the body is not tiny; scale tier type with viewport (`clamp`), do not leave a 24 rem sidebar at distance |
| 200% text zoom / large text | No clipped verdict, no overlap with camera or controls |

Safe-area insets respected; coarse-pointer sizes applied; no hover-dependent interaction anywhere.
