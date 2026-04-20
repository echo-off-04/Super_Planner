import { useMemo } from "react";
import type { Activity, ContractSettings, RestDay } from "@/lib/supabase";
import {
  DAY_SHORT,
  addDays,
  dayRestGap,
  formatDateISO,
  formatHours,
  formatTime,
  groupActivitiesByDay,
  activityWorkHours,
} from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MapPin,
  Coffee,
  Truck,
  GraduationCap,
  Briefcase,
  MoveHorizontal as MoreHorizontal,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  weekStart: Date;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  onAddActivity: (date: Date) => void;
  onEditActivity: (activity: Activity) => void;
  onToggleRest: (date: Date) => void;
}

const typeMeta: Record<
  string,
  { label: string; icon: typeof Briefcase; cls: string }
> = {
  prestation: {
    label: "Prestation",
    icon: Briefcase,
    cls: "bg-chart-1/15 text-foreground border-chart-1/30",
  },
  deplacement: {
    label: "Déplacement",
    icon: Truck,
    cls: "bg-chart-2/15 text-foreground border-chart-2/30",
  },
  formation: {
    label: "Formation",
    icon: GraduationCap,
    cls: "bg-chart-4/15 text-foreground border-chart-4/30",
  },
  pause: {
    label: "Pause",
    icon: Coffee,
    cls: "bg-muted text-muted-foreground border-border",
  },
  autre: {
    label: "Autre",
    icon: MoreHorizontal,
    cls: "bg-chart-5/15 text-foreground border-chart-5/30",
  },
};

export function WeekView({
  weekStart,
  activities,
  restDays,
  contract,
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
        const dayHours = dayActivities.reduce(
          (s, a) => s + activityWorkHours(a),
          0
        );

        const overload = dayHours > maxDaily;
        const prevDay = i === 0 ? previousDayActivities : grouped[i - 1];
        const gap = dayRestGap(prevDay, dayActivities);
        const insufficientRest = gap !== null && gap < minRest;

        return (
          <div
            key={iso}
            className={cn(
              "flex flex-col rounded-lg border bg-card",
              overload && "border-destructive/60",
              isToday && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          >
            <div className="flex items-start justify-between gap-2 border-b px-2.5 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {DAY_SHORT[i]}
                </span>
                <span className="text-base font-semibold leading-tight">
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                {dayHours > 0 && (
                  <Badge
                    variant={overload ? "destructive" : "secondary"}
                    className="px-1.5 text-[10px]"
                  >
                    {formatHours(dayHours)}
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
                    className="px-1.5 text-[10px]"
                  >
                    {rest.status === "validated" ? "Repos" : "Suggéré"}
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
                const meta = typeMeta[a.activity_type] || typeMeta.autre;
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
              >
                <span className="truncate">
                  {rest?.status === "validated" ? "Retirer repos" : "Marquer repos"}
                </span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
