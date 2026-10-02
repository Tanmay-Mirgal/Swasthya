import AppShell from "@/components/navigation/AppShell";
import ExerciseCard from "@/components/exercise/ExerciseCard";
import { getAllExercises } from "@/lib/exercises/registry";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();

  return (
    <AppShell title="Programs" showBackNav backHref="/">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="text-slate-500 text-sm mt-1">
            Select a program to start your guided session.
          </p>
        </div>

        <div className="space-y-3">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} isAvailable={ex.isAvailable} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
