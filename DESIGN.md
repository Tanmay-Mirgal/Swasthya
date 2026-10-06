---
name: Swasthya
description: A physio's handout that works: toner ink on photocopy white, one green, pen-ticked boxes for progress, handwriting for what a therapist wrote.
colors:
  toner-ink: "#1a1f1d"
  photocopy-white: "#fbfbf8"
  ink-soft: "#4d544a"
  ink-muted: "#636b5f"
  rule: "#dde0d7"
  rule-strong: "#1a1f1d"
  field-line: "#c3c8bd"
  wash-grey: "#eceee8"
  swasthya-green: "#1f6b4f"
  swasthya-green-deep: "#185540"
  swasthya-green-rail: "#0e3327"
  green-wash: "#eef6f1"
  green-edge: "#bbdbc8"
  highlighter: "#f6d44b"
  highlighter-wash: "#fef9df"
  highlighter-ink: "#594507"
  coral: "#b93f2b"
  coral-deep: "#983321"
  coral-wash: "#fcefeb"
  camera-black: "#0f1311"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  numeral:
    fontFamily: "Geist Mono, ui-monospace, Menlo, monospace"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tabular-nums"
  pen:
    fontFamily: "Kalam, Segoe Print, Bradley Hand, cursive"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  tick: "3px"
  md: "5px"
  lg: "6px"
  xl: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  rail: "240px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.swasthya-green}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.swasthya-green-deep}"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-highlight:
    backgroundColor: "#f6d44b"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.coral}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  tick-box-done:
    backgroundColor: "{colors.green-wash}"
    textColor: "{colors.swasthya-green-deep}"
    rounded: "{rounded.tick}"
    size: "20px"
  tick-box-todo:
    backgroundColor: "#ffffff"
    rounded: "{rounded.tick}"
    size: "20px"
  tick-box-missed:
    backgroundColor: "{colors.coral-wash}"
    textColor: "{colors.coral-deep}"
    rounded: "{rounded.tick}"
    size: "20px"
  side-rail:
    backgroundColor: "{colors.swasthya-green-rail}"
    textColor: "{colors.green-wash}"
    width: "240px"
  side-rail-item-active:
    backgroundColor: "{colors.photocopy-white}"
    textColor: "{colors.toner-ink}"
    rounded: "{rounded.lg}"
  attention-badge:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.toner-ink}"
    rounded: "4px"
    padding: "0 6px"
---

# Design System: Swasthya

## Overview

**Creative North Star: "The Physio's Handout"**

Every screen is a working sheet a physiotherapist might hand over: toner-black type on warm photocopy white, separated by hairline rules rather than boxed in cards. Density is that of a task list, not a dashboard; the next action is the largest, greenest thing on the page. The world supplies type, palette and exactly one move: a row of pen-ticked boxes is the product's only glyph for progress, adherence and completion.

Authorship is visible. Typed Geist toner means automated (camera counts, computed summaries); Kalam handwriting in green means a therapist wrote it. The two never swap. Yellow highlighter appears only where something needs a person's attention, and coral appears only for stop and danger.

The stock Tailwind palettes (slate, zinc, gray, emerald, green, teal, blue, indigo, red, rose, amber, yellow, orange) are all re-pointed in `app/globals.css` to this one palette. Class names in source are legacy; the token meanings below are the system.

**Key Characteristics:**
- Flat and ruled: 1px hairlines and one 2px ink rule above section headings; no card shadows.
- One green, one highlighter, one coral. Nothing is a one-off hex.
- Status is always a shape (tick, dash, cross) plus a word; colour only reinforces.
- Geist Mono tabular numerals for reps, angles, times.
- Camera surfaces keep solid bars around the video so nothing is drawn over the body or skeleton.

## Colors

A near-monochrome green-tinged grey ladder, one deep logo green, a yellow highlighter and a coral red.

### Primary
- **Swasthya Green** (`colors.swasthya-green`): the single next action (primary button), active-tab and bottom-nav indicator, links, focus ring, done ticks. Tints run to Green Wash for done boxes and success notices.
- **Swasthya Green Deep** (`colors.swasthya-green-deep`): primary hover, and the Kalam handwriting colour for therapist-written text.
- **Rail Green** (`colors.swasthya-green-rail`): the desktop side-rail ground only; text on it is Green Wash, active item inverts to paper.

