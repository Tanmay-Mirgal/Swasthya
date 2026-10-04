"use client";

import { ExtendedExerciseConfig } from "@/lib/exercises/registry";
import RecommendedHero from "./RecommendedHero";
import ExerciseRow from "./ExerciseRow";

interface ExerciseCardProps {
  exercise: ExtendedExerciseConfig;
  isFeatured?: boolean;
  isAvailable?: boolean;
  matchedConcern?: string;
  matchType?: string;
  clinicalRationale?: string;
  confidencePercent?: number;
  targetSets?: number;
  targetReps?: number;
}

export default function ExerciseCard({
  exercise,
  isFeatured = false,
  matchedConcern,
  matchType,
  clinicalRationale,
  targetSets,
  targetReps,
}: ExerciseCardProps) {
  if (isFeatured) {
    return (
      <RecommendedHero
        exercise={exercise}
        matchedConcern={matchedConcern}
        matchType={matchType}
        clinicalRationale={clinicalRationale}
        targetSets={targetSets}
        targetReps={targetReps}
      />
    );
  }

  return <ExerciseRow exercise={exercise} />;
}
