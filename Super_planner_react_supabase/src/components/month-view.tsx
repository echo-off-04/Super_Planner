import { useMemo } from "react";
import type { Activity, RestDay } from "@/lib/supabase";
import {
  DAY_SHORT,
  MONTH_LABELS,
  addDays,
  formatDateISO,
  startOfWeek,
  activityWorkHours,
} from "@/lib/time";
import { cn } from "@/lib/utils";

interface Props {
  month: Date;
  activities: Activity[];
  restDays: RestDay[];
  onSelectDay: (date: Date) => void;
}

export function MonthView({ month, activities, restDays, onSelectDay }: Props) {
  const grid = useMemo(() => {
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const activityMap = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) {
      const iso = formatDateISO(new Date(a.start_time));
      if (!m.has(iso)) m.set(iso, []);
      m.get(iso)!.push(a);
    }
    return m;
  }, [activities]);

  const restMap = useMemo(() => {
    const m = new Map<string, RestDay>();
    for (const r of restDays) m.set(r.rest_date, r);
    return m;
  }, [restDays]);

  const today = new Date();

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-base font-semibold">
          {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
        </h3>
      </div>
      <div className="grid grid-cols-7 border-b">
        {DAY_SHORT.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((date, i) => {
          const iso = formatDateISO(date);
          const isCurrentMonth = date.getMonth() === month.getMonth();
          const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
          const dayActs = activityMap.get(iso) ?? [];
          const rest = restMap.get(iso);
          const hours = dayActs.reduce((s, a) => s + activityWorkHours(a), 0);

          return (
            <button
              key={i}
              onClick={() => onSelectDay(date)}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-r p-2 text-left transition hover:bg-accent/40",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                {hours > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {hours.toFixed(1)}h
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {rest?.status === "validated" && (
                  <span className="rounded-sm bg-chart-2/20 px-1.5 py-0.5 text-[10px] font-medium">
                    Repos
                  </span>
                )}
                {rest?.status === "suggested" && (
                  <span className="rounded-sm border border-dashed px-1.5 py-0.5 text-[10px]">
                    Suggéré
                  </span>
                )}
                {dayActs.slice(0, 2).map((a) => (
                  <span
                    key={a.id}
                    className="truncate rounded-sm bg-chart-1/15 px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    {a.title || a.activity_type}
                  </span>
                ))}
                {dayActs.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayActs.length - 2}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
