export interface TempoTracker {
  startTime: number | null;
  lastPhaseTime: number | null;
  lastRepDuration: number; // in seconds
  averageTempo: number; // in seconds
  totalRepCount: number;
}

export function createTempoTracker(): TempoTracker {
  return {
    startTime: null,
    lastPhaseTime: null,
    lastRepDuration: 0,
    averageTempo: 0,
    totalRepCount: 0,
  };
}

export function startRepTimer(tracker: TempoTracker, now = performance.now()): TempoTracker {
  return {
    ...tracker,
    startTime: now,
    lastPhaseTime: now,
  };
}

export function completeRepTimer(tracker: TempoTracker, now = performance.now()): TempoTracker {
  if (!tracker.startTime) return tracker;

  const durationSec = Number(((now - tracker.startTime) / 1000).toFixed(1));
  const newCount = tracker.totalRepCount + 1;
  const newAvg = Number(
    ((tracker.averageTempo * tracker.totalRepCount + durationSec) / newCount).toFixed(1)
  );

  return {
    startTime: null,
    lastPhaseTime: null,
    lastRepDuration: durationSec,
    averageTempo: newAvg,
    totalRepCount: newCount,
  };
}
