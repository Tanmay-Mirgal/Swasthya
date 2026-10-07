# State catalogue

Every patient flow designs all 22 states explicitly, so none is ambiguous and none is a dead end. For each state specify: **hierarchy, copy, interaction, accessibility, audio, animation, transition, exit condition.** The defaults below are the starting point; deviate only with a reason.

Code anchors: `lib/rehab/sessionFlow.ts` `FlowPhase` = `loading | unavailable | intro | ready | countdown | active | paused | rest | done` (`unavailable` means the plan or exercise could not be loaded, not the camera); `FlowMode` = `camera | manual`; `Verdict.kind` = `good | not_counted | partial`; engine events in `lib/movement/types.ts`; screen state in `lib/movement/ui/movementUi.ts`; offline queue in `lib/rehab/chunkOutbox.ts`; manual mode in `components/exercise/ManualCounter.tsx`. Preview each at `/ui-preview` (see SKILL.md).

Global defaults for every state: one job per screen; a visible next action >= 56 px; the state is announced once (`role="status"`, or `role="alert"` only when blocking); the mark and word carry the meaning with motion off; text readable at the tier of its importance (see distance reference).

Format: **Hierarchy** (primary / secondary / tertiary) · **Copy** · **Interaction** · **A11y** · **Audio** · **Motion** · **Transition** · **Exit**.

## Preparation

**LOADING** (`loading`). P: "Getting your set ready" + calm progress. S: exercise name. T: none. Interaction: back only. A11y: `aria-busy`, status text. Audio: none. Motion: gentle indeterminate, none under reduced motion. Transition: → INTRO (data in) or EMPTY/ERROR. Exit: plan loaded, failed, or 10 s with "Still working…" plus a retry.

**READY** (`intro` + `ready` camera check). P: how to stand/sit and where to place the camera, with the guide photo; one green "I'm ready". S: therapist's instruction (Pen, attributed, only if real). T: switch to counting by hand. Copy: "Place the camera so I can see your whole arm." A11y: the instruction is text, not only the photo; the camera-advice banner is `role="status"`. Audio: optional read-out of the setup step. Motion: tick when framing is good. Transition: → COUNTDOWN on confirm; → CAMERA_UNAVAILABLE / MANUAL_MODE on choice. Exit: person confirms; never auto-starts.

**COUNTDOWN** (`countdown`). P: giant 3·2·1 (counter tier). S: "Get into position." T: cancel/pause. Never rushes: it exists so nobody is hurried. A11y: number announced each second at most; skip never required. Audio: spoken numbers if voice is on. Motion: number swap 200 ms, no pulsing. Transition: → ACTIVE at 0. Exit: reaches 0 or the person pauses.

## Moving

**ACTIVE** (`active`, no verdict showing). P: camera with skeleton + the good-rep count (counter tier). S: set progress as ticks ("3 of 10 good reps"), exercise name, the one current cue if any (instruction tier). T: details behind a tap. Interaction: Pause always visible >= 56 px. A11y: the count is a live region updated per good rep only. Audio: sparse (voice policy). Motion: none except state change. Transition: → GOOD / NOT_COUNTED / PARTIAL / UNCERTAIN on an attempt; → PAUSED; → SET_COMPLETE at target. Exit: set target reached, pause, or stop.

**GOOD** (`rep_completed`, `Verdict good`). P: ✓ Good (verdict tier), count +1. S: none. Copy: first rep "Great start." Audio: brief, not every rep. Motion: 200 ms fade, auto-clear ~2 s. Transition: → ACTIVE (or SET_COMPLETE). Exit: timeout.

**NOT_COUNTED** (`rep_not_counted`, `Verdict not_counted`). P: ✕ Not counted (verdict tier, coral + ✕, no shake) then the ONE fix (instruction tier). S: affected part highlighted on the body. Copy: "That one wasn't counted. Turn your head a little farther." Interaction: nothing to dismiss. Audio: "That one wasn't counted," then the correction once. Motion: 200 ms, no flash. Count unchanged. Transition: → CORRECTING while the same issue persists; → ACTIVE otherwise. Exit: timeout, or a correction. After several in a row the existing coach offers the guide and a kind way to stop; keep that (`suggestDemo`, `offerFinish`).

**PARTIAL** (`partial_rep`, `Verdict partial`, `almost`). P: ↗ Almost, not counted. S: target cue toward the peak. Copy: "Not counted. A little farther." / "Go a bit further." Must never read as counted. Audio: same sentence. Motion: arrow settles toward the target, 300 ms. Exit: timeout or next attempt.

**UNCERTAIN** (`uncertain_rep`: the camera lost the person mid-rep). P: ? Couldn't see clearly (highlighter dashed ring, **never red**). S: one plain camera fix. Copy: "I couldn't see that one clearly. Step back a little." Not a mistake, not counted, not recorded as an error. Today this reaches the screen via camera advice, not a `Verdict` kind; a first-class verdict is a coach change. Exit: tracking restored.

