"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import AppShell from "@/components/layout/AppShell";
import ExerciseLibrary, { type LibrarySuggestion } from "@/components/exercise/ExerciseLibrary";
import { getAllExercises } from "@/lib/exercises/registry";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();
  const { getToken, isSignedIn } = useAuth();
  const [suggestion, setSuggestion] = useState<LibrarySuggestion | null>(null);
  const [prescribedIds, setPrescribedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [recRes, dashRes] = await Promise.all([
          fetch("/api/patient/recommendations", { headers }),
          fetch("/api/patient/dashboard", { headers }),
        ]);
        if (recRes.ok) {
          const json = await recRes.json();
          const primary = json?.data?.primary;
          if (!cancelled && primary?.exercise?.id) {
            setSuggestion({ exerciseId: primary.exercise.id, reason: primary.clinicalRationale, sets: primary.targetSets, reps: primary.targetReps });
          }
        }
        if (dashRes.ok) {
          const json = await dashRes.json();
          const ids = (json?.data?.exerciseAssignments ?? []).map((a: { exerciseId: string }) => a.exerciseId);
          if (!cancelled) setPrescribedIds(ids);
        }
      } catch {
        /* the library works without suggestions */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  return (
    <AppShell title="Exercises">
      <ExerciseLibrary exercises={exercises} suggestion={suggestion} prescribedIds={prescribedIds} />
    </AppShell>
  );
}
