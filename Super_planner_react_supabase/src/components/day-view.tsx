import { useMemo } from "react";
import type {
  Activity,
  ContractSettings,
  DefaultWeekSettings,
  RestDay,
} from "@/lib/supabase";
import { parseHM } from "@/lib/supabase";
import {
  dailyRecuperationHours,
  dailyUsedHours,
  dailyWorkHours,
  formatDayLong,
  formatHours,
  formatTime,
  sameDay,
} from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, MapPin, Coffee, Truck, GraduationCap, Briefcase, MoveHorizontal as MoreHorizontal, TriangleAlert, Moon, Star, TreePalm as Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  date: Date;
  activities: Activity[];
  restDays: RestDay[];
  contract: ContractSettings | null;
  defaultWeek: DefaultWeekSettings | null;
  previousDayActivities: Activity[];
  holidayName?: string | null;
  vacationLabel?: string | null;
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

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView({
  date,
  activities,
  restDays,
  contract,
  defaultWeek,
  previousDayActivities,
  holidayName,
  vacationLabel,
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

  const dayHours = dailyWorkHours(dayActivities);
  const recupHours = dailyRecuperationHours(dayActivities);
  const usedHours = dailyUsedHours(dayActivities);

  const maxDaily = contract?.daily_max_hours ?? 8;
  const minRest = contract?.min_rest_hours ?? 11;
  const overload = usedHours > maxDaily;

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

  function positionFor(startMin: number, endMin: number) {
    const top = (startMin / (24 * 60)) * 100;
    const height = Math.max(0.5, ((endMin - startMin) / (24 * 60)) * 100);
    return { top: `${top}%`, height: `${height}%` };
  }

  const delimiters = useMemo(() => {
    if (!defaultWeek) return [];
    return [
      {
        key: "morning-start",
        min: parseHM(defaultWeek.morning_start),
        leftLabel: "Début matinée",
      },
      {
        key: "afternoon-start",
        min: parseHM(defaultWeek.afternoon_start),
        leftLabel: "Début après-midi",
      },
      {
        key: "afternoon-end",
        min: parseHM(defaultWeek.afternoon_end),
        leftLabel: "Fin après-midi",
      },
    ];
  }, [defaultWeek]);

  const afternoonEndMin = defaultWeek
    ? parseHM(defaultWeek.afternoon_end)
    : null;

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
              {recupHours > 0 && ` + ${formatHours(recupHours)} récup.`}
            </Badge>
            <Badge variant="outline">
              Max contrat : {formatHours(maxDaily)}
            </Badge>
            {rest && rest.status !== "rejected" && (
              <Badge
                variant={rest.status === "validated" ? "default" : "outline"}
                className={
                  rest.kind === "sick"
                    ? "border-rose-500/60 bg-rose-500/15 text-rose-900 dark:text-rose-200"
                    : undefined
                }
              >
                <Moon className="mr-1 h-3 w-3" />
                {rest.status === "validated"
                  ? (rest.kind === "sick" ? "Maladie" : "Repos") +
                    (rest.rest_period === "morning"
                      ? " matin"
                      : rest.rest_period === "afternoon"
                        ? " après-midi"
                        : "")
                  : "Suggéré"}
              </Badge>
            )}
            {holidayName && (
              <Badge
                variant="outline"
                className="border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              >
                <Star className="mr-1 h-3 w-3" />
                Férié · {holidayName}
              </Badge>
            )}
            {vacationLabel !== undefined && vacationLabel !== null && (
              <Badge
                variant="outline"
                className="border-teal-500/60 bg-teal-500/10 text-teal-900 dark:text-teal-200"
              >
                <Palmtree className="mr-1 h-3 w-3" />
                Vacances{vacationLabel ? ` · ${vacationLabel}` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleRest(date)}
            disabled={rest?.kind === "sick"}
          >
            {rest?.kind === "sick"
              ? "Maladie (paramètres)"
              : rest?.status === "validated"
                ? rest.rest_period === "morning"
                  ? "Retirer repos matin"
                  : rest.rest_period === "afternoon"
                    ? "Retirer repos après-midi"
                    : "Retirer repos"
                : "Marquer repos"}
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
                {formatHours(usedHours)} (travail + récupération) dépassent la
                durée maximale quotidienne ({formatHours(maxDaily)}).
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

      <div className="flex items-stretch gap-2" style={{ height: "720px" }}>
        <div className="relative w-24 shrink-0">
          {delimiters.map((d) => (
            <div
              key={d.key}
              className="absolute right-0 flex -translate-y-1/2 items-center gap-1"
              style={{ top: `${(d.min / (24 * 60)) * 100}%` }}
            >
              <span className="whitespace-nowrap rounded-sm border border-primary/40 bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {d.leftLabel}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden rounded-lg border bg-card">
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

          {delimiters.map((d) => (
            <div
              key={d.key}
              className="pointer-events-none absolute left-0 right-0 border-t-2 border-primary"
              style={{ top: `${(d.min / (24 * 60)) * 100}%` }}
            />
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

            {dayActivities.flatMap((a) => {
              const meta = metaFor(a.activity_type);
              const Icon = meta.icon;
              const s = new Date(a.start_time);
              const e = new Date(a.end_time);
              const crossesMidnight = !sameDay(s, e);
              const aStart = s.getHours() * 60 + s.getMinutes();
              const aEnd = crossesMidnight
                ? 24 * 60
                : e.getHours() * 60 + e.getMinutes();
              const timeLabel = crossesMidnight
                ? `${formatTime(s)} – ${formatTime(e)} (J+1)`
                : `${formatTime(s)} – ${formatTime(e)}`;

              const cuts: number[] = [aStart, aEnd];
              if (
                afternoonEndMin !== null &&
                aStart < afternoonEndMin &&
                aEnd > afternoonEndMin
              ) {
                cuts.splice(1, 0, afternoonEndMin);
              }

              return cuts.slice(0, -1).map((segStart, idx) => {
                const segEnd = cuts[idx + 1];
                const isOvertimeSegment =
                  afternoonEndMin !== null && segStart >= afternoonEndMin;
                const isFirstSegment = idx === 0;
                const pos = positionFor(segStart, segEnd);
                const durationHours = (segEnd - segStart) / 60;
                const isCompact = durationHours < 1.5;
                return (
                  <button
                    key={`${a.id}-${idx}`}
                    onClick={() => onEditActivity(a)}
                    className={cn(
                      "absolute left-0 right-0 overflow-hidden rounded-md border text-left text-xs shadow-sm transition hover:shadow-md",
                      isCompact
                        ? "flex items-center gap-2 px-2 py-1"
                        : "flex flex-col gap-0.5 px-2 py-1.5",
                      meta.cls,
                      isOvertimeSegment &&
                        "border-dashed border-destructive/60 bg-destructive/10"
                    )}
                    style={pos}
                  >
                    {isCompact ? (
                      <>
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate font-medium">
                          {a.title || meta.label}
                          {isOvertimeSegment && " · extra"}
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
                            {isOvertimeSegment && " · extra"}
                          </span>
                        </div>
                        <div className="text-[11px] opacity-80">
                          {isFirstSegment ? timeLabel : `Suite · ${timeLabel}`}
                        </div>
                        {isFirstSegment && a.location && (
                          <div className="flex items-center gap-1 text-[11px] opacity-70">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{a.location}</span>
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              });
            })}
          </div>
        </div>

        <div className="relative w-20 shrink-0">
          {delimiters.map((d) => {
            const h = Math.floor(d.min / 60);
            const m = d.min % 60;
            const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            return (
              <div
                key={d.key}
                className="absolute left-0 flex -translate-y-1/2 items-center"
                style={{ top: `${(d.min / (24 * 60)) * 100}%` }}
              >
                <span className="whitespace-nowrap rounded-sm border border-primary/40 bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
