import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AppUser } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import type {
  Activity,
  ContractSettings,
  DefaultWeekSettings,
  Profile,
  RestDay,
  RestRules,
  Vacation,
} from "@/lib/planning";
import { isDateInVacations, vacationIsoSet } from "@/lib/planning";
import { DEFAULT_WEEK_FALLBACK } from "@/lib/planning";
import type { RestPeriod } from "@/lib/planning";
import { overlapMinutes, restRangesForPeriod } from "@/lib/planning";
import { ROLE_LABELS } from "@/lib/planning";
import {
  addDays,
  endOfWeek,
  formatDateISO,
  MONTH_LABELS,
  startOfWeek,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Plus,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { DayView } from "./day-view";
import { StatsCards } from "./stats-cards";
import { RestSuggestions } from "./rest-suggestions";
import { ActivityDialog } from "./activity-dialog";
import { SettingsDialog } from "./settings-dialog";
import { ModeToggle } from "./mode-toggle";
import { ChoiceDialog } from "./choice-dialog";
import { dailyUsedHours, sameDay } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildHolidayMap,
  countHolidayCreditHours,
  getFrenchHolidaysInRange,
} from "@/lib/holidays";

interface Props {
  user: AppUser;
}

type ActivityDraft = Omit<Activity, "id">;
type RestDayDraft = Omit<RestDay, "id">;

