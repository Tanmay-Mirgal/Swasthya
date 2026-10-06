---
version: 1
slug: "app-layout-tsx"
primary_target: "app/layout.tsx"
related_targets: []
---

# Surface brief: Swasthya app shell and all signed-in surfaces

Mode: Operate (patient and therapist work screens). Redesign of the whole UI; product truth, routes, auth, data and functions preserved.

## Scope
Every user-facing route: auth, onboarding/setup, patient home/exercises/live/session/progress/appointments/discover/profile, therapist overview/patients/prescribe/review/profile, chat, consultation.

## Direction contract

THESIS: The physio's handout. Every screen is a working product first; the world supplies type, palette, density and ONE move: pen-ticked sets x reps boxes (a row of boxes is the product's only progress/adherence/completion glyph) plus handwriting for therapist-confirmed notes. Refuses the card-grid-of-metrics dashboard.

OWN-WORLD: Toner-black ink (#1A1F1D), photocopy white ground with a faint warm tint (#FBFBF8), Swasthya logo green (#1F6B4F, tints to #E4F0E9), highlighter yellow (#F6D44B) used only as a "needs your attention" swipe, coral (#C2412D) for danger/stop. Geist Sans UI, Geist Mono tabular numerals for reps/angles/times; Kalam (handwriting, 16px+) for therapist-written notes only, so typed toner = automated, pen = therapist. 1px toner hairline rules instead of card shadows; 6px radius; checkbox squares 20px with a hand-drawn tick SVG; state always has a shape (tick, dash, half, strike) plus a word.

STORY: A patient opens Swasthya and sees today's handout: numbered exercises, how many boxes are left to tick, one obvious Start. A therapist sees a ranked list of who needs attention with the highlighted reason. Both can trust what is automated (typed) and what a person wrote (pen).

FIRST VIEWPORT: Patient home, phone: top bar (Swasthya mark, profile), "Today" heading with the date, then the handout list: each exercise row = number, name, target area, a row of sets x reps tick boxes (ticked = done), next row expanded with a full-width Start button at thumb height; therapist note below in handwriting. Desktop: left nav rail (green ground, active item inverted), center handout, right column of therapist feedback and next consultation. Primary action always bottom-left of the list on desktop / sticky on phone.

FORM: Own list position 1 (the model's pick, user-chosen). Seed key d4fa2df2 (direction scope, operate).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved
Logo: the existing Swasthya raster logo stays; a vector wordmark treatment in the nav is an open follow-up.
