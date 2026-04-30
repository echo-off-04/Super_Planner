import type { Activity } from "./supabase";

export const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export const DAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLong(date: Date): string {
  return `${DAY_LABELS[(date.getDay() + 6) % 7]} ${date.getDate()} ${
    MONTH_LABELS[date.getMonth()]
  }`;
}

export function hoursBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(0, (e - s) / (1000 * 60 * 60));
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function activityWorkHours(a: Activity): number {
  if (a.activity_type === "pause") return 0;
  if (a.activity_type === "recuperation") return 0;
  const raw = hoursBetween(a.start_time, a.end_time);
  const breakHours = (a.break_minutes ?? 0) / 60;
  return Math.max(0, raw - breakHours);
}

export function groupActivitiesByDay(
  activities: Activity[],
  weekStart: Date
): Activity[][] {
  const days: Activity[][] = Array.from({ length: 7 }, () => []);
  for (const a of activities) {
    const d = new Date(a.start_time);
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      if (sameDay(d, day)) {
        days[i].push(a);
        break;
      }
    }
  }
  for (const list of days) {
    list.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }
  return days;
}

function mergeIntervals(
  intervals: { start: number; end: number }[]
): { start: number; end: number }[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function dailyWorkHours(dayActivities: Activity[]): number {
  if (dayActivities.length === 0) return 0;
  const workLike = dayActivities.filter(
    (a) => a.activity_type !== "pause" && a.activity_type !== "recuperation"
  );
  if (workLike.length === 0) return 0;
  const presenceIntervals = dayActivities
    .filter((a) => a.activity_type !== "recuperation")
    .map((a) => ({
      start: new Date(a.start_time).getTime(),
      end: new Date(a.end_time).getTime(),
    }));
  const merged = mergeIntervals(presenceIntervals);
  const rawMs = merged.reduce((s, i) => s + (i.end - i.start), 0);
  return Math.max(0, rawMs / (1000 * 60 * 60));
}

export function dailyEffectiveWorkHours(dayActivities: Activity[]): number {
  if (dayActivities.length === 0) return 0;
  const workLike = dayActivities.filter(
    (a) => a.activity_type !== "pause" && a.activity_type !== "recuperation"
  );
  if (workLike.length === 0) return 0;
  const merged = mergeIntervals(
    workLike.map((a) => ({
      start: new Date(a.start_time).getTime(),
      end: new Date(a.end_time).getTime(),
    }))
  );
  const rawMs = merged.reduce((s, i) => s + (i.end - i.start), 0);
  const breakMinutes = workLike.reduce(
    (s, a) => s + (a.break_minutes ?? 0),
    0
  );
  return Math.max(0, rawMs / (1000 * 60 * 60) - breakMinutes / 60);
}

export function dailyRecuperationHours(dayActivities: Activity[]): number {
  const ms = dayActivities
    .filter((a) => a.activity_type === "recuperation")
    .reduce(
      (s, a) =>
        s +
        (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()),
      0
    );
  return ms / (1000 * 60 * 60);
}

export function dailyUsedHours(dayActivities: Activity[]): number {
  return dailyWorkHours(dayActivities) + dailyRecuperationHours(dayActivities);
}

export function totalWorkHours(activities: Activity[]): number {
  const byDay = new Map<string, Activity[]>();
  for (const a of activities) {
    const key = formatDateISO(new Date(a.start_time));
    const list = byDay.get(key) ?? [];
    list.push(a);
    byDay.set(key, list);
  }
  let total = 0;
  for (const list of byDay.values()) total += dailyEffectiveWorkHours(list);
  return total;
}

export function weekTotalHours(activities: Activity[]): number {
  return totalWorkHours(activities);
}

export function formatHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

export function dayRestGap(
  previousDay: Activity[],
  currentDay: Activity[]
): number | null {
  if (previousDay.length === 0 || currentDay.length === 0) return null;
  const lastEnd = previousDay.reduce((max, a) => {
    const t = new Date(a.end_time).getTime();
    return t > max ? t : max;
  }, 0);
  const firstStart = currentDay.reduce((min, a) => {
    const t = new Date(a.start_time).getTime();
    return t < min ? t : min;
  }, Number.MAX_SAFE_INTEGER);
  return Math.max(0, (firstStart - lastEnd) / (1000 * 60 * 60));
}
