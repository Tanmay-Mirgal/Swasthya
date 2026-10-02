import { Patient, Prescription } from "./types";
import { getSessionHistory } from "../session/sessionStore";
import { SessionRecord } from "../exercises/types";

const STORAGE_KEY_PATIENTS = "rehablens_patients";

const INITIAL_MOCK_PATIENTS: Patient[] = [
  {
    id: "pat_1",
    name: "John Doe",
    age: 45,
    height: "175 cm",
    condition: "Post-op ACL Reconstruction",
    prescriptions: [
      {
        id: "rx_1",
        patientId: "pat_1",
        exerciseId: "seated-knee-extension",
        targetSets: 3,
        targetReps: 10,
        targetROM: 160,
        assignedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "pat_2",
    name: "Jane Smith",
    age: 32,
    height: "162 cm",
    condition: "Cervical Spondylosis",
    prescriptions: [
      {
        id: "rx_2",
        patientId: "pat_2",
        exerciseId: "neck-rotation",
        targetSets: 2,
        targetReps: 8,
        assignedAt: new Date().toISOString(),
      },
    ],
  },
];

export function getPatients(): Patient[] {
  if (typeof window === "undefined") return INITIAL_MOCK_PATIENTS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(INITIAL_MOCK_PATIENTS));
      return INITIAL_MOCK_PATIENTS;
    }
    return JSON.parse(raw) as Patient[];
  } catch (err) {
    console.error("Failed to read patients from localStorage:", err);
    return INITIAL_MOCK_PATIENTS;
  }
}

export function getPatientById(id: string): Patient | null {
  const patients = getPatients();
  return patients.find((p) => p.id === id) || null;
}

export function savePrescription(patientId: string, prescription: Omit<Prescription, "id" | "assignedAt">): void {
  const patients = getPatients();
  const patientIndex = patients.findIndex((p) => p.id === patientId);
  if (patientIndex === -1) return;

  const newPrescription: Prescription = {
    ...prescription,
    id: `rx_${Date.now()}`,
    assignedAt: new Date().toISOString(),
  };

  patients[patientIndex].prescriptions.push(newPrescription);

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
  }
}

// In a real app, we'd query by patientId. 
// For this local demo, we just use the device's local session history
export function getPatientSessions(patientId: string): SessionRecord[] {
  // Mock: If it's John Doe (pat_1), we show the local session history
  // Otherwise empty. This simulates a real patient's history.
  if (patientId === "pat_1") {
    return getSessionHistory();
  }
  return [];
}
