import { useMemo } from "react";
import type { Activity, ContractSettings, RestDay } from "@/lib/planning";
import {
  DAY_SHORT,
  MONTH_LABELS,
  addDays,
  dailyUsedHours,
  dayRestGap,
  formatDateISO,
  startOfWeek,
  dailyWorkHours,
} from "@/lib/time";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  month: Date;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  holidays?: Map<string, string>;
  vacations?: Map<string, string>;
  onSelectDay: (date: Date) => void;
}

export function MonthView({
  month,
  activities,
  restDays,
  contract,
  holidays,
  vacations,
  onSelectDay,
}: Props) {
  const maxDaily = contract?.daily_max_hours ?? 10;
  const minRest = contract?.min_rest_hours ?? 11;
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
          const hours = dailyWorkHours(dayActs);
          const used = dailyUsedHours(dayActs);
          const overload = used > maxDaily;
          const prevDayActs =
            activityMap.get(formatDateISO(addDays(date, -1))) ?? [];
          const gap = dayRestGap(prevDayActs, dayActs);
          const insufficientRest = gap !== null && gap < minRest;
          const hasIssue = overload || insufficientRest;
          const holidayName = holidays?.get(iso);
          const vacationLabel = vacations?.get(iso);
          const isSick = rest?.kind === "sick";

          return (
            <button
              key={i}
              onClick={() => onSelectDay(date)}
              className={cn(
                "relative flex min-h-24 flex-col gap-1 border-b border-r p-2 text-left transition hover:bg-accent/40",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground",
                (i + 1) % 7 === 0 && "border-r-0",
                holidayName &&
                !hasIssue &&
                !vacationLabel &&
                "bg-amber-500/5 hover:bg-amber-500/10",
                vacationLabel &&
                !hasIssue &&
                "bg-teal-500/15 hover:bg-teal-500/25 dark:bg-teal-400/10 dark:hover:bg-teal-400/20",
                isSick &&
                !hasIssue &&
                !vacationLabel &&
                "bg-rose-500/15 hover:bg-rose-500/25 dark:bg-rose-400/10 dark:hover:bg-rose-400/20",
                hasIssue &&
                "border-destructive/60 bg-destructive/5 hover:bg-destructive/10"
              )}
              title={
                [
                  holidayName ? `Jour férié: ${holidayName}` : null,
                  vacationLabel ? `Vacances: ${vacationLabel}` : null,
                  isSick
                    ? `Repos maladie${rest?.reason && rest.reason !== "Repos maladie" ? `: ${rest.reason}` : ""}`
                    : null,
                  overload ? `Surcharge: ${used.toFixed(2)} h / ${maxDaily} h` : null,
                  insufficientRest
                    ? `Repos insuffisant: ${(gap ?? 0).toFixed(2)} h (min ${minRest} h)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
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
                <div className="flex items-center gap-1">
                  {hasIssue && (
                    <TriangleAlert className="h-3 w-3 text-destructive" />
                  )}
                  {overload ? (
                    <span className="text-[10px] font-semibold text-destructive">
                      {used.toFixed(1)}h / {maxDaily}h
                    </span>
                  ) : (
                    hours > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {hours.toFixed(1)}h
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {holidayName && (
                  <span className="truncate rounded-sm border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
                    {holidayName}
                  </span>
                )}
                {vacationLabel && (
                  <span className="truncate rounded-sm border border-teal-500/40 bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-900 dark:text-teal-200">
                    {vacationLabel || "Vacances"}
                  </span>
                )}
                {rest?.status === "validated" && (
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                      isSick
                        ? "border border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-200"
                        : "bg-chart-2/20"
                    )}
                  >
                    {(isSick ? "Maladie" : "Repos") +
                      (rest.rest_period === "morning"
                        ? " matin"
                        : rest.rest_period === "afternoon"
                          ? " ap.-m."
                          : "")}
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
                    className={cn(
                      "truncate rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
                      a.activity_type === "pause" ||
                        a.activity_type === "recuperation"
                        ? "bg-green-500/20 dark:bg-green-400/20"
                        : "bg-blue-500/20 dark:bg-blue-400/20"
                    )}
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
