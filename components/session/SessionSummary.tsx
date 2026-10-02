import Link from "next/link";
import { SessionRecord } from "@/lib/exercises/types";
import {
  Trophy,
  CheckCircle2,
  Clock,
  Compass,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface SessionSummaryProps {
  session: SessionRecord;
}

export default function SessionSummary({ session }: SessionSummaryProps) {
  const accuracy = Math.round(
    (session.goodFormCount / Math.max(1, session.completedReps)) * 100
  );

  return (
    <div className="w-full space-y-6 pb-6">
      {/* Header Info */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
          <Trophy className="w-4 h-4" />
          <span>Session Completed</span>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {session.exerciseName}
        </h2>

        <p className="text-sm text-slate-500">
          {new Date(session.date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Main Rep Highlight Card */}
      <Card className="bg-slate-900 text-white border-0 shadow-xl">
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm font-medium text-slate-400">
            Repetitions Completed
          </p>

          <div className="text-5xl font-bold tracking-tight py-2">
            {session.completedReps} <span className="text-2xl text-slate-500">/ {session.targetReps}</span>
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-sm font-medium text-slate-200">
            Form Accuracy: {accuracy}%
          </div>
        </CardContent>
      </Card>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Compass className="w-4 h-4 text-slate-400" />
              <span>ROM</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {session.rom}&deg;
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Tempo</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {session.averageTempo > 0 ? `${session.averageTempo}s` : "--"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Good Form</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {session.goodFormCount}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Form Hints</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {session.warningCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button asChild size="lg" className="w-full">
          <Link href="/progress">
            View Analytics
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href="/">
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
