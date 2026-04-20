import { useMemo } from "react";
import type { Activity, ContractSettings, RestDay } from "@/lib/supabase";
import {
  activityWorkHours,
  formatDayLong,
  formatHours,
  formatTime,
  sameDay,
} from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  MapPin,
  Coffee,
  Truck,
  GraduationCap,
  Briefcase,
  MoveHorizontal as MoreHorizontal,
  TriangleAlert,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  previousDayActivities: Activity[];
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

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({
  date,
  activities,
  restDays,
  contract,
  previousDayActivities,
  onAddActivity,
  onEditActivity,
  onToggleRest,
}: Props) {
  const dayActivities = useMemo(
    () =>
      activities
        .filter((a) => sameDay(new Date(a.start_time), date))
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() -
            new Date(b.start_time).getTime()
        ),
    [activities, date]
  );

  const rest = useMemo(
    () =>
      restDays.find((r) => {
        const d = new Date(r.rest_date + "T00:00:00");
        return sameDay(d, date);
      }),
    [restDays, date]
  );

  const dayHours = dayActivities.reduce(
    (s, a) => s + activityWorkHours(a),
    0
  );

  const maxDaily = contract?.daily_max_hours ?? 10;
  const minRest = contract?.min_rest_hours ?? 11;
  const overload = dayHours > maxDaily;

  const restGap = useMemo(() => {
    if (previousDayActivities.length === 0 || dayActivities.length === 0)
      return null;
    const lastEnd = Math.max(
      ...previousDayActivities.map((a) => new Date(a.end_time).getTime())
    );
    const firstStart = Math.min(
      ...dayActivities.map((a) => new Date(a.start_time).getTime())
    );
    return Math.max(0, (firstStart - lastEnd) / (1000 * 60 * 60));
  }, [previousDayActivities, dayActivities]);

  const insufficientRest = restGap !== null && restGap < minRest;

  const today = new Date();
  const isToday = sameDay(date, today);

  function getPosition(a: Activity) {
    const s = new Date(a.start_time);
    const e = new Date(a.end_time);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    const top = (startMin / (24 * 60)) * 100;
    const height = Math.max(2, ((endMin - startMin) / (24 * 60)) * 100);
    return { top: `${top}%`, height: `${height}%` };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {isToday ? "Aujourd'hui" : "Détail du jour"}
          </span>
          <span className="text-xl font-semibold capitalize">
            {formatDayLong(date)}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={overload ? "destructive" : "secondary"}>
              {formatHours(dayHours)} travaillées
            </Badge>
            <Badge variant="outline">
              Max contrat : {formatHours(maxDaily)}
            </Badge>
            {rest && rest.status !== "rejected" && (
              <Badge
                variant={rest.status === "validated" ? "default" : "outline"}
              >
                <Moon className="mr-1 h-3 w-3" />
                {rest.status === "validated" ? "Repos" : "Suggéré"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleRest(date)}
          >
            {rest?.status === "validated" ? "Retirer repos" : "Marquer repos"}
          </Button>
          <Button size="sm" onClick={() => onAddActivity(date)}>
            <Plus className="mr-1 h-4 w-4" /> Activité
          </Button>
        </div>
      </div>

      {(overload || insufficientRest) && (
        <div className="flex flex-col gap-2">
          {overload && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Surcharge horaire</AlertTitle>
              <AlertDescription>
                {formatHours(dayHours)} dépassent la durée maximale
                quotidienne ({formatHours(maxDaily)}).
              </AlertDescription>
            </Alert>
          )}
          {insufficientRest && restGap !== null && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Repos insuffisant</AlertTitle>
              <AlertDescription>
                Seulement {formatHours(restGap)} entre la dernière activité de
                la veille et la première d'aujourd'hui (minimum requis :{" "}
                {formatHours(minRest)}).
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="relative">
          <div
            className="relative"
            style={{ height: "720px" }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start border-t border-border/60"
                style={{ top: `${(h / 24) * 100}%` }}
              >
                <span className="w-14 shrink-0 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            <div className="absolute inset-y-0 left-14 right-2">
              {dayActivities.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="text-sm text-muted-foreground">
                      Aucune activité ce jour
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddActivity(date)}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Ajouter une activité
                    </Button>
                  </div>
                </div>
              )}

              {dayActivities.map((a) => {
                const meta = typeMeta[a.activity_type] || typeMeta.autre;
                const Icon = meta.icon;
                const pos = getPosition(a);
                const durationHours =
                  (new Date(a.end_time).getTime() -
                    new Date(a.start_time).getTime()) /
                  (1000 * 60 * 60);
                const isCompact = durationHours < 1.5;
                const timeLabel = `${formatTime(new Date(a.start_time))} – ${formatTime(new Date(a.end_time))}`;
                return (
                  <button
                    key={a.id}
                    onClick={() => onEditActivity(a)}
                    className={cn(
                      "absolute left-0 right-0 overflow-hidden rounded-md border text-left text-xs shadow-sm transition hover:shadow-md",
                      isCompact
                        ? "flex items-center gap-2 px-2 py-1"
                        : "flex flex-col gap-0.5 px-2 py-1.5",
                      meta.cls
                    )}
                    style={pos}
                  >
                    {isCompact ? (
                      <>
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate font-medium">
                          {a.title || meta.label}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] opacity-80">
                          {timeLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {a.title || meta.label}
                          </span>
                        </div>
                        <div className="text-[11px] opacity-80">
                          {timeLabel}
                        </div>
                        {a.location && (
                          <div className="flex items-center gap-1 text-[11px] opacity-70">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{a.location}</span>
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
