# Shoulder Abduction

> **Awaiting physiotherapist review.** Every number below is an engineering default, tuned on synthetic geometry and not on real footage. It is not clinical advice.

Template `shoulder-abduction` v1 · Shoulder · Upper Body · Beginner

Lift your arm out to the side up to shoulder height, then lower it slowly. Works the muscles that raise the arm.

## Camera and start position
- **View:** front. Front view, about 1.5 to 2.5 m away, so both shoulders and the whole arm are in view.
- **Joints that must be visible:** shoulder, elbow, wrist, ear, hip.
- **Start position:** Stand or sit tall facing the camera, with your arms relaxed at your sides. Held for 1 s before any rep is judged.
- *Why:* The starting position is held for about a second so the person's own resting position is captured before any rep is judged.

## A rep is GOOD (and only then counted) when ALL of these are true
1. **It reaches the minimum range:** the arm rises to 85° (starting from about 25°). *Why:* A good rep is one where the arm reaches 85 degrees from the side of the body (close to shoulder height). Engineering default, not tuned on real footage.
2. **It returns to the start zone** (25°) before it ends. *Why:* A rep ends only when the movement returns to the starting zone, so a return is always required; a very slow return is coached, not rejected.
3. **Hold:** the template requires none; any hold the therapist prescribes is also required. *Why:* A hold is mandatory only when one is required: the template's own, or the hold the therapist prescribed, with 20% tolerance so a slight early release is not punished.
4. **It is not flicked through:** the whole cycle takes at least 1 s. *Why:* A whole cycle faster than 1 seconds is flicked through, not performed. This is half of the coaching pace and the only new mandatory tempo rule.
5. **None of these mandatory rules is broken:**
   - **Arm lifted above shoulder height** (`arm_too_high`, moderate): the arm measure must stay at most 105° while out / peak. Held for 0.4 s before it shows; clears after 0.3 s. *Why:* Above shoulder height changes which structures are loaded; 105 degrees leaves a margin over the 85 degree target.
   - **Shoulder lifting toward the ear** (`shoulder_shrug`, moderate): the shrug measure must stay at most 0.12 (× body scale) while out / peak / back. Held for 0.5 s before it shows; clears after 0.3 s. *Why:* A rising shoulder is the usual substitute for lifting the arm.
   - **Leaning the trunk** (`trunk_lean`, moderate): the trunk measure must stay at most 15° while out / peak / back. Held for 0.6 s before it shows; clears after 0.3 s. *Why:* Leaning sideways to lift the arm higher; 15 degrees is clearly visible from the front.
6. **It was seen well enough to judge:** no more than 1 s of the cycle can be unseen, and every mandatory rule above must be measurable. *Why:* If the camera cannot see the movement for more than a second of a cycle (a third of a second when the rep fell short, so a missed peak is never blamed on the person), or cannot check a mandatory rule, the cycle is 'not seen', never wrong.

## What does NOT count
- **Short** (not counted, "a little farther"): the movement leaves the start clearly but stops below 85°. The band from 70° to 85° is the "almost there" band. *Why:* The old halfway-credit line is now only the 'almost there' band, so the wording can say a little farther. That line is at 70 degrees: past it the lift is nearly there.
- **Broke a rule** (not counted, the rule is named): any mandatory rule above, a missed hold, or a cycle faster than 1 s.
- **Not seen** (not counted, never called wrong): the camera could not see enough to judge. The patient is asked to adjust the camera, not the movement.

## Coaching only (never stops a rep counting)
- **Pace:** a cycle faster than 2 s is coached ("slow down"); one slower than 14 s is not penalised.
- **Return:** if the return stalls for 3.5 s, the patient is reminded to finish returning.
- **Elbow bending during the lift** (`elbow_bent`, minor): the elbow measure must stay at least 145° while out / peak. Held for 0.6 s before it shows; clears after 0.3 s. *Why:* A bent elbow shortens the lever; it only coaches.

## What the patient sees and hears
| Situation | Shown on screen (≤ 24 characters) | Spoken / captioned (first wording) |
|---|---|---|
| insufficient_raise (below) | Lift your arm higher | Lift your arm a little higher, up toward shoulder height. |
| too_fast (below) | Slow down | Slow down. Take about two seconds to lift your arm. |
| short_hold (below) | Hold a little longer | Hold your arm out at the top for a moment. |
| incomplete_return (above) | Lower your arm fully | Lower your arm all the way to your side before lifting again. |
| arm_too_high (above) | Stop at shoulder height | Lower your arm a little. Stop when it is level with your shoulder. |
| shoulder_shrug (above) | Relax your shoulders | Keep your shoulder relaxed and down, away from your ear, as your arm lifts. |
| elbow_bent (below) | Keep your arm straight | Keep your arm nearly straight as you lift it out to the side. |
| trunk_lean (above) | Keep your body upright | You are leaning to the side. Stay tall and let only your arm move. |

## All thresholds (for review)
| Item | Value | Source |
|---|---|---|
| Minimum range | 85° | engineering-default |
| "Almost" band starts | 70° | engineering-default |
| Start zone | 25° | engineering-default |
| Leaves the start zone | 33° | engineering-default |
| Tempo floor (mandatory) | 1 s | engineering-default |
| Pace coaching starts below | 2 s | engineering-default |
| Hold | none | engineering-default |
| Arm lifted above shoulder height | ≤ 105 (mandatory) | engineering-default |
| Shoulder lifting toward the ear | ≤ 0.12 (mandatory) | engineering-default |
| Elbow bending during the lift | ≥ 145 (coaching) | engineering-default |
| Leaning the trunk | ≤ 15 (mandatory) | engineering-default |

A therapist may accept a lower range for one patient, between the "almost" band and the minimum range above. The value actually used is stored with every session.

## Review
- [ ] Minimum range is right for this exercise
- [ ] Mandatory rules are the ones that should stop a rep counting
- [ ] Tempo floor and hold are appropriate
- [ ] Wording is clear and kind

Reviewer: ______________________   Date: ____________
