import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export interface ProtectedActivityType {
  id: string;
  user_id: string;
  activity_type: string;
  created_at: string;
}

export function buildProtectedTypeSet(
  types: Pick<ProtectedActivityType, "activity_type">[]
): Set<string> {
  const set = new Set<string>();
  for (const t of types) {
    const v = (t.activity_type || "").trim();
    if (v) set.add(v);
  }
  return set;
}

export function isActivityProtected(
  activity: Pick<Activity, "activity_type">,
  protectedSet: Set<string>
): boolean {
  if (protectedSet.size === 0) return false;
  return protectedSet.has(activity.activity_type || "");
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
  for (const v of vacations) {
    if (iso >= v.start_date && iso <= v.end_date) return v as Vacation;
  }
  return null;
}

export function vacationIsoSet(
  vacations: Pick<Vacation, "start_date" | "end_date">[],
  rangeStartIso?: string,
  rangeEndIso?: string
): Set<string> {
  const set = new Set<string>();
  for (const v of vacations) {
    const start = new Date(v.start_date + "T00:00:00");
    const end = new Date(v.end_date + "T00:00:00");
    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (rangeStartIso && iso < rangeStartIso) continue;
      if (rangeEndIso && iso > rangeEndIso) continue;
      set.add(iso);
    }
  }
  return set;
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
  afternoon_end: "17:00",
  pause_start: "13:00",
  pause_end: "14:00",
  break_minutes: 60,
};

export function parseHM(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
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
  const w = week ?? DEFAULT_WEEK_FALLBACK;
  const morningStart = w.morning_start || "09:00";
  const morningEnd = w.morning_end || "13:00";
  const afternoonStart = w.afternoon_start || "14:00";
  const afternoonEnd = w.afternoon_end || "17:00";
  const pauseMin = parseHM(w.pause_start || "13:00");
  const pauseMax = parseHM(w.pause_end || "14:00");
  const pauseDuration = Math.max(0, pauseMax - pauseMin);
  const dayStart = parseHM(morningStart);
  const dayEnd = parseHM(afternoonEnd);
  return {
    full_day: {
      start: morningStart,
      end: afternoonEnd,
      breakMinutes: overlapMinutes(dayStart, dayEnd, pauseMin, pauseMax) || pauseDuration,
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
  const w = week ?? DEFAULT_WEEK_FALLBACK;
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const pauseStart = parseHM(w.pause_start || "13:00");
  const pauseEnd = parseHM(w.pause_end || "14:00");
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
  const w = week ?? DEFAULT_WEEK_FALLBACK;
  if (period === "morning") {
    return [
      {
        startMin: parseHM(w.morning_start),
        endMin: parseHM(w.morning_end),
        label: "matin",
      },
    ];
  }
  if (period === "afternoon") {
    return [
      {
        startMin: parseHM(w.afternoon_start),
        endMin: parseHM(w.afternoon_end),
        label: "après-midi",
      },
    ];
  }
  return [
    {
      startMin: parseHM(w.morning_start),
      endMin: parseHM(w.afternoon_end),
      label: "journée",
    },
  ];
}