**CORRECTING** (a `movement_error` is active). P: the one instruction (instruction tier), the affected part highlighted. S: verdict stays small. Only one correction at a time, by coach priority. Audio: once, then cooldown (12 s), then a more specific tier. Motion: highlight steady, no blinking. Exit: `movement_corrected`, or the cue expires.

**CORRECTED** (`movement_corrected`). P: ✓ Nice correction (verdict tier). S: body part turns green. Shown once, only if the person had been told about it. Motion: colour change 300 ms. Exit: timeout → ACTIVE.

## Pauses and ends

**PAUSED** (`paused`). P: "Paused" + a large Resume. S: "Take your time." T: finish for today / switch to counting by hand. Scrim over video is allowed here; never over controls. A11y: focus lands on Resume. Audio: none. Motion: 250 ms. Transition: Resume → COUNTDOWN (never straight back into movement). Exit: Resume or stop.

**REST** (`rest`). P: "Rest" + time remaining (counter tier) and what is next. S: sets done as ticks. T: stop. Copy: "Good work. Rest for 40 seconds." One job: recover; no metrics, no corrections. Never forces a countdown to hurry: "Start next set" is always available when ready. Audio: optional soft start/end cue. Motion: slow ring, none under reduced motion. Exit: person taps "Start next set" or the rest ends and offers it.

**SET_COMPLETE.** P: ✓ Set complete. S: reps done as ticks, what is next. Copy: "Set complete ✓". One calm tick draw (400 ms). Audio: short. Transition: → REST or EXERCISE_COMPLETE. Exit: automatic after reading time or on tap.

**EXERCISE_COMPLETE** (`done`). P: "Exercise complete." S: good reps of target, best range if real data exists, any therapist note (real only). T: details. One job: understand the achievement. No confetti. Primary action: next exercise or back to Today. Exit: person chooses.

**ROUTINE_COMPLETE.** P: "Today's routine complete." S: the week's tick row, real adherence only, next due day. T: link to progress. Copy never guilts about missed days. Motion: one tick fill. Exit: person leaves.

## Conditions and fallbacks

**CAMERA_UNAVAILABLE** (blocked, not found, in use). P: plain reason + what to do ("The camera is blocked. Allow it in your browser, or count your reps yourself."). S: retry. T: manual mode. Never a dead end. A11y: `role="alert"`. Exit: camera starts, or the person picks MANUAL_MODE.

**LOW_CONFIDENCE** (`camera_issue`, confidence LOW, ongoing). P: yellow ring + one camera fix ("Please move back a little."). Judgement is frozen: no rep, no error, no red. S: confidence badge in words. Audio: camera advice only, debounced. Exit: `camera_ok`. Differs from UNCERTAIN (one attempt that could not be judged).

**NETWORK_OFFLINE.** P: unobtrusive notice "You're offline. Your reps are saved on this device and will sync." Exercise continues (engine is client-side). Sync is via `chunkOutbox`; nothing is lost or counted twice. Exit: connectivity returns, queued chunks sent; a quiet "Saved" confirmation. Never blocks the set.

**AI_UNAVAILABLE** (Groq off or failing). Patient sees **no change**: wording falls back to deterministic template text with no visible gap. Therapist/report view labels the report "automatic summary" as usual. Never show "AI failed" to a patient. Exit: n/a.

**MANUAL_MODE** (`mode: manual`). P: the same big number, plain +/- buttons >= 56 px. S: "The camera is off, so form isn't checked. Your reps are saved as counted by you." Same set flow, no verdicts, no skeleton. Stored as counted by hand and labelled so in reports. Exit: finish, or retry the camera.

**ERROR** (`unavailable` with `loadError`, or unexpected failure). P: what happened in plain words + the one next step + retry. Copy: "We couldn't load your plan." Never blame, never show codes to the patient. A11y: `role="alert"`, focus on the retry. Exit: retry succeeds or back to Today.

**EMPTY_STATE.** P: dashed outline, what belongs here, the one next step ("No exercises today. Your therapist hasn't added a routine yet." only if true; otherwise "Your routine isn't ready yet."). No invented data, no filler stats. Exit: the next step.

## Ambiguity checklist

- Can GOOD be mistaken for ACTIVE with a cue? (verdict mark + word must differ from the cue)
- Can PARTIAL be read as counted? (the word "Almost" must always be paired with "not counted" in audio and caption)
- Can UNCERTAIN or LOW_CONFIDENCE look like an error? (never red)
- Can PAUSED/REST be mistaken for ACTIVE? (scrim + large label, camera judgement is off)
- Does every state name its way out?
