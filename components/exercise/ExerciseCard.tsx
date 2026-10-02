import Link from "next/link";
import { ExerciseConfig } from "@/lib/exercises/types";
import { Play, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ExerciseCardProps {
  exercise: ExerciseConfig;
  isAvailable?: boolean;
}

export default function ExerciseCard({
  exercise,
  isAvailable = true,
}: ExerciseCardProps) {
  return (
    <Card className={`overflow-hidden transition-all duration-200 ${
      isAvailable ? "hover:border-slate-300" : "opacity-60"
    }`}>
      <CardContent className="p-0">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {exercise.name}
            </h3>
            <p className="text-sm text-slate-500 line-clamp-2">
              {exercise.description}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-200">
              {exercise.category}
            </span>
            <span className="text-xs text-slate-500">
              {exercise.targetReps} reps • {exercise.difficulty}
            </span>
          </div>

          {isAvailable ? (
            <Button asChild size="md" className="w-32 p-0.5">
              <Link href={`/exercise/${exercise.id}/setup`}>
                Start
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-slate-400 font-medium px-2 py-1">
              Coming Soon
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
