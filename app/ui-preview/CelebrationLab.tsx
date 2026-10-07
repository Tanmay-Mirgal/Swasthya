"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import Celebration, { useCelebration } from "@/components/exercise/Celebration";
import RestPanel from "@/components/exercise/RestPanel";
import { evaluateSet, type SetCelebration, type SetFacts } from "@/lib/rehab/milestones";

/** Development only: the finished-set moment, at each size, with the rest panel that goes with it. */
const BASE: SetFacts = { setNumber: 1, totalSets: 3, exerciseComplete: false, judged: true, goodOnly: true, good: 10, invalid: 0, partial: 0, rom: 94, romUnit: "deg", targetRom: 90, personalBest: { rom: 78, unit: "deg" }, correctionsSucceeded: 2 };

const CASES: { label: string; facts: SetFacts }[] = [
  { label: "A set (nothing extra to claim)", facts: { ...BASE, invalid: 2, rom: 70, correctionsSucceeded: 0, personalBest: null } },
  { label: "A set with milestones", facts: { ...BASE, setNumber: 2 } },
  { label: "An exercise", facts: { ...BASE, setNumber: 3, exerciseComplete: true } },
  { label: "Today's routine", facts: { ...BASE, setNumber: 3, exerciseComplete: true, routineComplete: true } },
];

export default function CelebrationLab() {
  const { burst, fire } = useCelebration(true);
  const [pick, setPick] = useState(1);
  const celebration: SetCelebration = evaluateSet(CASES[pick].facts);
  return (
    <div className="mx-auto max-w-xl space-y-4 p-4">
      <Celebration burst={burst} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Which moment">
        {CASES.map((c, i) => (
          <Button key={c.label} size="md" variant={i === pick ? "primary" : "outline"} onClick={() => setPick(i)}>
            {c.label}
          </Button>
        ))}
      </div>
      <Button size="lg" onClick={() => fire(celebration.level, { on: true, volume: 0.8 })}>
        Pop it (level {celebration.level})
      </Button>
      <div className="rounded-lg border border-slate-300">
        <RestPanel setDone={CASES[pick].facts.setNumber} totalSets={3} nextSetReps={10} targetReps={10} completedReps={10 * CASES[pick].facts.setNumber} restSeconds={12} celebration={celebration} onStartNext={() => undefined} onStop={() => undefined} />
      </div>
    </div>
  );
}
