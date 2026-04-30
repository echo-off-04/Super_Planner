import { useMemo } from "react";
import type { Activity, ContractSettings, RestDay } from "@/lib/supabase";
import {
  MONTH_LABELS,
  addDays,
  dailyUsedHours,
  dayRestGap,
  formatDateISO,
  dailyWorkHours,
} from "@/lib/time";
import { CalendarRange, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

interface Props {
  range: { start: Date; end: Date };
  onChangeRange: (range: { start: Date; end: Date }) => void;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  holidays?: Map<string, string>;
  vacations?: Map<string, string>;
  onSelectDay: (date: Date) => void;
}

export function CustomView({
  range,
  onChangeRange,
  activities,
  restDays,
  contract,
  holidays,
  vacations,
  onSelectDay,
}: Props) {
  const maxDaily = contract?.daily_max_hours ?? 8;
  const minRest = contract?.min_rest_hours ?? 11;

  const days = useMemo(() => {
    const list: Date[] = [];
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);
    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      list.push(new Date(d));
    }
    return list;
  }, [range.start, range.end]);

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
  const todayIso = formatDateISO(today);

  const selected: DateRange = { from: range.start, to: range.end };

  const handleSelect = (next: DateRange | undefined) => {
    if (next?.from && next?.to) {
      onChangeRange({ start: next.from, end: next.to });
    } else if (next?.from && !next?.to) {
      onChangeRange({ start: next.from, end: next.from });
    }
  };

  const formatLabel = (d: Date) =>
    `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;

  const lengthDays = days.length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold">Plage personnalisée</h3>
          <p className="text-xs text-muted-foreground">
            {formatLabel(range.start)} – {formatLabel(range.end)} ·{" "}
            {lengthDays} jour{lengthDays > 1 ? "s" : ""}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarRange className="h-4 w-4" />
              Choisir la plage
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={range.start}
              selected={selected}
              onSelect={handleSelect}
              weekStartsOn={1}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((date) => {
          const iso = formatDateISO(date);
          const isToday = iso === todayIso;
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
              key={iso}
              onClick={() => onSelectDay(date)}
              className={cn(
                "flex min-h-28 flex-col gap-2 border-b border-r p-3 text-left transition hover:bg-accent/40",
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
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium capitalize">
                      {date.toLocaleDateString("fr-FR", { weekday: "short" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {MONTH_LABELS[date.getMonth()].slice(0, 4)}.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {hasIssue && (
                    <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {overload ? (
                    <span className="text-[11px] font-semibold text-destructive">
                      {used.toFixed(1)}h / {maxDaily}h
                    </span>
                  ) : (
                    hours > 0 && (
                      <span className="text-[11px] text-muted-foreground">
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
                    {vacationLabel}
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
                {dayActs.slice(0, 3).map((a) => (
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
                {dayActs.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayActs.length - 3}
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
