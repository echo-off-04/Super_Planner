export type ActivityType = string;

export const BUILTIN_ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "prestation", label: "Prestation" },
  { value: "local", label: "Local" },
  { value: "logistique", label: "Logistique" },
  { value: "deplacement", label: "Déplacement" },
  { value: "formation", label: "Formation" },
  { value: "recuperation", label: "Récupération" },
  { value: "pause", label: "Pause" },
  { value: "autre", label: "Autre" },
];

export const ACTIVITY_TAG_PRESETS: {
  key: string;
  label: string;
  title: string;
  type: string;
}[] = [
  { key: "local", label: "Local", title: "Local", type: "local" },
  {
    key: "logistique",
    label: "Logistique",
    title: "Logistique",
    type: "logistique",
  },
  {
    key: "prestation",
    label: "Prestation",
    title: "Prestation",
    type: "prestation",
  },
];

export type DurationKind = "full_day" | "morning" | "afternoon" | "custom";

export type RestPeriod = "full_day" | "morning" | "afternoon";

export interface DurationPreset {
  start: string;
  end: string;
  breakMinutes: number;
  label: string;
}

export interface CustomActivityType {
  id: string;
  user_id: string;
  value: string;
  label: string;
}

export interface Activity {
  id: string;
  user_id: string;
  title: string;
  activity_type: ActivityType;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  source: string;
  external_id: string;
  duration_kind: DurationKind;
  break_minutes: number;
}

export interface ContractSettings {
  id: string;
  user_id: string;
  weekly_hours: number;
  daily_max_hours: number;
  min_rest_hours: number;
  overtime_rate: number;
}

export interface RestRules {
  id: string;
  user_id: string;
  preferred_rest_days: number[];
  preferred_time_of_day: string;
  min_consecutive_rest_days: number;
  auto_suggest: boolean;
}

export interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  label: string;
  created_at: string;
}

export function isDateInVacations(
  iso: string,
  vacations: Pick<Vacation, "start_date" | "end_date">[]
): Vacation | null {
  for (const vacation of vacations) {
    if (iso >= vacation.start_date && iso <= vacation.end_date) {
      return vacation as Vacation;
    }
  }
  return null;
}

export function vacationIsoSet(
  vacations: Pick<Vacation, "start_date" | "end_date">[],
  rangeStartIso?: string,
  rangeEndIso?: string
): Set<string> {
  const result = new Set<string>();
  for (const vacation of vacations) {
    const start = new Date(`${vacation.start_date}T00:00:00`);
    const end = new Date(`${vacation.end_date}T00:00:00`);
    for (
      let cursor = new Date(start);
      cursor.getTime() <= end.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (rangeStartIso && iso < rangeStartIso) continue;
      if (rangeEndIso && iso > rangeEndIso) continue;
      result.add(iso);
    }
  }
  return result;
}

export type RestKind = "regular" | "sick";

export interface RestDay {
  id: string;
  user_id: string;
  rest_date: string;
  status: "suggested" | "validated" | "rejected";
  reason: string;
  rest_period: RestPeriod;
  kind: RestKind;
}

export type UserRole = "logisticien" | "animateur" | "manager";

export const ROLE_LABELS: Record<UserRole, string> = {
  logisticien: "Logisticien",
  animateur: "Animateur",
  manager: "Manager",
};

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface DefaultWeekSettings {
  id: string;
  user_id: string;
  rest_days: number[];
  default_title: string;
  default_type: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  pause_start: string;
  pause_end: string;
  break_minutes: number;
}

export const DEFAULT_WEEK_FALLBACK: Omit<
  DefaultWeekSettings,
  "id" | "user_id"
> = {
  rest_days: [6, 7],
  default_title: "Travail",
  default_type: "prestation",
  morning_start: "09:00",
  morning_end: "13:00",
  afternoon_start: "14:00",
  afternoon_end: "16:00",
  pause_start: "13:00",
  pause_end: "14:00",
  break_minutes: 60,
};

export function parseHM(time: string): number {
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function overlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

type PresetWeekLike = Pick<
  DefaultWeekSettings,
  | "morning_start"
  | "morning_end"
  | "afternoon_start"
  | "afternoon_end"
  | "pause_start"
  | "pause_end"
>;

export function buildDurationPresets(
  week: PresetWeekLike | null | undefined
): Record<Exclude<DurationKind, "custom">, DurationPreset> {
  const settings = week ?? DEFAULT_WEEK_FALLBACK;
  const morningStart = settings.morning_start || "09:00";
  const morningEnd = settings.morning_end || "13:00";
  const afternoonStart = settings.afternoon_start || "14:00";
  const afternoonEnd = settings.afternoon_end || "17:00";
  const pauseMin = parseHM(settings.pause_start || "13:00");
  const pauseMax = parseHM(settings.pause_end || "14:00");
  const pauseDuration = Math.max(0, pauseMax - pauseMin);
  const dayStart = parseHM(morningStart);
  const dayEnd = parseHM(afternoonEnd);
  return {
    full_day: {
      start: morningStart,
      end: afternoonEnd,
      breakMinutes:
        overlapMinutes(dayStart, dayEnd, pauseMin, pauseMax) || pauseDuration,
      label: "Journée complète",
    },
    morning: {
      start: morningStart,
      end: morningEnd,
      breakMinutes: overlapMinutes(
        parseHM(morningStart),
        parseHM(morningEnd),
        pauseMin,
        pauseMax
      ),
      label: "Demi-journée matin",
    },
    afternoon: {
      start: afternoonStart,
      end: afternoonEnd,
      breakMinutes: overlapMinutes(
        parseHM(afternoonStart),
        parseHM(afternoonEnd),
        pauseMin,
        pauseMax
      ),
      label: "Demi-journée après-midi",
    },
  };
}

export function pauseOverlapMinutesForRange(
  startIso: string,
  endIso: string,
  week: Pick<DefaultWeekSettings, "pause_start" | "pause_end"> | null | undefined
): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (end <= start) return 0;
  const settings = week ?? DEFAULT_WEEK_FALLBACK;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const pauseStart = parseHM(settings.pause_start || "13:00");
  const pauseEnd = parseHM(settings.pause_end || "14:00");
  if (pauseEnd <= pauseStart) return 0;
  return overlapMinutes(startMin, endMin, pauseStart, pauseEnd);
}

export interface RestRange {
  startMin: number;
  endMin: number;
  label: string;
}

export function restRangesForPeriod(
  period: RestPeriod,
  week: PresetWeekLike | null | undefined
): RestRange[] {
  const settings = week ?? DEFAULT_WEEK_FALLBACK;
  if (period === "morning") {
    return [
      {
        startMin: parseHM(settings.morning_start),
        endMin: parseHM(settings.morning_end),
        label: "matin",
      },
    ];
  }
  if (period === "afternoon") {
    return [
      {
        startMin: parseHM(settings.afternoon_start),
        endMin: parseHM(settings.afternoon_end),
        label: "après-midi",
      },
    ];
  }
  return [
    {
      startMin: parseHM(settings.morning_start),
      endMin: parseHM(settings.afternoon_end),
      label: "journée",
    },
  ];
}