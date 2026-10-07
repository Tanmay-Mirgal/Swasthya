# Sit to Stand

> **Awaiting physiotherapist review.** Every number below is an engineering default, tuned on synthetic geometry and not on real footage. It is not clinical advice.

Template `sit-to-stand` v1 · Hip and knee · Lower Body · Intermediate

Stand up from a sturdy chair and sit back down slowly. Builds the strength you use to get out of a chair.

## Camera and start position
- **View:** side. Side view, about 2.5 to 3 m away, so your whole body is in frame while you stand.
- **Joints that must be visible:** shoulder, hip, knee, ankle (also used if visible: foot, heel).
- **Start position:** Sit near the front of a sturdy chair, feet flat, with your side to the camera. Held for 1 s before any rep is judged.
- *Why:* The starting position is held for about a second so the person's own resting position is captured before any rep is judged.

## A rep is GOOD (and only then counted) when ALL of these are true
1. **It reaches the minimum range:** the knee rises to 165° (starting from about 115°). *Why:* A good rep is one where the knee reaches 165 degrees (standing fully). Engineering default, not tuned on real footage.
2. **It returns to the start zone** (115°) before it ends. *Why:* A rep ends only when the movement returns to the starting zone, so a return is always required; a very slow return is coached, not rejected.
3. **Hold:** the template requires none; any hold the therapist prescribes is also required. *Why:* A hold is mandatory only when one is required: the template's own, or the hold the therapist prescribed, with 20% tolerance so a slight early release is not punished.
4. **It is not flicked through:** the whole cycle takes at least 1.1 s. *Why:* A whole cycle faster than 1.1 seconds is flicked through, not performed. This is half of the coaching pace and the only new mandatory tempo rule.
5. **None of these mandatory rules is broken:**
   - **Leaning too far forward** (`trunk_lean_forward`, moderate): the trunk measure must stay at most 55° while out / peak / back. Held for 0.6 s before it shows; clears after 0.3 s. *Why:* Some forward lean is normal when standing; 55 degrees is a deliberately generous limit and is flagged for review on real footage.
6. **It was seen well enough to judge:** no more than 1 s of the cycle can be unseen, and every mandatory rule above must be measurable. *Why:* If the camera cannot see the movement for more than a second of a cycle (a third of a second when the rep fell short, so a missed peak is never blamed on the person), or cannot check a mandatory rule, the cycle is 'not seen', never wrong.

## What does NOT count
- **Short** (not counted, "a little farther"): the movement leaves the start clearly but stops below 165°. The band from 150° to 165° is the "almost there" band. *Why:* The old halfway-credit line is now only the 'almost there' band, so the wording can say a little farther. That line is at 150 degrees: past it the stand is nearly complete.
- **Broke a rule** (not counted, the rule is named): any mandatory rule above, a missed hold, or a cycle faster than 1.1 s.
- **Not seen** (not counted, never called wrong): the camera could not see enough to judge. The patient is asked to adjust the camera, not the movement.

## Coaching only (never stops a rep counting)
- **Pace:** a cycle faster than 2.2 s is coached ("slow down"); one slower than 16 s is not penalised.
- **Return:** if the return stalls for 4.5 s, the patient is reminded to finish returning.

## What the patient sees and hears
| Situation | Shown on screen (≤ 24 characters) | Spoken / captioned (first wording) |
|---|---|---|
| incomplete_stand (below) | Stand up fully | Stand all the way up until your hips and knees are straight. |
| too_fast (below) | Slow down | Slow down. Lower your hips back to the chair over about three seconds. |
| short_hold (below) | Hold a little longer | Stand tall and hold your knees straight for a moment. |
| incomplete_return (above) | Sit fully back down | Sit all the way back down before you stand again. |
| trunk_lean_forward (above) | Keep your chest up | You are leaning far forward. Lift your chest and look ahead as you stand. |

## All thresholds (for review)
| Item | Value | Source |
|---|---|---|
| Minimum range | 165° | engineering-default |
| "Almost" band starts | 150° | engineering-default |
| Start zone | 115° | engineering-default |
| Leaves the start zone | 125° | engineering-default |
| Tempo floor (mandatory) | 1.1 s | engineering-default |
| Pace coaching starts below | 2.2 s | engineering-default |
| Hold | none | engineering-default |
| Leaning too far forward | ≤ 55 (mandatory) | engineering-default |

A therapist may accept a lower range for one patient, between the "almost" band and the minimum range above. The value actually used is stored with every session.

## Review
- [ ] Minimum range is right for this exercise
- [ ] Mandatory rules are the ones that should stop a rep counting
- [ ] Tempo floor and hold are appropriate
- [ ] Wording is clear and kind

Reviewer: ______________________   Date: ____________
