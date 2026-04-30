import type { Activity, ContractSettings } from "@/lib/supabase";
import type { SpecialDayCredit } from "@/lib/holidays";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatHours, weekTotalHours } from "@/lib/time";
import { Clock, TrendingUp, Moon, CalendarCheck } from "lucide-react";

interface Props {
  activities: Activity[];
  contract: ContractSettings | null;
  restDaysCount: number;
  view: "day" | "week" | "month" | "custom";
  specialCredit?: SpecialDayCredit;
  customRange?: { start: Date; end: Date };
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
  specialCredit,
  customRange,
}: Props) {
  const worked = weekTotalHours(activities);
  const weeklyTarget = contract?.weekly_hours ?? 35;
  const dailyTarget = contract?.daily_max_hours ?? 8;

  let hoursLabel = "Heures cette semaine";
  let target = weeklyTarget;
  let activitiesHint = "Sur la semaine";
  let restHint = "Cette semaine";

  if (view === "day") {
    hoursLabel = "Heures ce jour";
    target = dailyTarget;
    activitiesHint = "Ce jour";
    restHint = "Cette semaine";
  } else if (view === "month") {
    const reference = activities[0]
      ? new Date(activities[0].start_time)
      : new Date();
    const weeks = weeksInMonth(reference);
    hoursLabel = "Heures ce mois";
    target = weeklyTarget * weeks;
    activitiesHint = "Sur le mois";
    restHint = "Ce mois";
  } else if (view === "custom" && customRange) {
    const startMs = new Date(
      customRange.start.getFullYear(),
      customRange.start.getMonth(),
      customRange.start.getDate()
    ).getTime();
    const endMs = new Date(
      customRange.end.getFullYear(),
      customRange.end.getMonth(),
      customRange.end.getDate()
    ).getTime();
    const days = Math.max(
      1,
      Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1
    );
    hoursLabel = "Heures sur la plage";
    target = (weeklyTarget * days) / 7;
    activitiesHint = `Sur ${days} jour${days > 1 ? "s" : ""}`;
    restHint = `Sur ${days} jour${days > 1 ? "s" : ""}`;
  }

  const creditTotal = specialCredit
    ? specialCredit.holiday.hours +
      specialCredit.vacation.hours +
      specialCredit.sick.hours
    : 0;
  const adjustedTarget = Math.max(0, target - creditTotal);
  const overtime = Math.max(0, worked - adjustedTarget);
  const pct =
    adjustedTarget > 0
      ? Math.min(100, Math.round((worked / adjustedTarget) * 100))
      : worked > 0
        ? 100
        : 0;

  const deductions: string[] = [];
  if (specialCredit) {
    if (specialCredit.holiday.hours > 0) {
      deductions.push(
        `${formatHours(specialCredit.holiday.hours)} férié${specialCredit.holiday.count > 1 ? "s" : ""}`
      );
    }
    if (specialCredit.vacation.hours > 0) {
      deductions.push(`${formatHours(specialCredit.vacation.hours)} vacances`);
    }
    if (specialCredit.sick.hours > 0) {
      deductions.push(`${formatHours(specialCredit.sick.hours)} maladie`);
    }
  }
  const hoursHint =
    deductions.length > 0
      ? `Objectif ${formatHours(adjustedTarget)} (${formatHours(target)} moins ${deductions.join(" · ")})`
      : `Objectif ${formatHours(target)}`;

  const cards = [
    {
      icon: Clock,
      label: hoursLabel,
      value: formatHours(worked),
      hint: hoursHint,
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
