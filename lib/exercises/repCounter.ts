import { MovementState } from "./types";
import { evaluateSeatedKneeExtensionState } from "./seatedKneeExtension";
import { evaluateSeatedBicepCurlState } from "./seatedBicepCurl";
import {
  TempoTracker,
  createTempoTracker,
  startRepTimer,
  completeRepTimer,
} from "../biomechanics/tempo";

export interface RepCounterState {
  completedReps: number;
  targetReps: number;
  movementState: MovementState;
  tempoTracker: TempoTracker;
  goodFormCount: number;
  warningCount: number;
  lastRepTimestamp: number;
}

export function createRepCounterState(targetReps = 10): RepCounterState {
  return {
    completedReps: 0,
    targetReps,
    movementState: "READY",
    tempoTracker: createTempoTracker(),
    goodFormCount: 0,
    warningCount: 0,
    lastRepTimestamp: 0,
  };
}

export function processRepFrame(
  state: RepCounterState,
  primaryAngle: number,
  now = performance.now(),
  exerciseId = "seated-knee-extension"
): { newState: RepCounterState; repJustCompleted: boolean } {
  if (state.completedReps >= state.targetReps) {
    return { newState: state, repJustCompleted: false };
  }

  const { nextState, repIncremented, event } =
    exerciseId === "seated-bicep-curl"
      ? evaluateSeatedBicepCurlState(state.movementState, primaryAngle)
      : evaluateSeatedKneeExtensionState(state.movementState, primaryAngle);

  let updatedTempo = state.tempoTracker;
  if (event === "STARTED") {
    updatedTempo = startRepTimer(state.tempoTracker, now);
  }

  let repJustCompleted = false;
  let newCompletedReps = state.completedReps;
  let newGoodFormCount = state.goodFormCount;
  let newWarningCount = state.warningCount;

  if (repIncremented) {
    if (now - state.lastRepTimestamp > 800) {
      newCompletedReps += 1;
      repJustCompleted = true;
      updatedTempo = completeRepTimer(updatedTempo, now);

      if (updatedTempo.lastRepDuration >= 1.0) {
        newGoodFormCount += 1;
      } else {
        newWarningCount += 1;
      }
    }
  }

  const newState: RepCounterState = {
    ...state,
    completedReps: newCompletedReps,
    movementState: nextState,
    tempoTracker: updatedTempo,
    goodFormCount: newGoodFormCount,
    warningCount: newWarningCount,
    lastRepTimestamp: repJustCompleted ? now : state.lastRepTimestamp,
  };

  return { newState, repJustCompleted };
}
