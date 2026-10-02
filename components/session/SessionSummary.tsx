import Link from "next/link";
import { SessionRecord } from "@/lib/exercises/types";
import {
  CheckCircle2,
  Clock,
  Activity,
  AlertCircle,
  Check,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SessionSummaryProps {
  session: SessionRecord;
}

export default function SessionSummary({ session }: SessionSummaryProps) {
  // 1. Data Formatting
  const repsCompleted = session.completedReps;
  const targetReps = session.targetReps;
  const isPerfectForm = session.goodFormCount >= repsCompleted && repsCompleted > 0;
  
  // Format ROM safely (no floating point messes)
  const formattedRom = Math.round(session.rom || 0);
  
  // Format Tempo safely (e.g. 1.6s)
  const formattedTempo = session.averageTempo > 0 ? (Math.round(session.averageTempo * 10) / 10).toFixed(1) : "--";

  const hints = session.warningCount;

  // Date formatting (e.g. Oct 2 · 7:46 PM)
  const dateObj = new Date(session.date);
  const formattedDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const formattedTime = dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // 2. Dynamic Takeaway Message
  let takeawayMessage = "";
  if (repsCompleted === 0) {
    takeawayMessage = "Session ended before any repetitions were completed.";
  } else if (isPerfectForm) {
    takeawayMessage = `All ${repsCompleted} repetitions were completed with excellent form. Great job!`;
  } else if (hints > 0) {
    takeawayMessage = `You completed ${repsCompleted} repetitions. Review your form hints to improve next time.`;
  } else {
    takeawayMessage = "Session completed successfully. Keep up the good work!";
  }

  return (
    <div className="w-full h-full flex flex-col justify-between px-4 pb-6 max-w-lg mx-auto">
      
      {/* 1. Hero Completion Area */}
      <div className="flex flex-col items-center text-center mt-6 sm:mt-10 space-y-5">
        
        {/* Animated Checkmark */}
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-1 animate-in zoom-in duration-500 shadow-sm border border-emerald-200">
          <Check className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" strokeWidth={3} />
        </div>

        {/* Title */}
        <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
          <h1 className="text-emerald-700 font-semibold tracking-wide uppercase text-xs sm:text-sm">
            Session Complete
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight max-w-[280px] sm:max-w-xs mx-auto">
            {session.exerciseName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {formattedDate} &middot; {formattedTime}
          </p>
        </div>

        {/* Reps Visual */}
        <div className="mt-6 mb-2 animate-in fade-in zoom-in-95 duration-500 delay-300">
          <div className="inline-flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-full w-36 h-36 sm:w-40 sm:h-40 shadow-xl shadow-slate-200/50 relative overflow-hidden">
             {/* Subtle success background gradient inside the circle */}
             <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 to-transparent pointer-events-none" />
             <div className="relative z-10 flex flex-col items-center">
               <div className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tighter">
                 {repsCompleted} <span className="text-slate-400 text-xl sm:text-2xl font-semibold">/ {targetReps}</span>
               </div>
               <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-500 mt-1">
                 Reps
               </div>
             </div>
             
             {/* Progress SVG Ring */}
             <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="46" fill="none" stroke="#F1F5F9" strokeWidth="6" />
               <circle 
                 cx="50" 
                 cy="50" 
                 r="46" 
                 fill="none" 
                 stroke="#10B981" 
                 strokeWidth="6" 
                 strokeLinecap="round"
                 strokeDasharray="289"
                 strokeDashoffset={289 - (289 * Math.min(repsCompleted / Math.max(1, targetReps), 1))}
                 className="transition-all duration-1000 ease-out"
               />
             </svg>
          </div>
        </div>

        {/* Takeaway message */}
        <p className="text-[14px] sm:text-[15px] text-slate-600 max-w-[280px] sm:max-w-sm leading-relaxed animate-in fade-in duration-500 delay-500">
          {takeawayMessage}
        </p>

      </div>

      {/* 2. Compact Metrics Section */}
      <div className="mt-8 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 w-full">
        <h3 className="text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-3 px-1">
          Session Details
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100 overflow-hidden">
          
          <MetricRow 
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            label="Good form reps"
            value={`${session.goodFormCount} / ${repsCompleted}`}
          />
          
          <MetricRow 
            icon={<Activity className="w-4 h-4 text-blue-500" />}
            label="Range of motion"
            value={`${formattedRom}°`}
          />
          
          <MetricRow 
            icon={<Clock className="w-4 h-4 text-indigo-500" />}
            label="Average tempo"
            value={formattedTempo === "--" ? "--" : `${formattedTempo} sec`}
          />

          <MetricRow 
            icon={<AlertCircle className={cn("w-4 h-4", hints > 0 ? "text-amber-500" : "text-slate-400")} />}
            label="Form hints"
            value={hints > 0 ? `${hints} hints` : "None"}
            valueClass={hints > 0 ? "text-amber-600 font-semibold" : "text-slate-500"}
          />

        </div>
      </div>

      {/* 3. Action Area */}
      <div className="space-y-3 mt-auto animate-in fade-in slide-in-from-bottom-2 duration-500 delay-700 w-full">
        <Button asChild size="lg" className="w-full h-14 text-base font-semibold rounded-2xl shadow-md">
          <Link href="/">
            Done
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full h-12 text-slate-500 hover:text-slate-900 rounded-2xl">
          <Link href="/progress">
            View Progress <TrendingUp className="w-4 h-4 ml-1.5" />
          </Link>
        </Button>
      </div>

    </div>
  );
}

function MetricRow({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between p-3.5 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
          {icon}
        </div>
        <span className="text-[13px] sm:text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className={cn("text-[13px] sm:text-sm font-semibold text-slate-900", valueClass)}>
        {value}
      </span>
    </div>
  );
}
