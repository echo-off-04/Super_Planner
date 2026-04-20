import type { Activity, ContractSettings } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatHours, weekTotalHours } from "@/lib/time";
import { Clock, TrendingUp, Moon, CalendarCheck } from "lucide-react";

interface Props {
  activities: Activity[];
  contract: ContractSettings | null;
  restDaysCount: number;
  view: "day" | "week" | "month";
}

function weeksInMonth(reference: Date): number {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDay = (first.getDay() + 6) % 7;
  return Math.ceil((last.getDate() + firstDay) / 7);
}

export function StatsCards({
  activities,
  contract,
  restDaysCount,
  view,
}: Props) {
  const total = weekTotalHours(activities);
  const weeklyTarget = contract?.weekly_hours ?? 35;
  const dailyTarget = contract?.daily_max_hours ?? 10;

  let hoursLabel = "Heures cette semaine";
  let target = weeklyTarget;
  let overtime = Math.max(0, total - weeklyTarget);
  let activitiesHint = "Sur la semaine";
  let restHint = "Cette semaine";

  if (view === "day") {
    hoursLabel = "Heures ce jour";
    target = dailyTarget;
    overtime = Math.max(0, total - dailyTarget);
    activitiesHint = "Ce jour";
    restHint = "Cette semaine";
  } else if (view === "month") {
    const reference = activities[0]
      ? new Date(activities[0].start_time)
      : new Date();
    const weeks = weeksInMonth(reference);
    hoursLabel = "Heures ce mois";
    target = weeklyTarget * weeks;
    overtime = Math.max(0, total - target);
    activitiesHint = "Sur le mois";
    restHint = "Ce mois";
  }

  const pct =
    target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;

  const cards = [
    {
      icon: Clock,
      label: hoursLabel,
      value: formatHours(total),
      hint: `Objectif ${formatHours(target)}`,
      progress: pct,
    },
    {
      icon: TrendingUp,
      label: "Heures supplémentaires",
      value: formatHours(overtime),
      hint:
        overtime > 0
          ? `Taux +${Math.round(((contract?.overtime_rate ?? 1.25) - 1) * 100)}%`
          : "Aucune",
    },
    {
      icon: Moon,
      label: "Jours de repos",
      value: String(restDaysCount),
      hint: restHint,
    },
    {
      icon: CalendarCheck,
      label: "Activités planifiées",
      value: String(activities.length),
      hint: activitiesHint,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold tracking-tight">
                {c.value}
              </div>
              {typeof c.progress === "number" ? (
                <div className="space-y-1">
                  <Progress value={c.progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{c.hint}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{c.hint}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
