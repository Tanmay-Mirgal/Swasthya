import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

interface RepCounterProps {
  completedReps: number;
  targetReps: number;
}

export default function RepCounter({ completedReps, targetReps }: RepCounterProps) {
  const percentage = Math.min(100, Math.round((completedReps / Math.max(1, targetReps)) * 100));
  const isComplete = completedReps >= targetReps;

  return (
    <Card className={isComplete ? "bg-emerald-50 border-emerald-200" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className={`w-5 h-5 ${isComplete ? "text-emerald-600" : "text-slate-600"}`} />
            <h2 className="text-sm font-semibold text-slate-900">
              Repetitions
            </h2>
          </div>

          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end">
              <span className={`text-2xl font-bold tracking-tight ${isComplete ? "text-emerald-700" : "text-slate-900"}`}>
                {completedReps}
              </span>
              <span className="text-sm text-slate-500 font-medium">
                / {targetReps}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${isComplete ? "bg-emerald-500" : "bg-slate-900"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isComplete && (
          <p className="text-xs text-emerald-600 font-medium text-center">
            Target Reached!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
