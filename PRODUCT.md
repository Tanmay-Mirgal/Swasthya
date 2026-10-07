# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Patients** recovering from an injury or condition, doing prescribed rehabilitation exercises at home. They use a phone propped up or a laptop webcam, often alone, often unsure whether they are doing the movement correctly. Some are older or in pain; they need clear, calm, large-target interaction.
- **Therapists (physiotherapists)** who prescribe routines, review sessions and adherence remotely, message patients, and run live video consultations. They scan many patients quickly and make clinical decisions from the data.
- Both roles use the product on phone **and** desktop equally; neither device is secondary.

## Product Purpose

Software-based rehabilitation assistant. Camera-based pose analysis (MediaPipe, on device; no video leaves the browser) counts reps and gives non-diagnostic movement feedback during home exercise. Therapists prescribe plans, review sessions, override automated assessments, chat, and hold WebRTC video consultations. Success: patients complete prescribed exercises correctly and consistently; therapists see adherence and quality without being in the room.

## Positioning

Closes the gap between clinic visits: real-time form feedback on the patient's own device, tied to a real therapist who can see the results and intervene. A generic fitness or telehealth app cannot truthfully offer that combination.

## Operating Context

- Patient flow: onboarding/role setup, today's assigned exercises, camera setup, live tracked session, session summary, progress, appointments, chat, consultation.
- Therapist flow: dashboard, patient list and profile, exercise prescription, session review, appointment requests, chat, consultation.
- Indian clinic context in current content (clinic hours 9:00 AM–6:00 PM, consultation windows), English UI.
- Auth via Clerk; MongoDB persistence; realtime chat and WebRTC signaling inside the Next.js app.

## Capabilities and Constraints

- Existing routes and Clerk auth flows stay; this is a UI/UX redesign, not a functionality change.
- Live exercise must keep the camera and pose skeleton visually clear; audio cues exist (Web Speech).
- **Real data only.** No invented statistics or populated fake states; where data does not exist, design a useful empty state. Existing mock/seed data (e.g. `pat_1`, `doc_aarti_sharma`, sessions kept in `localStorage`) is flagged and kept distinct, not expanded.
- Feedback is movement guidance, not diagnosis; no recovery or medical promises (README and the redesign brief both require this).
- Open product decisions not made here: whether the progress page should move off `localStorage` to MongoDB; the session-summary route (`/exercise/[id]/summary` 404s today).

## Brand Commitments

- **Product name in the UI: Swasthya** (user decision), everywhere users see a name. The repository, README and package are named RehabLens; those internal names are not user-facing.
- Existing logo assets in `public/swasthya-logo*.png`: a stylised figure with a leaf in deep green to mint-teal, wordmark in dark green-black. Treat the logo greens as the established brand colour family.

## Evidence on Hand

- Logo files (`public/swasthya-logo-full.png`, `-icon.png`, `-square.png`, `.jpg`).
- Exercise guide photos in `public/exercise-guides/` (neck rotation, seated bicep curl, seated knee extension, sit to stand, shoulder abduction, heel raise, mini squat).
- No testimonials, customer logos, outcome statistics, or clinical evidence exist. None may be fabricated.

## Product Principles

1. **The next action is obvious.** Patients see what to do today; therapists see who needs attention. Hierarchy over equal-weight tiles.
2. **Movement first.** During exercise the body and camera are the interface; everything else gets out of the way.
3. **Explain, don't alarm.** Low confidence, errors, and offline states say what to do next, never just that something failed.
4. **AI is labelled.** Automated assessments are visibly distinct from therapist-confirmed ones, and therapists can override without fighting the UI.
5. **Trust by restraint.** Healthcare context: calm, precise, no gamified or decorative noise.

## Accessibility & Inclusion

- WCAG AA contrast minimum; status never conveyed by colour alone; visible focus; keyboard operable; reduced-motion respected; zoom must not be disabled.
- Users may be older, in pain, or using one hand: large touch targets (44px+), readable type, generous spacing in patient flows.
