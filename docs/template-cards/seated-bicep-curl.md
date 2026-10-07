# Seated Bicep Curl

> **Awaiting physiotherapist review.** Every number below is an engineering default, tuned on synthetic geometry and not on real footage. It is not clinical advice.

Template `seated-bicep-curl` v2 · Elbow · Upper Body · Beginner

Sit upright, bend your elbow to curl your hand toward your shoulder, then lower it under control.

## Camera and start position
- **View:** either. Front or slightly side-on, about 1 to 2 m away, so shoulder, elbow and wrist are in view.
- **Joints that must be visible:** shoulder, elbow, wrist, hip.
- **Start position:** Sit tall with your arm hanging by your side. Held for 0.9 s before any rep is judged.
- *Why:* The starting position is held for about a second so the person's own resting position is captured before any rep is judged.

## A rep is GOOD (and only then counted) when ALL of these are true
1. **It reaches the minimum range:** the elbow falls to 72° (starting from about 140°). *Why:* A good rep is one where the elbow bends to 72 degrees or less (a full curl). Engineering default, not tuned on real footage.
2. **It returns to the start zone** (140°) before it ends. *Why:* A rep ends only when the movement returns to the starting zone, so a return is always required; a very slow return is coached, not rejected.
3. **Hold:** the template requires none; any hold the therapist prescribes is also required. *Why:* A hold is mandatory only when one is required: the template's own, or the hold the therapist prescribed, with 20% tolerance so a slight early release is not punished.
4. **It is not flicked through:** the whole cycle takes at least 0.8 s. *Why:* A whole cycle faster than 0.8 seconds is flicked through, not performed. This is half of the coaching pace and the only new mandatory tempo rule.
5. **None of these mandatory rules is broken:**
   - **Elbow drifting away from the body** (`elbow_drift`, moderate): the upperArm measure must stay at most 28° while out / peak / back. Held for 0.5 s before it shows; clears after 0.3 s. *Why:* A swinging elbow lets the shoulder do the work of the elbow; 28 degrees of upper-arm swing is clearly visible on camera.
   - **Leaning the trunk** (`trunk_lean`, moderate): the trunk measure must stay at most 18° while out / peak / back. Held for 0.5 s before it shows; clears after 0.3 s. *Why:* Leaning back to heave the weight up changes the exercise; 18 degrees from upright is clearly visible.
6. **It was seen well enough to judge:** no more than 1 s of the cycle can be unseen, and every mandatory rule above must be measurable. *Why:* If the camera cannot see the movement for more than a second of a cycle (a third of a second when the rep fell short, so a missed peak is never blamed on the person), or cannot check a mandatory rule, the cycle is 'not seen', never wrong.

## What does NOT count
- **Short** (not counted, "a little farther"): the movement leaves the start clearly but stops below 72°. The band from 95° to 72° is the "almost there" band. *Why:* The old halfway-credit line is now only the 'almost there' band, so the wording can say a little farther. That line is at 95 degrees: past it the curl is nearly there.
- **Broke a rule** (not counted, the rule is named): any mandatory rule above, a missed hold, or a cycle faster than 0.8 s.
- **Not seen** (not counted, never called wrong): the camera could not see enough to judge. The patient is asked to adjust the camera, not the movement.

## Coaching only (never stops a rep counting)
- **Pace:** a cycle faster than 1.6 s is coached ("slow down"); one slower than 14 s is not penalised.
- **Return:** if the return stalls for 3.5 s, the patient is reminded to finish returning.

## What the patient sees and hears
| Situation | Shown on screen (≤ 24 characters) | Spoken / captioned (first wording) |
|---|---|---|
| insufficient_curl (below) | Curl a little higher | Curl your hand a little higher toward your shoulder. |
| too_fast (below) | Slow down | Slow down. Take about two seconds to curl your hand up. |
| short_hold (below) | Hold a little longer | Hold your hand at the top of the curl for a moment. |
| incomplete_return (above) | Lower your arm fully | Lower your arm all the way down before the next curl. |
| elbow_drift (above) | Keep elbow by your side | Your elbow is drifting. Keep it close to your side as you curl. |
| trunk_lean (above) | Sit tall | You are leaning. Sit tall and keep your shoulders over your hips. |

## All thresholds (for review)
| Item | Value | Source |
|---|---|---|
| Minimum range | 72° | engineering-default |
| "Almost" band starts | 95° | engineering-default |
| Start zone | 140° | engineering-default |
| Leaves the start zone | 125° | engineering-default |
| Tempo floor (mandatory) | 0.8 s | engineering-default |
| Pace coaching starts below | 1.6 s | engineering-default |
| Hold | none | engineering-default |
| Elbow drifting away from the body | ≤ 28 (mandatory) | engineering-default |
| Leaning the trunk | ≤ 18 (mandatory) | engineering-default |

A therapist may accept a lower range for one patient, between the "almost" band and the minimum range above. The value actually used is stored with every session.

## Review
- [ ] Minimum range is right for this exercise
- [ ] Mandatory rules are the ones that should stop a rep counting
- [ ] Tempo floor and hold are appropriate
- [ ] Wording is clear and kind

Reviewer: ______________________   Date: ____________
