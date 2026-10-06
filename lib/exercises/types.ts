export interface ExerciseConfig {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  targetReps: number;
  primaryJoint: string;
  movement: string;
  description: string;
  instructions: string[];
}

/**
 * A free-practice session kept on this device (and copied to the account when signed in).
 * Every field is something the camera measured or the person did: nothing is a default.
 */
export interface SessionRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  targetReps: number;
  completedReps: number;
  /** Best range of motion in any counted rep, in `unit`. 0 when none was measured. */
  rom: number;
  unit?: "deg" | "pct";
  /** Mean seconds per counted rep; absent when no rep was counted. */
  averageTempo?: number;
  durationSeconds: number;
  /** Per-rep judgment from the movement engine. */
  validReps?: number;
  invalidReps?: number;
  partialReps?: number;
  correctionAttempts?: number;
  correctionsSucceeded?: number;
  avgConfidence?: number;
  /** Reps affected by each error code, worst severity seen. */
  errors?: Record<string, { count: number; severity: "minor" | "moderate" | "major" }>;
  engine?: number;
  /** Id of the copy saved to the account, once synced. */
  serverId?: string;
  targetRom?: number;
  targetMet?: boolean;
}
