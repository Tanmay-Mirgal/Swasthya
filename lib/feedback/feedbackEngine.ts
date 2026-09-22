import { FeedbackMessage, MovementState } from "../exercises/types";
import { ConfidenceCheckResult } from "../pose/confidence";

export function generateFeedback(
  confidence: ConfidenceCheckResult,
  movementState: MovementState,
  jointAngle: number,
  repJustCompleted: boolean,
  completedReps: number,
  targetReps: number,
  exerciseId = "seated-knee-extension"
): FeedbackMessage {
  // 1. Camera / Person missing
  if (!confidence.personDetected) {
    return {
      type: "camera",
      actionDirective: "REPOSITION CAMERA",
      icon: "📷",
      message: "No person detected. Sit in front of camera view.",
    };
  }

  // 2. Pose confidence / missing landmarks
  if (confidence.status !== "READY") {
    return {
      type: "camera",
      actionDirective: "ADJUST DISTANCE",
      icon: "⚠️",
      message: confidence.message,
    };
  }

  // 3. Exercise Complete
  if (completedReps >= targetReps) {
    return {
      type: "success",
      actionDirective: "EXERCISE COMPLETE",
      icon: "🎉",
      message: "Great effort! Session target achieved.",
    };
  }

  // 4. Rep just completed
  if (repJustCompleted) {
    return {
      type: "success",
      actionDirective: `REP ${completedReps} COMPLETE`,
      icon: "✅",
      message: `Great rep! (${completedReps}/${targetReps} completed)`,
    };
  }

  const isBicep = exerciseId === "seated-bicep-curl";
  const isNeck = exerciseId === "neck-rotation";

  // 5. Movement state & form guidance
  if (isNeck) {
    switch (movementState) {
      case "READY":
        return {
          type: "info",
          actionDirective: "TURN HEAD SLOWLY",
          icon: "↩️",
          message: "Ready! Slowly rotate your head to one side.",
        };
      case "EXTENDING":
        return {
          type: "info",
          actionDirective: "KEEP ROTATING",
          icon: "➡️",
          message: "Good! Keep turning your head — reach your maximum comfortable range.",
        };
      case "EXTENDED":
        return {
          type: "success",
          actionDirective: "RETURN TO CENTER",
          icon: "⏸️",
          message: "Peak reached! Now slowly return your head to the center.",
        };
      case "RETURNING":
        return {
          type: "info",
          actionDirective: "NOW OTHER SIDE",
          icon: "⬅️",
          message: "Great! Now rotate to the OTHER side to complete the rep.",
        };
      default:
        return {
          type: "info",
          actionDirective: "KEEP GOING",
          icon: "💪",
          message: "Keep moving slowly and smoothly.",
        };
    }
  }

  // 5. Movement state & form guidance
  switch (movementState) {
    case "READY":
      return {
        type: "info",
        actionDirective: isBicep ? "START CURL UPWARD" : "START EXTENDING LEG",
        icon: "⬆️",
        message: isBicep
          ? "Ready! Slowly curl your hand upward toward your shoulder."
          : "Ready! Slowly extend your leg forward.",
      };

    case "EXTENDING":
      if (isBicep) {
        if (jointAngle > 90) {
          return {
            type: "info",
            actionDirective: "CURL HIGHER",
            icon: "⬆️",
            message: "Keep curling! Lift your hand closer to your shoulder.",
          };
        }
        return {
          type: "info",
          actionDirective: "ALMOST AT PEAK",
          icon: "🔥",
          message: "Almost at peak flex! Squeeze bicep at the top.",
        };
      } else {
        if (jointAngle < 125) {
          return {
            type: "info",
            actionDirective: "EXTEND FURTHER",
            icon: "⬆️",
            message: "Keep extending your leg straight out...",
          };
        }
        return {
          type: "info",
          actionDirective: "FULL EXTENSION",
          icon: "🔥",
          message: "Almost there! Straighten knee completely.",
        };
      }

    case "EXTENDED":
      return {
        type: "success",
        actionDirective: "HOLD POSITION",
        icon: "⏸️",
        message: isBicep
          ? "Excellent curl! Hold peak for 1s, then lower slowly."
          : "Excellent extension! Hold briefly, then return.",
      };

    case "RETURNING":
      return {
        type: "info",
        actionDirective: "LOWER CONTROLLED",
        icon: "⬇️",
        message: isBicep
          ? "Lower your arm smoothly and under control. Don't drop fast!"
          : "Lower leg smoothly back to start position.",
      };

    default:
      return {
        type: "info",
        actionDirective: "KEEP GOING",
        icon: "💪",
        message: "Maintain good form and steady rhythm.",
      };
  }
}