export function Dashboard({ user }: Props) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const [kpiRestDays, setKpiRestDays] = useState<RestDay[]>([]);
  const [contract, setContract] = useState<ContractSettings | null>(null);
  const [rules, setRules] = useState<RestRules | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [defaultWeek, setDefaultWeek] = useState<DefaultWeekSettings | null>(
    null
  );
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [defaultActivityDate, setDefaultActivityDate] = useState<
    Date | undefined
  >();
  const [fixedDate, setFixedDate] = useState(false);
  const [restConflict, setRestConflict] = useState<{
    date: Date;
    period: RestPeriod;
    activities: Activity[];
  } | null>(null);
  const [pendingRestDate, setPendingRestDate] = useState<Date | null>(null);
  const [moveTargetOpen, setMoveTargetOpen] = useState(false);
  const [moveTargetDate, setMoveTargetDate] = useState("");
  const [applyConflictOpen, setApplyConflictOpen] = useState(false);
  const [overload, setOverload] = useState<{
    date: Date;
    excessHours: number;
    savedId?: string;
  } | null>(null);
  const [recupOverwrite, setRecupOverwrite] = useState<{
    dayDate: Date;
    remainingMs: number;
    partialInserts: ActivityDraft[];
  } | null>(null);
  const [customRecup, setCustomRecup] = useState<{
    sourceDate: Date;
    excessMs: number;
  } | null>(null);
  const [customRecupDate, setCustomRecupDate] = useState("");
  const [customRecupTime, setCustomRecupTime] = useState("");
  const [pendingHolidayActivity, setPendingHolidayActivity] = useState<{
    date: Date;
    name: string;
  } | null>(null);
  const [pendingVacationActivity, setPendingVacationActivity] = useState<{
    date: Date;
    label: string;
  } | null>(null);
  const [vacations, setVacations] = useState<Vacation[]>([]);

  const rangeStart = useMemo(() => {
    if (view === "day") {
      const d = addDays(cursor, -1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (view === "week") return startOfWeek(cursor);
    return startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  }, [cursor, view]);

  const rangeEnd = useMemo(() => {
    if (view === "day") {
      const d = new Date(cursor);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    if (view === "week") return endOfWeek(cursor);
    const firstNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return endOfWeek(addDays(firstNext, -1));
  }, [cursor, view]);

  const kpiRestRange = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(
        new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      );
      const firstNext = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1
      );
      const end = endOfWeek(addDays(firstNext, -1));
      return { start, end };
    }
    return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
  }, [cursor, view]);

  const holidaysList = useMemo(
    () => getFrenchHolidaysInRange(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );
  const holidaysMap = useMemo(
    () => buildHolidayMap(holidaysList),
    [holidaysList]
  );
  const vacationIsos = useMemo(
    () =>
      vacationIsoSet(
        vacations,
        formatDateISO(rangeStart),
        formatDateISO(rangeEnd)
      ),
    [vacations, rangeStart, rangeEnd]
  );
  const vacationLabelByIso = useMemo(() => {
    const map = new Map<string, string>();
    for (const iso of vacationIsos) {
      const v = isDateInVacations(iso, vacations);
      map.set(iso, v?.label || "Vacances");
    }
    return map;
  }, [vacationIsos, vacations]);
  const kpiHolidayRange = useMemo(() => {
    if (view === "day") {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === "week") {
      return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [cursor, view]);

  const kpiHolidaysList = useMemo(
    () => getFrenchHolidaysInRange(kpiHolidayRange.start, kpiHolidayRange.end),
    [kpiHolidayRange.start, kpiHolidayRange.end]
  );

  const kpiHolidayCredit = useMemo(() => {
    const tpl = defaultWeek ?? { ...DEFAULT_WEEK_FALLBACK, id: "", user_id: user.id };
    return countHolidayCreditHours({
      dailyHours: contract?.daily_max_hours ?? 8,
      restDays: tpl.rest_days,
      holidays: kpiHolidaysList,
      rangeStart: kpiHolidayRange.start,
      rangeEnd: kpiHolidayRange.end,
    });
  }, [contract, defaultWeek, kpiHolidaysList, kpiHolidayRange.start, kpiHolidayRange.end, user.id]);

  const loadData = useCallback(async () => {
    const startIso = rangeStart.toISOString();
    const endIso = rangeEnd.toISOString();
    const [activityData, restData, kpiData] = await Promise.all([
      api.activities.list({ start: startIso, end: endIso }),
      api.restDays.list({
        start: formatDateISO(rangeStart),
        end: formatDateISO(rangeEnd),
      }),
      api.restDays.list({
        start: formatDateISO(kpiRestRange.start),
        end: formatDateISO(kpiRestRange.end),
      }),
    ]);
    setActivities(activityData);
    setRestDays(restData);
    setKpiRestDays(kpiData);
  }, [user.id, rangeStart, rangeEnd, kpiRestRange.start, kpiRestRange.end]);

  const loadSettings = useCallback(async () => {
    const data = await api.settings.getBootstrap();
    setContract(data.contract);
    setRules(data.rules);
    setProfile(data.profile);
    setDefaultWeek(data.defaultWeek);
    setVacations(data.vacations);
  }, [user.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function navigate(dir: -1 | 0 | 1) {
    if (dir === 0) {
      setCursor(new Date());
      return;
    }
    const d = new Date(cursor);
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  }

  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return `${cursor.getDate()} ${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    }
    if (view === "week") {
      const startStr = `${weekStart.getDate()} ${MONTH_LABELS[
        weekStart.getMonth()
      ].slice(0, 4)}.`;
      const endStr = `${weekEnd.getDate()} ${MONTH_LABELS[
        weekEnd.getMonth()
      ].slice(0, 4)}. ${weekEnd.getFullYear()}`;
      return `${startStr} – ${endStr}`;
    }
    return `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [view, cursor, weekStart, weekEnd]);

  function openNewActivity(date?: Date) {
    if (date) {
      const iso = formatDateISO(date);
      const vac = isDateInVacations(iso, vacations);
      if (vac) {
        setPendingVacationActivity({ date, label: vac.label || "Vacances" });
        return;
      }
      const holidayName = holidaysMap.get(iso);
      if (holidayName) {
        setPendingHolidayActivity({ date, name: holidayName });
        return;
      }
    }
    setEditingActivity(null);
    setDefaultActivityDate(date);
    setFixedDate(Boolean(date));
    setActivityDialogOpen(true);
  }

  function confirmHolidayActivity() {
    if (!pendingHolidayActivity) return;
    const date = pendingHolidayActivity.date;
    setPendingHolidayActivity(null);
    setEditingActivity(null);
    setDefaultActivityDate(date);
    setFixedDate(true);
    setActivityDialogOpen(true);
  }

  function confirmVacationActivity() {
    if (!pendingVacationActivity) return;
    const date = pendingVacationActivity.date;
    setPendingVacationActivity(null);
    setEditingActivity(null);
    setDefaultActivityDate(date);
    setFixedDate(true);
    setActivityDialogOpen(true);
  }

  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setDefaultActivityDate(undefined);
    setFixedDate(false);
    setActivityDialogOpen(true);
  }

  async function markAsRestDay(date: Date, period: RestPeriod = "full_day") {
    const iso = formatDateISO(date);
    const existing = restDays.find((r) => r.rest_date === iso);
    if (existing?.kind === "sick") {
      toast.error(
        "Ce jour est un repos maladie. Modifiez-le depuis les paramètres."
      );
      return;
    }
    await api.restDays.upsertMany([
      {
        user_id: user.id,
        rest_date: iso,
        status: "validated",
        reason: "Validé manuellement",
        rest_period: period,
        kind: "regular",
      },
    ]);
  }

  function activitiesOverlappingPeriod(
    date: Date,
    period: RestPeriod
  ): Activity[] {
    const ranges = restRangesForPeriod(period, defaultWeek);
    return activities.filter((a) => {
      if (!sameDay(new Date(a.start_time), date)) return false;
      if (a.activity_type === "pause") return false;
      const s = new Date(a.start_time);
      const e = new Date(a.end_time);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      return ranges.some(
        (r) => overlapMinutes(sMin, eMin, r.startMin, r.endMin) > 0
      );
    });
  }

  async function applyRestWithPeriod(date: Date, period: RestPeriod) {
    const conflicting = activitiesOverlappingPeriod(date, period);
    if (conflicting.length > 0) {
      setRestConflict({ date, period, activities: conflicting });
      return;
    }
    await markAsRestDay(date, period);
    loadData();
  }

  function toggleRestDay(date: Date) {
    const iso = formatDateISO(date);
    const existing = restDays.find((r) => r.rest_date === iso);
    if (existing?.kind === "sick") {
      toast.error(
        "Ce jour est un repos maladie. Gérez-le depuis les paramètres."
      );
      return;
    }
    if (existing?.status === "validated") {
      api.restDays.delete(existing.id).then(() => loadData());
      return;
    }
    if (vacationIsos.has(iso)) {
      toast.error(
        "Impossible de marquer un jour de vacances comme jour de repos."
      );
      return;
    }
    setPendingRestDate(date);
  }

  async function handleDeleteAndRest() {
    if (!restConflict) return;
    const ids = restConflict.activities.map((a) => a.id);
    await api.activities.deleteMany(ids);
    await markAsRestDay(restConflict.date, restConflict.period);
    setRestConflict(null);
    loadData();
  }

  function openMoveActivities() {
    if (!restConflict) return;
    const nextDay = addDays(restConflict.date, 1);
    setMoveTargetDate(formatDateISO(nextDay));
    setMoveTargetOpen(true);
  }

  async function handleMoveAndRest() {
    if (!restConflict || !moveTargetDate) return;
    const [y, mo, day] = moveTargetDate.split("-").map(Number);
    const target = new Date(y, (mo ?? 1) - 1, day ?? 1);
    if (sameDay(target, restConflict.date)) {
      toast.error("Choisissez une date différente du jour de repos.");
      return;
    }
    const updates = restConflict.activities.map((a) => {
      const start = new Date(a.start_time);
      const end = new Date(a.end_time);
      const newStart = new Date(target);
      newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
      const newEnd = new Date(target);
      newEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
      return {
        id: a.id,
        data: {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        },
      };
    });
    await api.activities.bulkUpdate(updates);
    await markAsRestDay(restConflict.date, restConflict.period);
    setMoveTargetOpen(false);
    setRestConflict(null);
    loadData();
    toast.success("Activités déplacées et jour marqué comme repos.");
  }

  function requestApplyDefaultWeek() {
    const weekStart = startOfWeek(cursor);
    const weekEnd = endOfWeek(weekStart);
    const hasExisting = activities.some((a) => {
      const d = new Date(a.start_time);
      return d >= weekStart && d <= weekEnd;
    });
    if (hasExisting) {
      setApplyConflictOpen(true);
    } else {
      applyDefaultWeek(weekStart, "empty-only");
    }
  }

  async function applyDefaultWeek(
    weekStart: Date,
    mode: "empty-only" | "overwrite" = "empty-only"
  ) {
    const tpl = defaultWeek ?? {
      ...DEFAULT_WEEK_FALLBACK,
      id: "",
      user_id: user.id,
    };
    const weekEnd = endOfWeek(weekStart);
    const holidayIsoSetForWipe = new Set(
      getFrenchHolidaysInRange(weekStart, weekEnd).map((h) => h.date)
    );
    const vacationIsoSetForWipe = vacationIsoSet(
      vacations,
      formatDateISO(weekStart),
      formatDateISO(weekEnd)
    );
    const sickIsoSetForWipe = new Set(
      restDays.filter((r) => r.kind === "sick").map((r) => r.rest_date)
    );
    const isProtectedIso = (iso: string) =>
      holidayIsoSetForWipe.has(iso) ||
      vacationIsoSetForWipe.has(iso) ||
      sickIsoSetForWipe.has(iso);
    const weekActivities = activities.filter((a) => {
      const d = new Date(a.start_time);
      return d >= weekStart && d <= weekEnd;
    });
    const weekIsoDates = new Set<string>();
    for (let i = 0; i < 7; i++) {
      weekIsoDates.add(formatDateISO(addDays(weekStart, i)));
    }
    const existingRestIsoSet = new Set(
      restDays
        .filter((r) => weekIsoDates.has(r.rest_date))
        .map((r) => r.rest_date)
    );
    const sickRestIsoSet = new Set(
      restDays
        .filter((r) => r.kind === "sick" && weekIsoDates.has(r.rest_date))
        .map((r) => r.rest_date)
    );
    const existingActivityIsoSet = new Set(
      weekActivities.map((a) => formatDateISO(new Date(a.start_time)))
    );

    if (mode === "overwrite") {
      const deletableActivities = weekActivities.filter(
        (a) => !isProtectedIso(formatDateISO(new Date(a.start_time)))
      );
      if (deletableActivities.length > 0) {
        await api.activities.deleteMany(deletableActivities.map((a) => a.id));
      }
      const deletableRestIsos = Array.from(existingRestIsoSet).filter(
        (iso) => !isProtectedIso(iso)
      );
      if (deletableRestIsos.length > 0) {
        await api.restDays.deleteByDates(deletableRestIsos);
        for (const iso of deletableRestIsos) existingRestIsoSet.delete(iso);
      }
      for (const iso of Array.from(existingActivityIsoSet)) {
        if (!isProtectedIso(iso)) existingActivityIsoSet.delete(iso);
      }
    }

    const parseTime = (t: string): [number, number] => {
      const [h, m] = t.split(":").map(Number);
      return [h ?? 0, m ?? 0];
    };
    const [mStartH, mStartM] = parseTime(tpl.morning_start);
    const [mEndH, mEndM] = parseTime(tpl.morning_end);
    const [aStartH, aStartM] = parseTime(tpl.afternoon_start);
    const [aEndH, aEndM] = parseTime(tpl.afternoon_end);
    const [pStartH, pStartM] = parseTime(tpl.pause_start);
    const [pEndH, pEndM] = parseTime(tpl.pause_end);
    const pauseStartMin = pStartH * 60 + pStartM;
    const pauseEndMin = pEndH * 60 + pEndM;
    const hasPause = pauseEndMin > pauseStartMin;

    const activityInserts: ActivityDraft[] = [];
    const restInserts: RestDayDraft[] = [];
    const restDatesToClear: string[] = [];
    const holidayIsoSet = new Set(
      getFrenchHolidaysInRange(weekStart, endOfWeek(weekStart)).map((h) => h.date)
    );
    const weekVacationIsoSet = vacationIsoSet(
      vacations,
      formatDateISO(weekStart),
      formatDateISO(endOfWeek(weekStart))
    );

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayNumber = i + 1;
      const iso = formatDateISO(day);
      const isTemplateRest = tpl.rest_days.includes(dayNumber);
      const hasActivity = existingActivityIsoSet.has(iso);
      const hasRest = existingRestIsoSet.has(iso);
      const isHoliday = holidayIsoSet.has(iso);
      const isVacation = weekVacationIsoSet.has(iso);
      const isSick = sickRestIsoSet.has(iso);

      if (isHoliday || isVacation || isSick) {
        continue;
      }

      if (hasActivity) {
        continue;
      }

      if (isTemplateRest) {
        if (!hasRest) {
          restInserts.push({
            user_id: user.id,
            rest_date: iso,
            status: "validated",
            reason: "Semaine type",
            rest_period: "full_day",
            kind: "regular",
          });
        }
        continue;
      }

      if (hasRest) {
        restDatesToClear.push(iso);
      }

      const morningStart = new Date(day);
      morningStart.setHours(mStartH, mStartM, 0, 0);
      const morningEnd = new Date(day);
      morningEnd.setHours(mEndH, mEndM, 0, 0);
      const afternoonStart = new Date(day);
      afternoonStart.setHours(aStartH, aStartM, 0, 0);
      const afternoonEnd = new Date(day);
      afternoonEnd.setHours(aEndH, aEndM, 0, 0);
      activityInserts.push({
        user_id: user.id,
        title: tpl.default_title,
        activity_type: tpl.default_type,
        start_time: morningStart.toISOString(),
        end_time: morningEnd.toISOString(),
        location: "",
        notes: "",
        source: "default_week",
        external_id: "",
        duration_kind: "custom",
        break_minutes: 0,
      });
      activityInserts.push({
        user_id: user.id,
        title: tpl.default_title,
        activity_type: tpl.default_type,
        start_time: afternoonStart.toISOString(),
        end_time: afternoonEnd.toISOString(),
        location: "",
        notes: "",
        source: "default_week",
        external_id: "",
        duration_kind: "custom",
        break_minutes: 0,
      });
      if (hasPause) {
        const pauseStart = new Date(day);
        pauseStart.setHours(pStartH, pStartM, 0, 0);
        const pauseEnd = new Date(day);
        pauseEnd.setHours(pEndH, pEndM, 0, 0);
        activityInserts.push({
          user_id: user.id,
          title: "Pause",
          activity_type: "pause",
          start_time: pauseStart.toISOString(),
          end_time: pauseEnd.toISOString(),
          location: "",
          notes: "",
          source: "default_week",
          external_id: "",
          duration_kind: "custom",
          break_minutes: 0,
        });
      }
    }

    if (restDatesToClear.length > 0) {
      await api.restDays.deleteByDates(restDatesToClear);
    }
    if (activityInserts.length > 0) {
      await api.activities.createMany(activityInserts);
    }
    if (restInserts.length > 0) {
      await api.restDays.upsertMany(restInserts);
    }
    loadData();
    toast.success("Semaine par défaut appliquée.");
  }

  async function validateSuggestion(date: Date) {
    const iso = formatDateISO(date);
    const existing = restDays.find((r) => r.rest_date === iso);
    const period: RestPeriod = existing?.rest_period ?? "full_day";
    const conflicting = activitiesOverlappingPeriod(date, period);
    if (conflicting.length > 0) {
      setRestConflict({ date, period, activities: conflicting });
      return;
    }
    await markAsRestDay(date, period);
    loadData();
  }

  function mergeRecupInserts(items: ActivityDraft[]): ActivityDraft[] {
    const recups = items
      .filter((i) => i.activity_type === "recuperation")
      .map((i) => ({
        start: new Date(i.start_time as string).getTime(),
        end: new Date(i.end_time as string).getTime(),
        raw: i,
      }))
      .sort((a, b) => a.start - b.start);
    const others = items.filter((i) => i.activity_type !== "recuperation");
    const merged: Array<{ start: number; end: number; raw: ActivityDraft }> = [];
    for (const r of recups) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ start: r.start, end: r.end, raw: r.raw });
      }
    }
    const mergedRecups = merged.map((m) => ({
      ...m.raw,
      start_time: new Date(m.start).toISOString(),
      end_time: new Date(m.end).toISOString(),
    }));
    return [...others, ...mergedRecups];
  }

  async function handleActivitySaved(info?: {
    savedDate?: Date;
    savedId?: string;
  }) {
    await loadData();
    if (!info?.savedDate) return;
    const day = new Date(info.savedDate);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const dayActs = await api.activities.list({
      start: day.toISOString(),
      end: dayEnd.toISOString(),
    });
    const maxDaily = contract?.daily_max_hours ?? 10;
    const hours = dailyUsedHours(dayActs);
    if (hours > maxDaily + 1e-6) {
      setOverload({
        date: day,
        excessHours: hours - maxDaily,
        savedId: info.savedId,
      });
    }
  }

  async function reduceSavedActivity() {
    if (!overload) return;
    const hoursToRemove = overload.excessHours;
    const day = overload.date;
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const acts = await api.activities.list({
      start: day.toISOString(),
      end: dayEnd.toISOString(),
    });
    let target: Activity | undefined;
    if (overload.savedId) {
      target = acts.find((a) => a.id === overload.savedId);
    }
    if (!target) {
      target = [...acts]
        .reverse()
        .find(
          (a) =>
            a.activity_type !== "pause" && a.activity_type !== "recuperation"
        );
    }
    if (!target) {
      setOverload(null);
      return;
    }
    const start = new Date(target.start_time).getTime();
    const end = new Date(target.end_time).getTime();
    const newEnd = end - hoursToRemove * 3600 * 1000;
    if (newEnd <= start) {
      await api.activities.delete(target.id);
    } else {
      await api.activities.update(target.id, {
        end_time: new Date(newEnd).toISOString(),
      });
    }
    setOverload(null);
    toast.success("Activité réduite pour respecter la limite journalière.");
    loadData();
  }

  async function scheduleRecuperation() {
    if (!overload) return;
    const dayDate = overload.date;
    const excessMs = overload.excessHours * 3600 * 1000;
    const nextDay = addDays(dayDate, 1);
    const nextIso = formatDateISO(nextDay);

    const [restData] = await api.restDays.list({
      start: nextIso,
      end: nextIso,
      status: "validated",
    });
    if (restData) {
      toast.error(
        "Le jour suivant est un jour de repos complet. Récupération impossible."
      );
      setOverload(null);
      return;
    }
    if (isDateInVacations(nextIso, vacations)) {
      toast.error(
        "Le jour suivant est en vacances. Récupération impossible."
      );
      setOverload(null);
      return;
    }
    if (holidaysMap.get(nextIso)) {
      toast.error(
        "Le jour suivant est férié. Récupération impossible."
      );
      setOverload(null);
      return;
    }

    const nextStart = new Date(nextDay);
    nextStart.setHours(0, 0, 0, 0);
    const nextEnd = new Date(nextDay);
    nextEnd.setHours(23, 59, 59, 999);
    const nextActs = (
      await api.activities.list({
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
      })
    ).slice();

    const tpl = defaultWeek ?? {
      ...DEFAULT_WEEK_FALLBACK,
      id: "",
      user_id: user.id,
    };
    const parseTime = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h ?? 0) * 60 + (m ?? 0);
    };
    const winStartMin = parseTime(tpl.morning_start);
    const winEndMin = parseTime(tpl.afternoon_end);
    const winStart = new Date(nextDay);
    winStart.setHours(Math.floor(winStartMin / 60), winStartMin % 60, 0, 0);
    const winEnd = new Date(nextDay);
    winEnd.setHours(Math.floor(winEndMin / 60), winEndMin % 60, 0, 0);

    const occupied = nextActs
      .map((a) => ({
        id: a.id,
        isPause:
          a.activity_type === "pause" || a.activity_type === "recuperation",
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    const inserts: ActivityDraft[] = [];
    let remaining = excessMs;
    let cursor = winStart.getTime();
    const windowEnd = winEnd.getTime();

    const makeRecup = (s: number, e: number): ActivityDraft => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: "",
      source: "recuperation",
      external_id: "",
      duration_kind: "custom",
      break_minutes: 0,
    });

    for (const occ of occupied) {
      if (remaining <= 0 || cursor >= windowEnd) break;
      if (occ.end <= cursor) continue;
      if (occ.start > cursor) {
        const gapEnd = Math.min(occ.start, windowEnd);
        const slotMs = Math.min(remaining, gapEnd - cursor);
        if (slotMs > 0) {
          inserts.push(makeRecup(cursor, cursor + slotMs));
          remaining -= slotMs;
        }
      }
      cursor = Math.max(cursor, occ.end);
    }
    if (remaining > 0 && cursor < windowEnd) {
      const slotMs = Math.min(remaining, windowEnd - cursor);
      inserts.push(makeRecup(cursor, cursor + slotMs));
      remaining -= slotMs;
    }

    if (remaining > 0) {
      setOverload(null);
      setRecupOverwrite({
        dayDate,
        remainingMs: remaining,
        partialInserts: inserts,
      });
      return;
    }

    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await api.activities.createMany(finalInserts);
    }
    setOverload(null);
    toast.success("Récupération planifiée pour le lendemain.");
    loadData();
  }

  function openCustomRecup() {
    if (!overload) return;
    const next = addDays(overload.date, 1);
    setCustomRecup({
      sourceDate: overload.date,
      excessMs: overload.excessHours * 3600 * 1000,
    });
    setCustomRecupDate(formatDateISO(next));
    setCustomRecupTime("");
    setOverload(null);
  }

  async function confirmCustomRecup() {
    if (!customRecup) return;
    const { excessMs } = customRecup;
    if (!customRecupDate) {
      toast.error("Veuillez choisir une date.");
      return;
    }
    const target = new Date(customRecupDate + "T00:00:00");

    const [restData] = await api.restDays.list({
      start: customRecupDate,
      end: customRecupDate,
      status: "validated",
    });
    if (restData) {
      toast.error(
        "Ce jour est un jour de repos complet. Choisissez une autre date."
      );
      return;
    }
    if (isDateInVacations(customRecupDate, vacations)) {
      toast.error("Ce jour est en vacances. Choisissez une autre date.");
      return;
    }
    if (holidaysMap.get(customRecupDate)) {
      toast.error("Ce jour est férié. Choisissez une autre date.");
      return;
    }

    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);
    const dayActs = await api.activities.list({
      start: dayStart.toISOString(),
      end: dayEnd.toISOString(),
    });

    const inserts: ActivityDraft[] = [];
    const makeRecup = (s: number, e: number): ActivityDraft => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: "",
      source: "recuperation",
      external_id: "",
      duration_kind: "custom",
      break_minutes: 0,
    });

    if (customRecupTime) {
      const [hh, mm] = customRecupTime.split(":").map(Number);
      const startDate = new Date(target);
      startDate.setHours(hh ?? 0, mm ?? 0, 0, 0);
      const startMs = startDate.getTime();
      const endMs = startMs + excessMs;
      const conflict = dayActs.some((a) => {
        const s = new Date(a.start_time).getTime();
        const e = new Date(a.end_time).getTime();
        return startMs < e && endMs > s;
      });
      if (conflict) {
        toast.error(
          "L'horaire choisi chevauche une activité existante. Modifiez l'heure ou la date."
        );
        return;
      }
      inserts.push(makeRecup(startMs, endMs));
    } else {
      const tpl = defaultWeek ?? {
        ...DEFAULT_WEEK_FALLBACK,
        id: "",
        user_id: user.id,
      };
      const parseTime = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      };
      const winStartMin = parseTime(tpl.morning_start);
      const winEndMin = parseTime(tpl.afternoon_end);
      const winStart = new Date(target);
      winStart.setHours(Math.floor(winStartMin / 60), winStartMin % 60, 0, 0);
      const winEnd = new Date(target);
      winEnd.setHours(Math.floor(winEndMin / 60), winEndMin % 60, 0, 0);

      const occupied = dayActs
        .map((a) => ({
          start: new Date(a.start_time).getTime(),
          end: new Date(a.end_time).getTime(),
        }))
        .sort((a, b) => a.start - b.start);

      let remaining = excessMs;
      let cursor = winStart.getTime();
      const windowEnd = winEnd.getTime();

      for (const occ of occupied) {
        if (remaining <= 0 || cursor >= windowEnd) break;
        if (occ.end <= cursor) continue;
        if (occ.start > cursor) {
          const gapEnd = Math.min(occ.start, windowEnd);
          const slotMs = Math.min(remaining, gapEnd - cursor);
          if (slotMs > 0) {
            inserts.push(makeRecup(cursor, cursor + slotMs));
            remaining -= slotMs;
          }
        }
        cursor = Math.max(cursor, occ.end);
      }
      if (remaining > 0 && cursor < windowEnd) {
        const slotMs = Math.min(remaining, windowEnd - cursor);
        inserts.push(makeRecup(cursor, cursor + slotMs));
        remaining -= slotMs;
      }

      if (remaining > 0) {
        toast.error(
          `Impossible de placer ${(remaining / 3600000).toFixed(2)} h dans la fenêtre de travail. Choisissez une heure précise ou une autre date.`
        );
        return;
      }
    }

    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await api.activities.createMany(finalInserts);
    }
    setCustomRecup(null);
    toast.success("Récupération planifiée.");
    loadData();
  }

  async function confirmRecupOverwrite() {
    if (!recupOverwrite) return;
    const { dayDate, remainingMs, partialInserts } = recupOverwrite;
    const nextDay = addDays(dayDate, 1);
    const nextStart = new Date(nextDay);
    nextStart.setHours(0, 0, 0, 0);
    const nextEnd = new Date(nextDay);
    nextEnd.setHours(23, 59, 59, 999);
    const nextActs = (
      await api.activities.list({
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
      })
    ).slice();

    const inserts: ActivityDraft[] = partialInserts.slice();
    const deletes: string[] = [];
    const updates: Array<{ id: string; data: Partial<ActivityDraft> }> = [];
    let remaining = remainingMs;

    for (const a of nextActs) {
      if (remaining <= 0) break;
      if (a.activity_type === "pause" || a.activity_type === "recuperation") {
        continue;
      }
      const s = new Date(a.start_time).getTime();
      const e = new Date(a.end_time).getTime();
      const dur = e - s;
      if (dur <= remaining) {
        deletes.push(a.id);
        inserts.push({
          user_id: user.id,
          title: "Récupération",
          activity_type: "recuperation",
          start_time: new Date(s).toISOString(),
          end_time: new Date(e).toISOString(),
          location: "",
          notes: "",
          source: "recuperation",
          external_id: "",
          duration_kind: "custom",
          break_minutes: 0,
        });
        remaining -= dur;
      } else {
        const newStart = s + remaining;
        updates.push({
          id: a.id,
          data: { start_time: new Date(newStart).toISOString() },
        });
        inserts.push({
          user_id: user.id,
          title: "Récupération",
          activity_type: "recuperation",
          start_time: new Date(s).toISOString(),
          end_time: new Date(newStart).toISOString(),
          location: "",
          notes: "",
          source: "recuperation",
          external_id: "",
          duration_kind: "custom",
          break_minutes: 0,
        });
        remaining = 0;
      }
    }

    if (deletes.length > 0) {
      await api.activities.deleteMany(deletes);
    }
    if (updates.length > 0) {
      await api.activities.bulkUpdate(updates);
    }
    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await api.activities.createMany(finalInserts);
    }
    setRecupOverwrite(null);
    toast.success("Récupération planifiée avec écrasement partiel.");
    loadData();
  }

  async function rejectSuggestion(date: Date) {
    const iso = formatDateISO(date);
    await api.restDays.upsertMany([
      {
        user_id: user.id,
        rest_date: iso,
        status: "rejected",
        reason: "Refusée",
        rest_period: "full_day",
        kind: "regular",
      },
    ]);
    loadData();
  }

  async function handleSignOut() {
    await signOut();
  }

  async function importFromApi() {
    const toastId = toast.loading("Import en cours...");
    try {
      const body = await api.imports.importBokuKumasala();
      toast.success(
        `Import terminé : ${body.imported} ajoutée(s), ${body.skipped} ignorée(s).`,
        { id: toastId }
      );
      loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Import échoué : ${message}`, { id: toastId });
    }
  }

  const validatedCount = kpiRestDays.filter(
    (r) => r.status === "validated"
  ).length;

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">
                Super planner
              </span>
              <span className="text-xs leading-tight text-muted-foreground">
                Gestion logisticiens
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => requestApplyDefaultWeek()}
              className="hidden md:inline-flex"
            >
              <CalendarDays className="mr-1 h-4 w-4" /> Semaine type
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => requestApplyDefaultWeek()}
              className="md:hidden"
              aria-label="Appliquer la semaine type"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => openNewActivity()}
              className="hidden sm:inline-flex"
            >
              <Plus className="mr-1 h-4 w-4" /> Nouvelle activité
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openNewActivity()}
              className="sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <UserIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">
                      {profile?.full_name || user.email?.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    <Badge variant="secondary" className="mt-1 w-fit text-xs">
                      {ROLE_LABELS[profile?.role ?? "logisticien"]}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" /> Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={importFromApi}>
                  <Download className="mr-2 h-4 w-4" /> Importer prestations
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
        <StatsCards
          activities={activities.filter((a) => {
            const t = new Date(a.start_time).getTime();
            return (
              t >= kpiHolidayRange.start.getTime() &&
              t <= kpiHolidayRange.end.getTime()
            );
          })}
          contract={contract}
          restDaysCount={validatedCount}
          view={view}
          holidayCredit={kpiHolidayCredit}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(0)}
              className="h-9"
            >
              Aujourd'hui
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => navigate(1)}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 text-sm font-medium capitalize text-foreground">
              {rangeLabel}
            </div>
          </div>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "day" | "week" | "month")}
          >
            <TabsList>
              <TabsTrigger value="day">Jour</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "day" && (
          <DayView
            date={cursor}
            activities={activities}
            restDays={restDays}
            contract={contract}
            holidayName={holidaysMap.get(formatDateISO(cursor)) ?? null}
            vacationLabel={
              isDateInVacations(formatDateISO(cursor), vacations)?.label ??
              (vacationIsos.has(formatDateISO(cursor)) ? "Vacances" : null)
            }
            previousDayActivities={activities.filter((a) => {
              const d = new Date(a.start_time);
              const prev = addDays(cursor, -1);
              return (
                d.getFullYear() === prev.getFullYear() &&
                d.getMonth() === prev.getMonth() &&
                d.getDate() === prev.getDate()
              );
            })}
            onAddActivity={openNewActivity}
            onEditActivity={openEditActivity}
            onToggleRest={toggleRestDay}
          />
        )}
        {view === "week" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <WeekView
              weekStart={weekStart}
              activities={activities}
              restDays={restDays}
              contract={contract}
              holidays={holidaysMap}
              vacations={vacationLabelByIso}
              onAddActivity={openNewActivity}
              onEditActivity={openEditActivity}
              onToggleRest={toggleRestDay}
            />
            <RestSuggestions
              weekStart={weekStart}
              activities={activities}
              restDays={restDays}
              rules={rules}
              onValidate={validateSuggestion}
              onReject={rejectSuggestion}
            />
          </div>
        )}
        {view === "month" && (
          <MonthView
            month={cursor}
            activities={activities}
            restDays={restDays}
            contract={contract}
            holidays={holidaysMap}
            onSelectDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
      </main>

      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        userId={user.id}
        activity={editingActivity}
        defaultDate={defaultActivityDate}
        fixedDate={fixedDate}
        defaultWeek={defaultWeek}
        restDays={restDays}
        onSaved={handleActivitySaved}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={user.id}
        contract={contract}
        rules={rules}
        profile={profile}
        defaultWeek={defaultWeek}
        onSaved={() => {
          loadSettings();
          loadData();
        }}
        onApplyDefaultWeek={() => requestApplyDefaultWeek()}
      />
      <ChoiceDialog
        open={pendingRestDate !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRestDate(null);
        }}
        title="Marquer ce jour comme repos"
        description={
          pendingRestDate
            ? `Choisissez la portée du repos pour le ${formatDateISO(pendingRestDate)}.`
            : undefined
        }
        actions={[
          {
            key: "full_day",
            label: "Journée complète",
            variant: "default",
            onSelect: () => {
              const d = pendingRestDate;
              setPendingRestDate(null);
              if (d) applyRestWithPeriod(d, "full_day");
            },
          },
          {
            key: "morning",
            label: `Demi-journée matin (${(defaultWeek ?? DEFAULT_WEEK_FALLBACK).morning_start}–${(defaultWeek ?? DEFAULT_WEEK_FALLBACK).morning_end})`,
            variant: "secondary",
            onSelect: () => {
              const d = pendingRestDate;
              setPendingRestDate(null);
              if (d) applyRestWithPeriod(d, "morning");
            },
          },
          {
            key: "afternoon",
            label: `Demi-journée après-midi (${(defaultWeek ?? DEFAULT_WEEK_FALLBACK).afternoon_start}–${(defaultWeek ?? DEFAULT_WEEK_FALLBACK).afternoon_end})`,
            variant: "secondary",
            onSelect: () => {
              const d = pendingRestDate;
              setPendingRestDate(null);
              if (d) applyRestWithPeriod(d, "afternoon");
            },
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setPendingRestDate(null),
          },
        ]}
      />
      <ChoiceDialog
        open={restConflict !== null && !moveTargetOpen}
        onOpenChange={(o) => {
          if (!o) setRestConflict(null);
        }}
        title="Ce jour contient déjà des activités"
        description={
          restConflict
            ? `${restConflict.activities.length} activité(s) prévue(s) le ${formatDateISO(
                restConflict.date
              )}. Que souhaitez-vous faire pour marquer ce jour comme repos ?`
            : undefined
        }
        actions={[
          {
            key: "move",
            label: "Déplacer les activités vers un autre jour",
            variant: "default",
            onSelect: openMoveActivities,
          },
          {
            key: "delete",
            label: "Effacer les activités du jour",
            variant: "destructive",
            onSelect: handleDeleteAndRest,
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setRestConflict(null),
          },
        ]}
      />
      <ChoiceDialog
        open={moveTargetOpen}
        onOpenChange={(o) => {
          if (!o) setMoveTargetOpen(false);
        }}
        title="Déplacer les activités"
        description="Choisissez la date de destination. Les horaires seront conservés."
        actions={[
          {
            key: "confirm",
            label: "Confirmer le déplacement",
            variant: "default",
            onSelect: handleMoveAndRest,
            disabled: !moveTargetDate,
          },
          {
            key: "back",
            label: "Retour",
            variant: "outline",
            onSelect: () => setMoveTargetOpen(false),
          },
        ]}
      >
        <div className="space-y-2">
          <Label htmlFor="move-target">Nouvelle date</Label>
          <Input
            id="move-target"
            type="date"
            value={moveTargetDate}
            onChange={(e) => setMoveTargetDate(e.target.value)}
          />
        </div>
      </ChoiceDialog>
      <ChoiceDialog
        open={applyConflictOpen}
        onOpenChange={setApplyConflictOpen}
        title="Appliquer la semaine type"
        description="Certains jours de cette semaine contiennent déjà des activités. Comment souhaitez-vous procéder ?"
        actions={[
          {
            key: "overwrite",
            label: "Écraser les activités existantes",
            description:
              "Supprime toutes les activités de la semaine et applique la semaine type.",
            variant: "destructive",
            onSelect: async () => {
              setApplyConflictOpen(false);
              await applyDefaultWeek(startOfWeek(cursor), "overwrite");
            },
          },
          {
            key: "empty-only",
            label: "Remplir uniquement les jours vides",
            description:
              "Conserve les activités existantes et complète les jours sans activité.",
            onSelect: async () => {
              setApplyConflictOpen(false);
              await applyDefaultWeek(startOfWeek(cursor), "empty-only");
            },
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setApplyConflictOpen(false),
          },
        ]}
      />
      <ChoiceDialog
        open={overload !== null}
        onOpenChange={(o) => {
          if (!o) setOverload(null);
        }}
        title="Limite journalière dépassée"
        description={
          overload
            ? `Le ${formatDateISO(overload.date)} dépasse de ${overload.excessHours.toFixed(2)} h la limite contractuelle. Que souhaitez-vous faire ?`
            : ""
        }
        actions={[
          {
            key: "reduce",
            label: "Réduire l'activité",
            description:
              "Raccourcit la dernière activité saisie pour rester dans la limite.",
            onSelect: () => reduceSavedActivity(),
          },
          {
            key: "recup",
            label: "Récupérer le lendemain",
            description:
              "Conserve les activités et ajoute des créneaux de récupération le jour suivant.",
            onSelect: () => scheduleRecuperation(),
          },
          {
            key: "recup-custom",
            label: "Récupérer un autre jour",
            description:
              "Choisissez la date (et l'heure si souhaité) pour planifier la récupération.",
            onSelect: () => openCustomRecup(),
          },
          {
            key: "keep",
            label: "Conserver tel quel",
            variant: "outline",
            onSelect: () => setOverload(null),
          },
        ]}
      />
      <ChoiceDialog
        open={recupOverwrite !== null}
        onOpenChange={(o) => {
          if (!o) setRecupOverwrite(null);
        }}
        title="Aucun créneau libre disponible"
        description={
          recupOverwrite
            ? `Il reste ${(recupOverwrite.remainingMs / 3600000).toFixed(2)} h à récupérer. Souhaitez-vous écraser les activités existantes du lendemain (hors pauses) ?`
            : ""
        }
        actions={[
          {
            key: "overwrite",
            label: "Écraser les activités (hors pauses)",
            description:
              "Remplace partiellement ou totalement les activités du jour suivant, en respectant les pauses.",
            variant: "destructive",
            onSelect: () => confirmRecupOverwrite(),
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setRecupOverwrite(null),
          },
        ]}
      />
      <ChoiceDialog
        open={pendingHolidayActivity !== null}
        onOpenChange={(o) => {
          if (!o) setPendingHolidayActivity(null);
        }}
        title="Jour férié"
        description={
          pendingHolidayActivity
            ? `Le ${formatDateISO(pendingHolidayActivity.date)} est un jour férié (${pendingHolidayActivity.name}). Voulez-vous quand même y ajouter une activité ?`
            : ""
        }
        actions={[
          {
            key: "confirm",
            label: "Ajouter l'activité",
            onSelect: () => confirmHolidayActivity(),
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setPendingHolidayActivity(null),
          },
        ]}
      />
      <ChoiceDialog
        open={pendingVacationActivity !== null}
        onOpenChange={(o) => {
          if (!o) setPendingVacationActivity(null);
        }}
        title="Jour de vacances"
        description={
          pendingVacationActivity
            ? `Le ${formatDateISO(pendingVacationActivity.date)} est marqué comme vacances${pendingVacationActivity.label ? ` (${pendingVacationActivity.label})` : ""}. Voulez-vous quand même y ajouter une activité ?`
            : ""
        }
        actions={[
          {
            key: "confirm",
            label: "Ajouter l'activité",
            onSelect: () => confirmVacationActivity(),
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setPendingVacationActivity(null),
          },
        ]}
      />
      <ChoiceDialog
        open={customRecup !== null}
        onOpenChange={(o) => {
          if (!o) setCustomRecup(null);
        }}
        title="Récupérer un autre jour"
        description={
          customRecup
            ? `Choisissez la date${customRecupTime ? " et l'heure" : " (heure optionnelle)"} pour planifier ${(customRecup.excessMs / 3600000).toFixed(2)} h de récupération.`
            : ""
        }
        actions={[
          {
            key: "confirm",
            label: "Planifier la récupération",
            onSelect: () => confirmCustomRecup(),
            disabled: !customRecupDate,
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setCustomRecup(null),
          },
        ]}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-recup-date">Date</Label>
            <Input
              id="custom-recup-date"
              type="date"
              value={customRecupDate}
              onChange={(e) => setCustomRecupDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-recup-time">
              Heure de début{" "}
              <span className="text-xs text-muted-foreground">
                (optionnelle)
              </span>
            </Label>
            <Input
              id="custom-recup-time"
              type="time"
              value={customRecupTime}
              onChange={(e) => setCustomRecupTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Sans heure, la récupération sera placée automatiquement dans les
              créneaux libres de la journée.
            </p>
          </div>
        </div>
      </ChoiceDialog>
    </div>
  );
}