### Secondary
- **Highlighter** (`colors.highlighter`): needs-your-attention only: nav and tab count badges, the `highlight` button, the highlight swipe behind a reason, and text selection. Text on it is always toner ink; its darker brown (`colors.highlighter-ink`) is for warning text on the pale wash.

### Tertiary
- **Coral** (`colors.coral`): danger, stop, destructive buttons, missed ticks, form errors. Deep coral for text on its wash.

### Neutral
- **Toner Ink** (`colors.toner-ink`): all primary text, strong rules, body colour.
- **Photocopy White** (`colors.photocopy-white`): the page ground (`--paper`), also the theme colour.
- **Ink Soft / Ink Muted** (`colors.ink-soft`, `colors.ink-muted`): secondary text and meta; do not go lighter for text.
- **Rule** (`colors.rule`): hairline dividers; **Field Line** (`colors.field-line`): input borders and todo tick borders; **Wash Grey** (`colors.wash-grey`): hover fills and skeletons.
- **Camera Black** (`colors.camera-black`): the camera viewport behind the pose skeleton.

### Named Rules
**The Highlighter Rule.** Yellow means a person needs to look at this. Never decorative, never a brand fill, never for success.
**The Authorship Rule.** Pen (Kalam, green) = a therapist wrote it; toner (Geist) = automated. Never set machine output in the handwriting face.
**The Shape-Plus-Word Rule.** State is a tick, dash, cross or empty box plus a label; colour alone never carries meaning.

## Typography

**Display / Body Font:** Geist (with ui-sans-serif, system-ui)
**Numeral Font:** Geist Mono (tabular, for reps, angles, times, row numbers)
**Pen Font:** Kalam (Latin and Devanagari), therapist notes only

**Character:** a plain, legible sans for the printed handout and a handwriting face for the margin note. Headings are bold with slightly tight tracking; there is no uppercase tracked-out labelling.

### Hierarchy
- **Display** (700, 2.25rem at sm and up, 1.1): the patient "Today" heading and similar page-defining titles; 1.875rem on phone.
- **Headline** (700, 1.5rem to 1.75rem, tight): page titles via the page header.
- **Title** (700, 1rem to 1.125rem, 1.35): exercise names, section headings, dialog titles.
- **Body** (400 to 500, 0.875rem, 1.625): the working size across the app; prose capped at `max-w-prose`.
- **Label** (600, 0.75rem; 11px for badges and day labels): meta, status marks, field hints.
- **Numeral** (Geist Mono 600, 1.125rem): row numbers and metric values, with `tabular-nums`.
- **Pen** (Kalam 400, 1.0625rem, 1.45): therapist notes, never smaller than 16px.

### Named Rules
**The Pen-Is-A-Person Rule.** Kalam is only for words a therapist wrote, attributed with a small sans signature.
**The Tabular Rule.** Any number that changes or aligns (reps, degrees, time) is tabular.

## Layout

A content column beside a fixed rail. Desktop (md and up): a 240px green side rail, content max 64rem by default, 80rem for wide screens, padded 32px. Phone: a 56px top bar plus a 64px labelled bottom bar, content padded 16px with room to clear the nav. Patient home on large screens is a two-column grid: the handout list, then a 20rem right column for therapist, week and last session, with 40px column and 32px row gaps.

Spacing is Tailwind's 4px step, used as 8, 12, 16, 24. Lists are rows separated by rules, not tiles. On phone the primary action is sticky above the bottom bar; on desktop it sits inline in the list. Coarse pointers get a 44px minimum height on buttons and fields (`data-compact` opts out). Safe-area insets are respected at top and bottom.

Focus frames (camera setup, live exercise) are fixed full-screen: a solid header with a strong bottom rule, camera above and controls below on phone, camera left and a 24rem panel right from lg.

## Elevation & Depth

Flat. Depth comes from 1px rules, a 2px ink rule above section headings, and the green rail against the paper ground, not from shadows. Cards carry no shadow. Shadow tokens are re-pointed to very small, low-opacity ink tints and survive only on floating layers: the modal dialog (xl) and toasts (md), plus the switch knob.

### Named Rules
**The Ruled-Not-Floating Rule.** Surfaces are separated by rules, never lifted. A shadow is permitted only on a layer that actually floats above the page.

