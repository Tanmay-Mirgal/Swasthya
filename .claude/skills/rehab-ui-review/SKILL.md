---
name: rehab-ui-review
description: Review the patient and therapist screens for the movement features: live exercise panel, skeleton colours, camera advice, confidence, reports and trends. Use when changing exercise UI, status colours, copy near a measurement, or adding a screen that shows movement data. Applies the project's "Physio's Handout" design rules.
---

# Reviewing rehab UI

Read `DESIGN.md` and `PRODUCT.md` first; run the `impeccable` skill's detector (`impeccable detect <path>`) on changed UI files.

## Rules for movement screens

- **State is shape + word, never colour alone.** Skeleton: green ring = fine, large red disc with a cross = check this, hollow dashed yellow ring = not seen clearly enough to judge, small white dot = not part of the exercise. The joint strip repeats it in words (`good` / `check this` / `not clear`). Keep this if you restyle.
- **Authorship.** Anything computed is marked "Automated from camera" (`Authorship by="automated"`); a therapist's words are marked as theirs and set in the pen face. AI-written summaries carry the disclosure string from `reportService` ("not a medical diagnosis") and sit apart from the therapist's assessment.
- **Order on the live panel** (what a person needs mid-movement): set and reps → the one current cue → camera confidence and movement status → joints → controls → measurements. One cue only.
- **Never draw controls over the body.** Solid bars around the camera (`FocusFrame`); only the camera-advice banner and Paused/Rest scrims sit over the video.
- **Copy:** say what to do, not what is wrong ("Keep your knee over your foot", not "Wrong posture"). No jargon (angle, landmark, confidence score) in patient text; units appear only in the measurements panel.
- **Required states for every screen:** loading, empty, error with a retry, camera blocked/not found/in use, low confidence, paused, rest, done. Check each in `/ui-preview`.
- **Craft floor** (impeccable): no eyebrows, glass/blur, icon-card grids, side-border accents or gradient text; touch targets >= 44 px; focus visible; `prefers-reduced-motion` respected; 390 px wide with no horizontal scroll (remember `sr-only` inside `overflow-x-auto` needs a `relative` wrapper).
- Numbers: Geist Mono tabular for reps, angles, times. Units follow the exercise (`deg` or `pct`); never print `°` for a percentage measurement.

## Report format

List what was checked at desktop and phone, the states covered, and anything that needs a real device (camera permission prompts, speech synthesis voices, real lighting over the video).
