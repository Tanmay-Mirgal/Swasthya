export interface Prescription {
  id: string;
  patientId: string;
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetROM?: number;
  notes?: string;
  assignedAt: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  height: string;
  condition: string;
  prescriptions: Prescription[];
}
