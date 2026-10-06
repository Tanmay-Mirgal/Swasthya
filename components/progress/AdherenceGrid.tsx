import { TickBox } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dayKey, startOfDay } from "./dates";

/** Which days had a tracked session: one box per day, grouped by week. */
export default function AdherenceGrid({ days, doneKeys }: { days: number; doneKeys: Set<string> }) {
  const today = startOfDay(new Date());
  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return { d, done: doneKeys.has(dayKey(d)) };
  });
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const doneCount = cells.filter((c) => c.done).length;
  return (
    <div role="img" aria-label={`${doneCount} of the last ${days} days had a tracked session`}>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-14 text-xs tabular text-slate-600" aria-hidden="true">
              {row[0].d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            {row.map((c, j) => (
              <TickBox key={j} state={c.done ? "done" : "todo"} size={days > 30 ? 18 : 22} className={cn(dayKey(c.d) === dayKey(today) && "ring-2 ring-slate-900 ring-offset-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
