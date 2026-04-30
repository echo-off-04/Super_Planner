import { useMemo } from "react";
import type { Activity, ContractSettings, RestDay } from "@/lib/planning";
import {
  DAY_SHORT,
  addDays,
  dayRestGap,
  formatDateISO,
  formatHours,
  formatTime,
  groupActivitiesByDay,
  dailyRecuperationHours,
  dailyUsedHours,
  dailyWorkHours,
} from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Coffee, Truck, GraduationCap, Briefcase, MoveHorizontal as MoreHorizontal, TriangleAlert, Star, TreePalm as Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  weekStart: Date;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  holidays?: Map<string, string>;
  vacations?: Map<string, string>;
  onAddActivity: (date: Date) => void;
  onEditActivity: (activity: Activity) => void;
  onToggleRest: (date: Date) => void;
}

const WORK_CLS =
  "bg-blue-500/15 text-foreground border-blue-500/40 dark:bg-blue-400/15 dark:border-blue-400/40";
const PAUSE_CLS =
  "bg-green-500/15 text-foreground border-green-500/40 dark:bg-green-400/15 dark:border-green-400/40";

const typeMeta: Record<
  string,
  { label: string; icon: typeof Briefcase; cls: string }
> = {
  prestation: { label: "Prestation", icon: Briefcase, cls: WORK_CLS },
  deplacement: { label: "Déplacement", icon: Truck, cls: WORK_CLS },
  formation: { label: "Formation", icon: GraduationCap, cls: WORK_CLS },
  pause: { label: "Pause", icon: Coffee, cls: PAUSE_CLS },
  autre: { label: "Autre", icon: MoreHorizontal, cls: WORK_CLS },
};

function metaFor(type: string) {
  if (type === "pause") return typeMeta.pause;
  if (type === "recuperation")
    return { label: "Récupération", icon: Coffee, cls: PAUSE_CLS };
  return typeMeta[type] ?? { ...typeMeta.autre, label: type };
}

export function WeekView({
  weekStart,
  activities,
  restDays,
  contract,
  holidays,
  vacations,
  onAddActivity,
  onEditActivity,
  onToggleRest,
}: Props) {
  const grouped = useMemo(
    () => groupActivitiesByDay(activities, weekStart),
    [activities, weekStart]
  );

  const previousDayActivities = useMemo(() => {
    const prev = addDays(weekStart, -1);
    return activities.filter((a) => {
      const d = new Date(a.start_time);
      return (
        d.getFullYear() === prev.getFullYear() &&
        d.getMonth() === prev.getMonth() &&
        d.getDate() === prev.getDate()
      );
    });
  }, [activities, weekStart]);

  const maxDaily = contract?.daily_max_hours ?? 10;
  const minRest = contract?.min_rest_hours ?? 11;
  const restMap = useMemo(() => {
    const m = new Map<string, RestDay>();
    for (const r of restDays) m.set(r.rest_date, r);
    return m;
  }, [restDays]);

  const today = new Date();

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(weekStart, i);
        const iso = formatDateISO(date);
        const dayActivities = grouped[i];
        const rest = restMap.get(iso);
        const isToday =
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear();
        const dayHours = dailyWorkHours(dayActivities);
        const recupHours = dailyRecuperationHours(dayActivities);
        const usedHours = dailyUsedHours(dayActivities);

        const overload = usedHours > maxDaily;
        const prevDay = i === 0 ? previousDayActivities : grouped[i - 1];
        const gap = dayRestGap(prevDay, dayActivities);
        const insufficientRest = gap !== null && gap < minRest;
        const holidayName = holidays?.get(iso);
        const vacationLabel = vacations?.get(iso);
        const isSick = rest?.kind === "sick";

        return (
          <div
            key={iso}
            className={cn(
              "flex flex-col rounded-lg border bg-card",
              overload && "border-destructive/60",
              holidayName && "border-amber-500/50 bg-amber-500/5",
              vacationLabel && "border-teal-500/50 bg-teal-500/5",
              isSick && "border-rose-500/50 bg-rose-500/5",
              isToday && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          >
            <div className="flex flex-col gap-1.5 border-b px-2.5 py-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {DAY_SHORT[i]}
                </span>
                <span className="text-base font-semibold leading-tight">
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {(dayHours > 0 || recupHours > 0) && (
                  <Badge
                    variant={overload ? "destructive" : "secondary"}
                    className="px-1.5 text-[10px]"
                  >
                    {formatHours(dayHours)}
                    {recupHours > 0 && ` + ${formatHours(recupHours)}`}
                  </Badge>
                )}
                {insufficientRest && (
                  <Badge
                    variant="destructive"
                    className="gap-1 px-1.5 text-[10px]"
                    title={`Repos: ${formatHours(gap ?? 0)} (min ${formatHours(minRest)})`}
                  >
                    <TriangleAlert className="h-3 w-3" />
                    Repos
                  </Badge>
                )}
                {rest && rest.status !== "rejected" && (
                  <Badge
                    variant={
                      rest.status === "validated" ? "default" : "outline"
                    }
                    className={cn(
                      "px-1.5 text-[10px]",
                      isSick &&
                      "border-rose-500/60 bg-rose-500/15 text-rose-900 dark:text-rose-200"
                    )}
                  >
                    {rest.status === "validated"
                      ? (isSick ? "Maladie" : "Repos") +
                      (rest.rest_period === "morning"
                        ? " matin"
                        : rest.rest_period === "afternoon"
                          ? " ap.-m."
                          : "")
                      : "Suggéré"}
                  </Badge>
                )}
                {holidayName && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-500/60 bg-amber-500/10 px-1.5 text-[10px] text-amber-900 dark:text-amber-200"
                    title={holidayName}
                  >
                    <Star className="h-3 w-3" />
                    Férié
                  </Badge>
                )}
                {vacationLabel && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-teal-500/60 bg-teal-500/10 px-1.5 text-[10px] text-teal-900 dark:text-teal-200"
                    title={vacationLabel}
                  >
                    <Palmtree className="h-3 w-3" />
                    Vacances
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 p-2 min-h-32">
              {dayActivities.length === 0 && !rest && (
                <div className="flex flex-1 items-center justify-center py-4">
                  <span className="text-xs text-muted-foreground">
                    Aucune activité
                  </span>
                </div>
              )}

              {dayActivities.map((a) => {
                const meta = metaFor(a.activity_type);
                const Icon = meta.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => onEditActivity(a)}
                    className={cn(
                      "group flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs transition hover:shadow-sm",
                      meta.cls
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{a.title || meta.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] opacity-80">
                      <span>
                        {formatTime(new Date(a.start_time))} –{" "}
                        {formatTime(new Date(a.end_time))}
                      </span>
                    </div>
                    {a.location && (
                      <div className="flex items-center gap-1 text-[11px] opacity-70">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{a.location}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1 border-t p-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-center px-2 text-xs"
                onClick={() => onAddActivity(date)}
              >
                <Plus className="mr-1 h-3 w-3" />
                <span className="truncate">Activité</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-center px-2 text-xs"
                onClick={() => onToggleRest(date)}
                disabled={isSick}
              >
                <span className="truncate">
                  {isSick
                    ? "Maladie (paramètres)"
                    : rest?.status === "validated"
                      ? "Retirer repos"
                      : "Marquer repos"}
                </span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
