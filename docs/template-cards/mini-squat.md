# Mini Squat

> **Awaiting physiotherapist review.** Every number below is an engineering default, tuned on synthetic geometry and not on real footage. It is not clinical advice.

Template `mini-squat` v1 · Hip and knee · Lower Body · Intermediate

Bend your knees a short way, as if starting to sit, keeping your knees in line with your feet, then stand tall again.

## Camera and start position
- **View:** front. Front view at about hip height, about 2 to 2.5 m away, so both hips, knees and feet are in frame.
- **Joints that must be visible:** hip, hip, knee, knee, ankle, ankle.
- **Start position:** Stand tall facing the camera, feet shoulder-width apart, near a steady support. Held for 1.2 s before any rep is judged.
- *Why:* The starting position is held for about a second so the person's own resting position is captured before any rep is judged.

## A rep is GOOD (and only then counted) when ALL of these are true
1. **It reaches the minimum range:** the depth rises to 18% (starting from about 4%). *Why:* A good rep is one where the thigh-to-shin depth ratio drops by 18% from standing (a shallow squat). Engineering default, not tuned on real footage.
2. **It returns to the start zone** (4%) before it ends. *Why:* A rep ends only when the movement returns to the starting zone, so a return is always required; a very slow return is coached, not rejected.
3. **Hold:** the template requires none; any hold the therapist prescribes is also required. *Why:* A hold is mandatory only when one is required: the template's own, or the hold the therapist prescribed, with 20% tolerance so a slight early release is not punished.
4. **It is not flicked through:** the whole cycle takes at least 1.1 s. *Why:* A whole cycle faster than 1.1 seconds is flicked through, not performed. This is half of the coaching pace and the only new mandatory tempo rule.
5. **None of these mandatory rules is broken:**
   - **Left knee drifting inward** (`knee_inward_left`, moderate): the kneeInLeft measure must stay at most 0.25 (× body scale) while out / peak / back. Held for 0.4 s before it shows; clears after 0.3 s. *Why:* A knee drifting toward the middle is a common alignment fault in squats; 0.25 hip-widths is clearly visible from the front.
   - **Right knee drifting inward** (`knee_inward_right`, moderate): the kneeInRight measure must stay at most 0.25 (× body scale) while out / peak / back. Held for 0.4 s before it shows; clears after 0.3 s. *Why:* As for the left knee.
6. **It was seen well enough to judge:** no more than 1 s of the cycle can be unseen, and every mandatory rule above must be measurable. *Why:* If the camera cannot see the movement for more than a second of a cycle (a third of a second when the rep fell short, so a missed peak is never blamed on the person), or cannot check a mandatory rule, the cycle is 'not seen', never wrong.

## What does NOT count
- **Short** (not counted, "a little farther"): the movement leaves the start clearly but stops below 18%. The band from 12% to 18% is the "almost there" band. *Why:* The old halfway-credit line is now only the 'almost there' band, so the wording can say a little farther. That line is at 12%: past it the squat is nearly deep enough.
- **Broke a rule** (not counted, the rule is named): any mandatory rule above, a missed hold, or a cycle faster than 1.1 s.
- **Not seen** (not counted, never called wrong): the camera could not see enough to judge. The patient is asked to adjust the camera, not the movement.

## Coaching only (never stops a rep counting)
- **Pace:** a cycle faster than 2.2 s is coached ("slow down"); one slower than 16 s is not penalised.
- **Return:** if the return stalls for 4.5 s, the patient is reminded to finish returning.

## What the patient sees and hears
| Situation | Shown on screen (≤ 24 characters) | Spoken / captioned (first wording) |
|---|---|---|
| insufficient_depth (below) | Bend your knees more | Bend your knees a little further, pushing your hips back. |
| too_fast (below) | Slow down | Slow down. Lower your hips over about two seconds. |
| short_hold (below) | Hold a little longer | Hold your knees bent at the bottom for a moment. |
| incomplete_return (above) | Stand all the way up | Stand all the way up, with your hips and knees straight, before the next squat. |
| knee_inward_left (above) | Keep your left knee out | Your left knee is drifting inward. Keep it in line with your left foot. |
| knee_inward_right (above) | Keep your right knee out | Your right knee is drifting inward. Keep it in line with your right foot. |

## All thresholds (for review)
| Item | Value | Source |
|---|---|---|
| Minimum range | 18% | engineering-default |
| "Almost" band starts | 12% | engineering-default |
| Start zone | 4% | engineering-default |
| Leaves the start zone | 6% | engineering-default |
| Tempo floor (mandatory) | 1.1 s | engineering-default |
| Pace coaching starts below | 2.2 s | engineering-default |
| Hold | none | engineering-default |
| Left knee drifting inward | ≤ 0.25 (mandatory) | engineering-default |
| Right knee drifting inward | ≤ 0.25 (mandatory) | engineering-default |

A therapist may accept a lower range for one patient, between the "almost" band and the minimum range above. The value actually used is stored with every session.

## Review
- [ ] Minimum range is right for this exercise
- [ ] Mandatory rules are the ones that should stop a rep counting
- [ ] Tempo floor and hold are appropriate
- [ ] Wording is clear and kind

Reviewer: ______________________   Date: ____________
