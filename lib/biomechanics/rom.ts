export interface ROMTracker {
  minAngle: number;
  maxAngle: number;
  currentAngle: number;
  rom: number;
}

export function createROMTracker(): ROMTracker {
  return {
    minAngle: 180,
    maxAngle: 0,
    currentAngle: 0,
    rom: 0,
  };
}

export function updateROM(tracker: ROMTracker, currentAngle: number): ROMTracker {
  if (currentAngle <= 0 || currentAngle > 180) return tracker;

  const newMin = Math.min(tracker.minAngle, currentAngle);
  const newMax = Math.max(tracker.maxAngle, currentAngle);
  const newRom = Math.max(0, newMax - newMin);

  return {
    minAngle: newMin,
    maxAngle: newMax,
    currentAngle,
    rom: newRom,
  };
}
