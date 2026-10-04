export type MovementState =
  | "READY"
  | "EXTENDING"
  | "EXTENDED"
  | "RETURNING";

export type FeedbackType = "success" | "warning" | "camera" | "info";

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
  actionDirective?: string; // e.g. "CURL UPWARD", "EXTEND LEG", "HOLD PEAK", "LOWER SLOWLY"
  icon?: string; // e.g. "⬆️", "⏸️", "⬇️", "✅", "⚠️"
}

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

export interface BiomechanicalMetrics {
  currentAngle: number;
  minAngle: number;
  maxAngle: number;
  rom: number;
  lastTempo: number;
  averageTempo: number;
}

export interface SessionRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  targetReps: number;
  completedReps: number;
  minAngle: number;
  maxAngle: number;
  rom: number;
  averageTempo: number;
  goodFormCount: number;
  warningCount: number;
  durationSeconds: number;
  targetRom?: number;
  targetMet?: boolean;
}
