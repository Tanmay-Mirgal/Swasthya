import Link from "next/link";
import { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import { Dumbbell, Activity, ChevronRight, UserCircle, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseCardProps {
  exercise: ExtendedExerciseConfig;
  isFeatured?: boolean;
  isAvailable?: boolean;
}

export default function ExerciseCard({
  exercise,
  isFeatured = false,
  isAvailable = true,
}: ExerciseCardProps) {
  
  // Choose an icon based on body segment
  const getIcon = () => {
    switch (exercise.bodySegment) {
      case "upper": return <Dumbbell className={cn("w-5 h-5", isFeatured ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600")} />;
      case "lower": return <Activity className={cn("w-5 h-5", isFeatured ? "text-indigo-600" : "text-slate-500 group-hover:text-indigo-600")} />;
      case "neck": return <RefreshCcw className={cn("w-5 h-5", isFeatured ? "text-emerald-600" : "text-slate-500 group-hover:text-emerald-600")} />;
      default: return <UserCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getIconBg = () => {
    if (!isAvailable) return "bg-slate-100";
    switch (exercise.bodySegment) {
      case "upper": return isFeatured ? "bg-blue-50" : "bg-slate-100 group-hover:bg-blue-50";
      case "lower": return isFeatured ? "bg-indigo-50" : "bg-slate-100 group-hover:bg-indigo-50";
      case "neck": return isFeatured ? "bg-emerald-50" : "bg-slate-100 group-hover:bg-emerald-50";
      default: return "bg-slate-100";
    }
  };

  const CardContent = (
    <div className={cn(
      "flex items-center gap-4 transition-all duration-200",
      isFeatured 
        ? "p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow-md" 
        : "py-3 px-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 group",
      !isAvailable && "opacity-50 grayscale"
    )}>
      
      {/* Icon Area */}
      <div className={cn(
        "flex items-center justify-center shrink-0 transition-colors duration-300",
        isFeatured ? "w-14 h-14 rounded-2xl" : "w-11 h-11 rounded-xl",
        getIconBg()
      )}>
        {getIcon()}
      </div>

      {/* Info Area */}
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "font-semibold truncate text-slate-900",
          isFeatured ? "text-lg mb-1" : "text-[15px] mb-0.5"
        )}>
          {exercise.name}
        </h3>
        
        <div className="flex items-center text-xs text-slate-500 font-medium">
          <span>{exercise.category}</span>
          <span className="mx-1.5 opacity-40">•</span>
          <span>{exercise.targetReps} reps</span>
        </div>
        
        {isFeatured && (
          <p className="text-sm text-slate-500 mt-2 line-clamp-1">
             {exercise.description}
          </p>
        )}
      </div>

      {/* Action / CTA */}
      <div className="shrink-0 flex items-center pl-2">
        {!isAvailable ? (
          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
            Soon
          </span>
        ) : isFeatured ? (
           <div className="flex items-center text-sm font-semibold text-slate-900 bg-slate-100 px-4 py-2 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
             Start <ChevronRight className="w-4 h-4 ml-1 opacity-70" />
           </div>
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors duration-300" />
        )}
      </div>
    </div>
  );

  if (!isAvailable) {
    return <div className="cursor-not-allowed">{CardContent}</div>;
  }

  return (
    <Link href={`/exercise/${exercise.id}/setup`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 rounded-2xl">
      {CardContent}
    </Link>
  );
}
