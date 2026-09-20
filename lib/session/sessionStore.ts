import { SessionRecord } from "../exercises/types";

const STORAGE_KEY = "rehablens_sessions";

export function saveSession(session: Omit<SessionRecord, "id" | "date">): SessionRecord {
  const history = getSessionHistory();

  const newRecord: SessionRecord = {
    ...session,
    id: `session_${Date.now()}`,
    date: new Date().toISOString(),
  };

  const updatedHistory = [newRecord, ...history];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (err) {
      console.error("Failed to save session to localStorage:", err);
    }
  }

  return newRecord;
}

export function getSessionHistory(): SessionRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionRecord[];
  } catch (err) {
    console.error("Failed to read sessions from localStorage:", err);
    return [];
  }
}

export function getLatestSession(): SessionRecord | null {
  const history = getSessionHistory();
  return history.length > 0 ? history[0] : null;
}

export function getAggregateStats() {
  const history = getSessionHistory();

  const totalSessions = history.length;
  const totalReps = history.reduce((acc, s) => acc + s.completedReps, 0);
  const avgRom =
    totalSessions > 0
      ? Math.round(history.reduce((acc, s) => acc + s.rom, 0) / totalSessions)
      : 0;

  return {
    totalSessions,
    totalReps,
    avgRom,
  };
}
