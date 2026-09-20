import AppShell from "@/components/navigation/AppShell";
import ExerciseCard from "@/components/exercise/ExerciseCard";
import { getAllExercises } from "@/lib/exercises/registry";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();

  return (
    <AppShell title="Choose an Exercise" showBackNav backHref="/">
      <div className="space-y-4 pt-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Select an exercise below to start camera setup and live tracking.
        </p>

        {/* List of Exercises */}
        {exercises.map((ex) => (
          <ExerciseCard key={ex.id} exercise={ex} isAvailable={ex.isAvailable} />
        ))}
      </div>
    </AppShell>
  );
}
