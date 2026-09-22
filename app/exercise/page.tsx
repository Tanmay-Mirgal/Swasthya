import AppShell from "@/components/navigation/AppShell";
import ExerciseCard from "@/components/exercise/ExerciseCard";
import { getAllExercises } from "@/lib/exercises/registry";
import { Dumbbell, ShieldCheck, Sparkles } from "lucide-react";

export default function ExerciseSelectionPage() {
  const exercises = getAllExercises();

  return (
    <AppShell title="Exercise Catalog" showBackNav backHref="/">
      <div className="space-y-4 pt-1">
        {/* Header Description Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-xl space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Physiotherapy Programs
            </h2>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Select a targeted exercise below. Each program includes AI pose landmark verification, joint angle calculations, and live corrective voice &amp; banner feedback.
          </p>
        </div>

        {/* Exercise List */}
        <div className="space-y-3">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} isAvailable={ex.isAvailable} />
          ))}
        </div>

        {/* Safety & Camera Tip Card */}
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Setup Reminder
            </span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Place your device 1.5 to 2.5 meters away in a well-lit space. Ensure your target joint points are visible in frame before beginning.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