## Shapes

Quiet, small corners. Tick boxes are 3px, inputs, buttons and notices 6px, cards and dialogs 8px, small badges 4px; pills (9999px) are limited to avatars, toggles and status dots. Borders are 1px in Field Line or Rule; strong separators are Toner Ink (1px under focus-frame headers and above the bottom nav, 2px above section headings). Dashed 1px Field Line outlines mark empty states. Thumbnails are 5px with a 1px rule and slight desaturation.

## Components

### Buttons
- **Shape:** 6px corners, 600-weight 14px label; heights 32 / 40 / 48px (sm / md / lg), icon 40px square.
- **Primary:** Swasthya Green fill, white text, one per screen; hover to Green Deep. Full-width at lg height for the next exercise on phone.
- **Secondary / Outline / Ghost:** white with a toner-ink 1px border; quiet outline with a Field Line border; ghost with no border and a wash-grey hover.
- **Highlight / Danger:** highlighter fill with ink text for rare needs-attention actions; coral fill with white text for stop and destructive.
- **States:** 150ms colour transition, 1px press nudge, 45% opacity disabled; one global focus ring: 2px green outline offset 2px (white on dark grounds).

### Tick Boxes (signature)
A 20px (18px in rows, 16px in sets grids) bordered 3px square drawn with a hand-drawn SVG tick. Done: green border, green wash, green tick (drawn on over 260ms when animated). Todo: empty white box. Partial: ink dash. Missed: coral border, coral wash, cross. Sets x reps is a grid with one row per set, numbered at the left, one box per rep; adherence is a week of labelled day boxes with today in bold. Every row has a spoken equivalent ("3 of 12 reps done").

### Inputs / Fields
- **Style:** 40px high, white, 1px Field Line border, 6px corners, 12px padding; label is 14px semibold above, hint 12px below.
- **Focus:** border shifts to Swasthya Green plus the global ring. **Error:** coral border and a 12px medium coral message with `role="alert"`. **Disabled:** wash-grey fill.

### Navigation
- **Side rail:** Rail Green, 240px, logo mark on a white tile with the "Swasthya" wordmark, 14px semibold items; active item inverts to paper with ink text; count badges are highlighter; account row below a thin green rule.
- **Bottom bar:** paper ground, 1px ink rule on top, 64px high, labelled icons at 11px; active gets a 3px green bar on top and ink text.
- **Tabs:** underline tabs on a 1px rule; active has a 2px ink underline; pending counts are highlighter chips.

### Cards / Containers
A ruled panel (8px, 1px Rule border, white, no shadow) used sparingly for bounded forms and call-outs. Prefer plain sections separated by rules. Section headings carry a 2px toner-ink rule above.

### Notices, Status and Authorship
Notices are 1px bordered, 6px tinted boxes (slate, green, highlighter, coral) with a plain-language title and what to do next. StatusMark is a shape, a word and a colour; Authorship labels read "Written by {therapist}" (pen) or "Automated from camera" (toner).

### Dialogs and Toasts
Native dialog, 8px, 1px ink border, rule-separated header and footer, 50% camera-black backdrop. Toasts are white, 1px bordered, 6px.

## Do's and Don'ts

### Do:
- **Do** show every progress, adherence and completion state as a row of tick boxes with a spoken label.
- **Do** keep one primary green button per screen and make it the next action.
- **Do** set therapist-written text in Kalam (Pen) at 17px, attributed; set machine output in Geist.
- **Do** reserve highlighter yellow for needs-attention (badges, one highlight swipe, the highlight button) and coral for stop and danger.
- **Do** separate content with 1px rules and a 2px ink rule above section headings.
- **Do** use Geist Mono with tabular numerals for reps, angles and times.
- **Do** keep solid bars around the camera so nothing is drawn over the body.
- **Do** write empty states as a dashed outline with what belongs there and the one next step.

### Don't:
- **Don't** build a card-grid of metrics; lists, rows and rules carry the data.
- **Don't** lift surfaces with shadows or float cards over the page ground.
- **Don't** use colour alone for state; always pair with a shape and a word.
- **Don't** use yellow for success or decoration, or green for danger.
- **Don't** set automated assessments in handwriting, or therapist notes in toner.
- **Don't** use stock Tailwind palette names as design intent; they are re-pointed aliases of the tokens above.
