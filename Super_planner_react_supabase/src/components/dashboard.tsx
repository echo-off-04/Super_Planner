import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ContractSettings,
  DefaultWeekSettings,
  Profile,
  ProtectedActivityType,
  RestDay,
  RestRules,
  Vacation,
} from "@/lib/supabase";
import {
  buildProtectedTypeSet,
  isActivityProtected,
  isDateInVacations,
  vacationIsoSet,
} from "@/lib/supabase";
import { DEFAULT_WEEK_FALLBACK } from "@/lib/supabase";
import type { RestPeriod } from "@/lib/supabase";
import { overlapMinutes, restRangesForPeriod } from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/supabase";
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
  Clock,
  Download,
  LogOut,
  Plus,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { CustomView } from "./custom-view";
import { DayView } from "./day-view";
import { StatsCards } from "./stats-cards";
import { ActivityDialog } from "./activity-dialog";
import { SettingsDialog } from "./settings-dialog";
import { ModeToggle } from "./mode-toggle";
import { ChoiceDialog } from "./choice-dialog";
import { dailyUsedHours, sameDay, weekTotalHours } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildHolidayMap,
  countSpecialDayCredit,
  getFrenchHolidaysInRange,
} from "@/lib/holidays";

interface Props {
  user: User;
}

export function Dashboard({ user }: Props) {
  const [view, setView] = useState<"day" | "week" | "month" | "custom">(
    "week"
  );
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
  const [protectedTypes, setProtectedTypes] = useState<
    ProtectedActivityType[]
  >([]);
  const protectedTypeSet = useMemo(
    () => buildProtectedTypeSet(protectedTypes),
    [protectedTypes]
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
    nextWorkIso?: string | null;
  } | null>(null);
  const [weekOverload, setWeekOverload] = useState<{
    weekStart: Date;
    weekEnd: Date;
    excessHours: number;
    savedId?: string;
  } | null>(null);
  const [recupOverwrite, setRecupOverwrite] = useState<{
    dayDate: Date;
    totalMs: number;
    targetIso: string;
  } | null>(null);
  const recupBusyRef = useRef(false);
  const [customRecup, setCustomRecup] = useState<{
    sourceDate: Date;
    excessMs: number;
    external?: boolean;
    externalTag?: string;
  } | null>(null);
  const [customRecupDate, setCustomRecupDate] = useState("");
  const [customRecupTime, setCustomRecupTime] = useState("");
  const [externalRecupOpen, setExternalRecupOpen] = useState(false);
  const [externalRecupHours, setExternalRecupHours] = useState("");
  const [externalRecupMinutes, setExternalRecupMinutes] = useState("");
  const [pendingHolidayActivity, setPendingHolidayActivity] = useState<{
    date: Date;
    name: string;
  } | null>(null);
  const [pendingVacationActivity, setPendingVacationActivity] = useState<{
    date: Date;
    label: string;
  } | null>(null);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [customRange, setCustomRange] = useState<{
    start: Date;
    end: Date;
  }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  });

  const rangeStart = useMemo(() => {
    if (view === "day") {
      const d = addDays(cursor, -1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (view === "week") return startOfWeek(cursor);
    if (view === "custom") {
      const d = addDays(customRange.start, -1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  }, [cursor, view, customRange]);

  const rangeEnd = useMemo(() => {
    if (view === "day") {
      const d = new Date(cursor);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    if (view === "week") return endOfWeek(cursor);
    if (view === "custom") {
      const d = new Date(customRange.end);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    const firstNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return endOfWeek(addDays(firstNext, -1));
  }, [cursor, view, customRange]);

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
    if (view === "custom") {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
  }, [cursor, view, customRange]);

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
    if (view === "custom") {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [cursor, view, customRange]);

  const kpiHolidaysList = useMemo(
    () => getFrenchHolidaysInRange(kpiHolidayRange.start, kpiHolidayRange.end),
    [kpiHolidayRange.start, kpiHolidayRange.end]
  );

  const kpiSpecialCredit = useMemo(() => {
    const tpl = defaultWeek ?? { ...DEFAULT_WEEK_FALLBACK, id: "", user_id: user.id };
    const breakHours = (tpl.break_minutes ?? 60) / 60;
    const dailyMax = contract?.daily_max_hours ?? 8;
    const effectiveDailyHours = Math.max(0, dailyMax - breakHours);
    return countSpecialDayCredit({
      effectiveDailyHours,
      restDays: tpl.rest_days,
      holidays: kpiHolidaysList,
      vacations,
      sickRestDays: kpiRestDays,
      rangeStart: kpiHolidayRange.start,
      rangeEnd: kpiHolidayRange.end,
    });
  }, [
    contract,
    defaultWeek,
    kpiHolidaysList,
    kpiHolidayRange.start,
    kpiHolidayRange.end,
    user.id,
    vacations,
    kpiRestDays,
  ]);

  const loadData = useCallback(async () => {
    const startIso = rangeStart.toISOString();
    const endIso = rangeEnd.toISOString();
    const [actRes, restRes] = await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", startIso)
        .lte("start_time", endIso)
        .order("start_time"),
      supabase
        .from("rest_days")
        .select("*")
        .eq("user_id", user.id)
        .gte("rest_date", formatDateISO(rangeStart))
        .lte("rest_date", formatDateISO(rangeEnd)),
    ]);
    setActivities((actRes.data as Activity[]) ?? []);
    setRestDays((restRes.data as RestDay[]) ?? []);

    const kpiRes = await supabase
      .from("rest_days")
      .select("*")
      .eq("user_id", user.id)
      .gte("rest_date", formatDateISO(kpiRestRange.start))
      .lte("rest_date", formatDateISO(kpiRestRange.end));
    setKpiRestDays((kpiRes.data as RestDay[]) ?? []);
  }, [user.id, rangeStart, rangeEnd, kpiRestRange.start, kpiRestRange.end]);

  const loadSettings = useCallback(async () => {
    const [contractRes, rulesRes, profileRes, defaultWeekRes] =
      await Promise.all([
        supabase
          .from("contract_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("rest_rules")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("default_week_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    if (!profileRes.data) {
      const { data } = await supabase
        .from("profiles")
        .insert({ id: user.id, full_name: "", role: "logisticien" })
        .select()
        .maybeSingle();
      setProfile(data as Profile);
    } else {
      setProfile(profileRes.data as Profile);
    }

    if (!contractRes.data) {
      const { data } = await supabase
        .from("contract_settings")
        .insert({ user_id: user.id })
        .select()
        .maybeSingle();
      setContract(data as ContractSettings);
    } else {
      setContract(contractRes.data as ContractSettings);
    }

    if (!rulesRes.data) {
      const { data } = await supabase
        .from("rest_rules")
        .insert({ user_id: user.id })
        .select()
        .maybeSingle();
      setRules(data as RestRules);
    } else {
      setRules(rulesRes.data as RestRules);
    }

    if (!defaultWeekRes.data) {
      const { data } = await supabase
        .from("default_week_settings")
        .insert({ user_id: user.id })
        .select()
        .maybeSingle();
      setDefaultWeek(data as DefaultWeekSettings);
    } else {
      setDefaultWeek(defaultWeekRes.data as DefaultWeekSettings);
    }

    const vacRes = await supabase
      .from("vacations")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true });
    setVacations((vacRes.data as Vacation[]) ?? []);

    const protectedRes = await supabase
      .from("protected_activity_types")
      .select("*")
      .eq("user_id", user.id)
      .order("activity_type", { ascending: true });
    let protectedRows = (protectedRes.data as ProtectedActivityType[]) ?? [];
    if (protectedRows.length === 0) {
      const { data: inserted } = await supabase
        .from("protected_activity_types")
        .insert({ user_id: user.id, activity_type: "prestation" })
        .select()
        .maybeSingle();
      if (inserted) protectedRows = [inserted as ProtectedActivityType];
    }
    setProtectedTypes(protectedRows);
  }, [user.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  function navigate(dir: -1 | 0 | 1) {
    if (view === "custom") {
      if (dir === 0) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setCustomRange({ start, end });
        return;
      }
      const lengthDays =
        Math.round(
          (customRange.end.getTime() - customRange.start.getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;
      const start = addDays(customRange.start, dir * lengthDays);
      const end = addDays(customRange.end, dir * lengthDays);
      setCustomRange({ start, end });
      return;
    }
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
    if (view === "custom") {
      const s = customRange.start;
      const e = customRange.end;
      const startStr = `${s.getDate()} ${MONTH_LABELS[s.getMonth()].slice(0, 4)}.`;
      const endStr = `${e.getDate()} ${MONTH_LABELS[e.getMonth()].slice(0, 4)}. ${e.getFullYear()}`;
      return `${startStr} – ${endStr}`;
    }
    return `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [view, cursor, weekStart, weekEnd, customRange]);

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
    if (existing) {
      await supabase
        .from("rest_days")
        .update({
          status: "validated",
          reason: "Validé manuellement",
          rest_period: period,
          kind: "regular",
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("rest_days").insert({
        user_id: user.id,
        rest_date: iso,
        status: "validated",
        reason: "Validé manuellement",
        rest_period: period,
        kind: "regular",
      });
    }
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

  function residualActivitiesInPeriod(
    date: Date,
    period: RestPeriod
  ): Activity[] {
    const ranges = restRangesForPeriod(period, defaultWeek);
    return activities.filter((a) => {
      if (!sameDay(new Date(a.start_time), date)) return false;
      if (a.activity_type !== "pause" && a.activity_type !== "recuperation")
        return false;
      const s = new Date(a.start_time);
      const e = new Date(a.end_time);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      return ranges.some(
        (r) => overlapMinutes(sMin, eMin, r.startMin, r.endMin) > 0
      );
    });
  }

  async function clearResidualInPeriod(date: Date, period: RestPeriod) {
    const residual = residualActivitiesInPeriod(date, period);
    if (residual.length === 0) return;
    await supabase
      .from("activities")
      .delete()
      .in(
        "id",
        residual.map((a) => a.id)
      );
  }

  async function applyRestWithPeriod(date: Date, period: RestPeriod) {
    const conflicting = activitiesOverlappingPeriod(date, period);
    if (conflicting.length > 0) {
      setRestConflict({ date, period, activities: conflicting });
      return;
    }
    await clearResidualInPeriod(date, period);
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
      supabase
        .from("rest_days")
        .delete()
        .eq("id", existing.id)
        .then(() => loadData());
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
    const residual = residualActivitiesInPeriod(
      restConflict.date,
      restConflict.period
    );
    const ids = [
      ...restConflict.activities.map((a) => a.id),
      ...residual.map((a) => a.id),
    ];
    await supabase.from("activities").delete().in("id", ids);
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
      return supabase
        .from("activities")
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq("id", a.id);
    });
    await Promise.all(updates);
    await clearResidualInPeriod(restConflict.date, restConflict.period);
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
        await supabase
          .from("activities")
          .delete()
          .in(
            "id",
            deletableActivities.map((a) => a.id)
          );
      }
      const deletableRestIsos = Array.from(existingRestIsoSet).filter(
        (iso) => !isProtectedIso(iso)
      );
      if (deletableRestIsos.length > 0) {
        await supabase
          .from("rest_days")
          .delete()
          .eq("user_id", user.id)
          .in("rest_date", deletableRestIsos);
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

    const activityInserts: Array<Record<string, unknown>> = [];
    const restInserts: Array<Record<string, unknown>> = [];
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
          duration_kind: "custom",
          break_minutes: 0,
        });
      }
    }

    if (restDatesToClear.length > 0) {
      await supabase
        .from("rest_days")
        .delete()
        .eq("user_id", user.id)
        .in("rest_date", restDatesToClear);
    }
    if (activityInserts.length > 0) {
      await supabase.from("activities").insert(activityInserts);
    }
    if (restInserts.length > 0) {
      await supabase.from("rest_days").insert(restInserts);
    }
    loadData();
    toast.success("Semaine par défaut appliquée.");
  }

  function recupSourceTag(d: Date): string {
    return `recup-source:${formatDateISO(d)}`;
  }

  async function deleteRecupsForSource(sourceDate: Date) {
    await supabase
      .from("activities")
      .delete()
      .eq("user_id", user.id)
      .eq("activity_type", "recuperation")
      .eq("notes", recupSourceTag(sourceDate));
  }

  function mergeRecupInserts(
    items: Array<Record<string, unknown>>
  ): Array<Record<string, unknown>> {
    const recups = items
      .filter((i) => i.activity_type === "recuperation")
      .map((i) => ({
        start: new Date(i.start_time as string).getTime(),
        end: new Date(i.end_time as string).getTime(),
        raw: i,
      }))
      .sort((a, b) => a.start - b.start);
    const others = items.filter((i) => i.activity_type !== "recuperation");
    const merged: Array<{ start: number; end: number; raw: Record<string, unknown> }> = [];
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

  function parseTimeMin(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  function pauseDurationHours(): number {
    const tpl = defaultWeek ?? DEFAULT_WEEK_FALLBACK;
    if (!tpl.pause_start || !tpl.pause_end) return 0;
    const dur = parseTimeMin(tpl.pause_end) - parseTimeMin(tpl.pause_start);
    return Math.max(0, dur / 60);
  }

  function getPauseWindowForDate(
    date: Date
  ): { start: number; end: number } | null {
    const tpl = defaultWeek ?? DEFAULT_WEEK_FALLBACK;
    if (!tpl.pause_start || !tpl.pause_end) return null;
    const sMin = parseTimeMin(tpl.pause_start);
    const eMin = parseTimeMin(tpl.pause_end);
    if (eMin <= sMin) return null;
    const s = new Date(date);
    s.setHours(Math.floor(sMin / 60), sMin % 60, 0, 0);
    const e = new Date(date);
    e.setHours(Math.floor(eMin / 60), eMin % 60, 0, 0);
    return { start: s.getTime(), end: e.getTime() };
  }

  function makePauseInsert(
    s: number,
    e: number
  ): Record<string, unknown> {
    return {
      user_id: user.id,
      title: "Pause",
      activity_type: "pause",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: "",
      source: "manual",
      duration_kind: "custom",
      break_minutes: 0,
    };
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
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", day.toISOString())
      .lte("start_time", dayEnd.toISOString());
    const dayActs = (data as Activity[]) ?? [];
    const maxDaily = contract?.daily_max_hours ?? 8;
    const hours = dailyUsedHours(dayActs);
    const hasPause = dayActs.some((a) => a.activity_type === "pause");
    const pauseDur = pauseDurationHours();
    const threshold = hasPause ? maxDaily : maxDaily - pauseDur;
    if (hours > threshold + 1e-6) {
      const nextWorkIso = await findNextWorkingDayIso(addDays(day, 1));
      setOverload({
        date: day,
        excessHours: hours - threshold,
        savedId: info.savedId,
        nextWorkIso,
      });
      return;
    }

    const weekStart = startOfWeek(day);
    const weekEnd = endOfWeek(weekStart);
    const weekStartIso = new Date(weekStart);
    weekStartIso.setHours(0, 0, 0, 0);
    const weekEndIso = new Date(weekEnd);
    weekEndIso.setHours(23, 59, 59, 999);
    const { data: weekData } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", weekStartIso.toISOString())
      .lte("start_time", weekEndIso.toISOString());
    const weekActs = (weekData as Activity[]) ?? [];
    const weeklyTarget = contract?.weekly_hours ?? 35;
    const worked = weekTotalHours(weekActs);
    const tpl =
      defaultWeek ?? { ...DEFAULT_WEEK_FALLBACK, id: "", user_id: user.id };
    const breakHours = (tpl.break_minutes ?? 60) / 60;
    const dailyMax = contract?.daily_max_hours ?? 8;
    const effectiveDailyHours = Math.max(0, dailyMax - breakHours);
    const weekHolidays = getFrenchHolidaysInRange(weekStart, weekEnd);
    const { data: sickData } = await supabase
      .from("rest_days")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "validated")
      .eq("kind", "sick")
      .gte("rest_date", formatDateISO(weekStart))
      .lte("rest_date", formatDateISO(weekEnd));
    const weekSickRange = (sickData as RestDay[]) ?? [];
    const credit = countSpecialDayCredit({
      effectiveDailyHours,
      restDays: tpl.rest_days,
      holidays: weekHolidays,
      vacations,
      sickRestDays: weekSickRange,
      rangeStart: weekStart,
      rangeEnd: weekEnd,
    });
    const creditTotal =
      credit.holiday.hours + credit.vacation.hours + credit.sick.hours;
    const adjustedTarget = Math.max(0, weeklyTarget - creditTotal);
    if (worked > adjustedTarget + 1e-6) {
      setWeekOverload({
        weekStart,
        weekEnd,
        excessHours: worked - adjustedTarget,
        savedId: info.savedId,
      });
    }
  }

  async function reduceSavedActivity() {
    if (!overload) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runReduceSavedActivity();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runReduceSavedActivity() {
    if (!overload) return;
    const hoursToRemove = overload.excessHours;
    const day = overload.date;
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", day.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .order("start_time");
    const acts = (data as Activity[]) ?? [];
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
      await supabase.from("activities").delete().eq("id", target.id);
    } else {
      await supabase
        .from("activities")
        .update({ end_time: new Date(newEnd).toISOString() })
        .eq("id", target.id);
    }
    setOverload(null);
    toast.success("Activité réduite pour respecter la limite journalière.");
    loadData();
  }

  async function reduceWeekSavedActivity() {
    if (!weekOverload) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runReduceWeekSavedActivity();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runReduceWeekSavedActivity() {
    if (!weekOverload) return;
    const { weekStart, weekEnd, excessHours, savedId } = weekOverload;
    const startIso = new Date(weekStart);
    startIso.setHours(0, 0, 0, 0);
    const endIso = new Date(weekEnd);
    endIso.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", startIso.toISOString())
      .lte("start_time", endIso.toISOString())
      .order("start_time");
    const weekActs = (data as Activity[]) ?? [];
    let target: Activity | undefined;
    if (savedId) target = weekActs.find((a) => a.id === savedId);
    if (!target) {
      target = [...weekActs]
        .reverse()
        .find(
          (a) =>
            a.activity_type !== "pause" && a.activity_type !== "recuperation"
        );
    }
    if (!target) {
      setWeekOverload(null);
      return;
    }
    const start = new Date(target.start_time).getTime();
    const end = new Date(target.end_time).getTime();
    const newEnd = end - excessHours * 3600 * 1000;
    if (newEnd <= start) {
      await supabase.from("activities").delete().eq("id", target.id);
    } else {
      await supabase
        .from("activities")
        .update({ end_time: new Date(newEnd).toISOString() })
        .eq("id", target.id);
    }
    setWeekOverload(null);
    toast.success("Activité réduite pour respecter l'objectif hebdomadaire.");
    loadData();
  }

  async function findNextWorkingDayIso(fromDay: Date): Promise<string | null> {
    const tryLimit = 60;
    const cursor = new Date(fromDay);
    cursor.setHours(0, 0, 0, 0);
    const fromIso = formatDateISO(cursor);
    const untilDate = addDays(cursor, tryLimit);
    const untilIso = formatDateISO(untilDate);
    const { data: restData } = await supabase
      .from("rest_days")
      .select("rest_date, status, rest_period")
      .eq("user_id", user.id)
      .gte("rest_date", fromIso)
      .lte("rest_date", untilIso);
    const fullRestSet = new Set(
      ((restData as RestDay[]) ?? [])
        .filter(
          (r) => r.status === "validated" && r.rest_period === "full_day"
        )
        .map((r) => r.rest_date)
    );
    for (let i = 0; i < tryLimit; i++) {
      const d = addDays(cursor, i);
      const iso = formatDateISO(d);
      if (fullRestSet.has(iso)) continue;
      if (isDateInVacations(iso, vacations)) continue;
      if (holidaysMap.get(iso)) continue;
      return iso;
    }
    return null;
  }

  async function scheduleWeeklyRecuperation() {
    if (!weekOverload) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runScheduleWeeklyRecuperation();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runScheduleWeeklyRecuperation() {
    if (!weekOverload) return;
    const { weekEnd, excessHours } = weekOverload;
    const excessMs = excessHours * 3600 * 1000;
    await deleteRecupsForSource(weekEnd);
    const searchStart = addDays(weekEnd, 1);
    const targetIso = await findNextWorkingDayIso(searchStart);
    if (!targetIso) {
      toast.error(
        "Aucun jour ouvrable disponible dans les prochaines semaines pour planifier la récupération."
      );
      return;
    }
    const targetDate = new Date(targetIso + "T00:00:00");
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);
    const { data: dayData } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .order("start_time");
    const dayActs = ((dayData as Activity[]) ?? []).slice();

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
    const winStart = new Date(targetDate);
    winStart.setHours(Math.floor(winStartMin / 60), winStartMin % 60, 0, 0);
    const winEnd = new Date(targetDate);
    winEnd.setHours(Math.floor(winEndMin / 60), winEndMin % 60, 0, 0);

    const occupied = dayActs
      .map((a) => ({
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    const inserts: Array<Record<string, unknown>> = [];
    let remaining = excessMs;
    let cursor = winStart.getTime();
    const windowEnd = winEnd.getTime();

    const sourceTag = recupSourceTag(weekEnd);
    const makeRecup = (s: number, e: number) => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: sourceTag,
      source: "recuperation",
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
      toast.error(
        `Impossible de placer ${(remaining / 3600000).toFixed(2)} h sur le ${formatDateISO(targetDate)}. Choisissez une autre date.`
      );
      return;
    }

    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await supabase.from("activities").insert(finalInserts);
    }
    setWeekOverload(null);
    toast.success(
      `Récupération planifiée le ${formatDateISO(targetDate)}.`
    );
    loadData();
  }

  function openCustomWeeklyRecup() {
    if (!weekOverload) return;
    const next = addDays(weekOverload.weekEnd, 1);
    setCustomRecup({
      sourceDate: weekOverload.weekEnd,
      excessMs: weekOverload.excessHours * 3600 * 1000,
    });
    setCustomRecupDate(formatDateISO(next));
    setCustomRecupTime("");
    setWeekOverload(null);
  }

  async function scheduleRecuperation() {
    if (!overload) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runScheduleRecuperation();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runScheduleRecuperation() {
    if (!overload) return;
    const dayDate = overload.date;
    const excessMs = overload.excessHours * 3600 * 1000;
    const targetIso =
      overload.nextWorkIso ??
      (await findNextWorkingDayIso(addDays(dayDate, 1)));
    if (!targetIso) {
      toast.error(
        "Aucun jour ouvrable disponible dans les prochaines semaines pour planifier la récupération."
      );
      setOverload(null);
      return;
    }
    const nextDay = new Date(targetIso + "T00:00:00");

    await deleteRecupsForSource(dayDate);

    const nextStart = new Date(nextDay);
    nextStart.setHours(0, 0, 0, 0);
    const nextEnd = new Date(nextDay);
    nextEnd.setHours(23, 59, 59, 999);
    const { data: nda } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", nextStart.toISOString())
      .lte("start_time", nextEnd.toISOString())
      .order("start_time");
    const nextActs = ((nda as Activity[]) ?? []).slice();

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

    const hasPauseNext = nextActs.some((a) => a.activity_type === "pause");
    const pauseWinNext = hasPauseNext ? null : getPauseWindowForDate(nextDay);
    const occupied: Array<{ start: number; end: number; isPauseSlot: boolean }> =
      nextActs.map((a) => ({
        start: new Date(a.start_time).getTime(),
        end: new Date(a.end_time).getTime(),
        isPauseSlot: false,
      }));
    if (pauseWinNext) {
      occupied.push({
        start: pauseWinNext.start,
        end: pauseWinNext.end,
        isPauseSlot: true,
      });
    }
    occupied.sort((a, b) => a.start - b.start);

    const inserts: Array<Record<string, unknown>> = [];
    let remaining = excessMs;
    let cursor = winStart.getTime();
    const windowEnd = winEnd.getTime();

    const sourceTag = recupSourceTag(dayDate);
    const makeRecup = (s: number, e: number) => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: sourceTag,
      source: "recuperation",
      duration_kind: "custom",
      break_minutes: 0,
    });
    let placedBeforePause = false;
    let placedAfterPause = false;
    const pushRecup = (s: number, e: number) => {
      if (e <= s) return;
      inserts.push(makeRecup(s, e));
      if (pauseWinNext) {
        if (e <= pauseWinNext.start) placedBeforePause = true;
        else if (s >= pauseWinNext.end) placedAfterPause = true;
      }
    };

    for (const occ of occupied) {
      if (remaining <= 0 || cursor >= windowEnd) break;
      if (occ.end <= cursor) continue;
      if (occ.start > cursor) {
        const gapEnd = Math.min(occ.start, windowEnd);
        const slotMs = Math.min(remaining, gapEnd - cursor);
        if (slotMs > 0) {
          pushRecup(cursor, cursor + slotMs);
          remaining -= slotMs;
        }
      }
      cursor = Math.max(cursor, occ.end);
    }
    if (remaining > 0 && cursor < windowEnd) {
      const slotMs = Math.min(remaining, windowEnd - cursor);
      pushRecup(cursor, cursor + slotMs);
      remaining -= slotMs;
    }
    if (pauseWinNext && placedBeforePause && placedAfterPause) {
      inserts.push(makePauseInsert(pauseWinNext.start, pauseWinNext.end));
    }

    if (remaining > 0) {
      const blockers = nextActs.filter(
        (a) =>
          a.activity_type !== "pause" && a.activity_type !== "recuperation"
      );
      const allBlockersProtected =
        blockers.length > 0 &&
        blockers.every((a) => isActivityProtected(a, protectedTypeSet));
      if (allBlockersProtected) {
        toast.error(
          "Récupération automatique impossible : les activités protégées du jour cible occupent la fenêtre de travail. Choisissez une autre option."
        );
        return;
      }
      setOverload(null);
      setRecupOverwrite({
        dayDate,
        totalMs: excessMs,
        targetIso,
      });
      return;
    }

    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await supabase.from("activities").insert(finalInserts);
    }
    setOverload(null);
    toast.success("Récupération planifiée.");
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

  function openExternalRecup() {
    setExternalRecupHours("");
    setExternalRecupMinutes("");
    setExternalRecupOpen(true);
  }

  function confirmExternalRecupHours() {
    const h = parseInt(externalRecupHours || "0", 10);
    const m = parseInt(externalRecupMinutes || "0", 10);
    const totalMs = (h * 60 + m) * 60 * 1000;
    if (!Number.isFinite(totalMs) || totalMs <= 0) {
      toast.error("Renseignez une durée valide.");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = addDays(today, 1);
    setExternalRecupOpen(false);
    setCustomRecup({
      sourceDate: today,
      excessMs: totalMs,
      external: true,
      externalTag: `recup-source:external:${Date.now()}`,
    });
    setCustomRecupDate(formatDateISO(next));
    setCustomRecupTime("");
  }

  async function confirmCustomRecup() {
    if (!customRecup) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runConfirmCustomRecup();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runConfirmCustomRecup() {
    if (!customRecup) return;
    const { excessMs, sourceDate, external, externalTag } = customRecup;
    if (!external) {
      await deleteRecupsForSource(sourceDate);
    }
    if (!customRecupDate) {
      toast.error("Veuillez choisir une date.");
      return;
    }
    const target = new Date(customRecupDate + "T00:00:00");

    const { data: restData } = await supabase
      .from("rest_days")
      .select("*")
      .eq("user_id", user.id)
      .eq("rest_date", customRecupDate)
      .eq("status", "validated")
      .maybeSingle();
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
    const { data: dayData } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .order("start_time");
    const dayActs = (dayData as Activity[]) ?? [];

    const inserts: Array<Record<string, unknown>> = [];
    const sourceTag = external
      ? (externalTag ?? `recup-source:external:${Date.now()}`)
      : recupSourceTag(sourceDate);
    const makeRecup = (s: number, e: number) => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(s).toISOString(),
      end_time: new Date(e).toISOString(),
      location: "",
      notes: sourceTag,
      source: "recuperation",
      duration_kind: "custom",
      break_minutes: 0,
    });

    if (customRecupTime) {
      const [hh, mm] = customRecupTime.split(":").map(Number);
      const startDate = new Date(target);
      startDate.setHours(hh ?? 0, mm ?? 0, 0, 0);
      const startMs = startDate.getTime();
      const endMs = startMs + excessMs;
      const hasPause = dayActs.some((a) => a.activity_type === "pause");
      const pauseWin = hasPause ? null : getPauseWindowForDate(target);
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
      let recupIntervals: Array<{ start: number; end: number }> = [
        { start: startMs, end: endMs },
      ];
      let pauseInserted = false;
      if (
        pauseWin &&
        startMs < pauseWin.end &&
        endMs > pauseWin.start
      ) {
        const before =
          startMs < pauseWin.start
            ? { start: startMs, end: pauseWin.start }
            : null;
        const after =
          endMs > pauseWin.end ? { start: pauseWin.end, end: endMs } : null;
        recupIntervals = [];
        if (before) recupIntervals.push(before);
        if (after) recupIntervals.push(after);
        if (before && after) {
          inserts.push(makePauseInsert(pauseWin.start, pauseWin.end));
          pauseInserted = true;
        }
      }
      const placedMs = recupIntervals.reduce(
        (s, r) => s + (r.end - r.start),
        0
      );
      if (pauseInserted && placedMs < excessMs - 1e-3) {
        let extraNeeded = excessMs - placedMs;
        const lastEnd = recupIntervals.length
          ? recupIntervals[recupIntervals.length - 1].end
          : endMs;
        let cursor = Math.max(lastEnd, pauseWin!.end);
        const dayBoundaryEnd = new Date(target);
        dayBoundaryEnd.setHours(23, 59, 59, 999);
        const sortedActs = dayActs
          .map((a) => ({
            start: new Date(a.start_time).getTime(),
            end: new Date(a.end_time).getTime(),
          }))
          .filter((a) => a.end > cursor)
          .sort((a, b) => a.start - b.start);
        for (const occ of sortedActs) {
          if (extraNeeded <= 0) break;
          if (occ.end <= cursor) continue;
          if (occ.start > cursor) {
            const slot = Math.min(extraNeeded, occ.start - cursor);
            recupIntervals.push({ start: cursor, end: cursor + slot });
            extraNeeded -= slot;
            cursor += slot;
          }
          cursor = Math.max(cursor, occ.end);
        }
        if (extraNeeded > 0 && cursor < dayBoundaryEnd.getTime()) {
          const slot = Math.min(
            extraNeeded,
            dayBoundaryEnd.getTime() - cursor
          );
          recupIntervals.push({ start: cursor, end: cursor + slot });
          extraNeeded -= slot;
        }
        if (extraNeeded > 0) {
          toast.error(
            "Pas assez d'espace après la pause pour planifier toute la récupération. Modifiez l'heure ou la date."
          );
          return;
        }
      }
      for (const r of recupIntervals) {
        inserts.push(makeRecup(r.start, r.end));
      }
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

      const hasPause = dayActs.some((a) => a.activity_type === "pause");
      const pauseWin = hasPause ? null : getPauseWindowForDate(target);
      const occupied = dayActs
        .map((a) => ({
          start: new Date(a.start_time).getTime(),
          end: new Date(a.end_time).getTime(),
          isPauseSlot: false,
        }));
      if (pauseWin) {
        occupied.push({
          start: pauseWin.start,
          end: pauseWin.end,
          isPauseSlot: true,
        });
      }
      occupied.sort((a, b) => a.start - b.start);

      let remaining = excessMs;
      let cursor = winStart.getTime();
      const windowEnd = winEnd.getTime();
      let placedBeforePause = false;
      let placedAfterPause = false;
      const placeRecup = (s: number, e: number) => {
        if (e > s) {
          inserts.push(makeRecup(s, e));
          if (pauseWin) {
            if (e <= pauseWin.start) placedBeforePause = true;
            else if (s >= pauseWin.end) placedAfterPause = true;
          }
        }
      };

      for (const occ of occupied) {
        if (remaining <= 0 || cursor >= windowEnd) break;
        if (occ.end <= cursor) continue;
        if (occ.start > cursor) {
          const gapEnd = Math.min(occ.start, windowEnd);
          const slotMs = Math.min(remaining, gapEnd - cursor);
          if (slotMs > 0) {
            placeRecup(cursor, cursor + slotMs);
            remaining -= slotMs;
          }
        }
        cursor = Math.max(cursor, occ.end);
      }
      if (remaining > 0 && cursor < windowEnd) {
        const slotMs = Math.min(remaining, windowEnd - cursor);
        placeRecup(cursor, cursor + slotMs);
        remaining -= slotMs;
      }

      if (remaining > 0) {
        toast.error(
          `Impossible de placer ${(remaining / 3600000).toFixed(2)} h dans la fenêtre de travail. Choisissez une heure précise ou une autre date.`
        );
        return;
      }
      if (pauseWin && placedBeforePause && placedAfterPause) {
        inserts.push(makePauseInsert(pauseWin.start, pauseWin.end));
      }
    }

    const finalInserts = mergeRecupInserts(inserts);
    if (finalInserts.length > 0) {
      await supabase.from("activities").insert(finalInserts);
    }
    setCustomRecup(null);
    toast.success("Récupération planifiée.");
    loadData();
  }

  async function confirmRecupOverwrite() {
    if (!recupOverwrite) return;
    if (recupBusyRef.current) return;
    recupBusyRef.current = true;
    try {
      await runConfirmRecupOverwrite();
    } finally {
      recupBusyRef.current = false;
    }
  }

  async function runConfirmRecupOverwrite() {
    if (!recupOverwrite) return;
    const { dayDate, totalMs, targetIso } = recupOverwrite;
    await deleteRecupsForSource(dayDate);

    const nextDay = new Date(targetIso + "T00:00:00");
    const nextStart = new Date(nextDay);
    nextStart.setHours(0, 0, 0, 0);
    const nextEnd = new Date(nextDay);
    nextEnd.setHours(23, 59, 59, 999);
    const { data: nda } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", nextStart.toISOString())
      .lte("start_time", nextEnd.toISOString())
      .order("start_time");
    const nextActs = ((nda as Activity[]) ?? []).slice();

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
    const winStartMs = winStart.getTime();
    const winEndMs = winEnd.getTime();

    const isProtected = (a: Activity) =>
      a.activity_type === "pause" ||
      a.activity_type === "recuperation" ||
      isActivityProtected(a, protectedTypeSet);

    const protectedSegs = nextActs
      .filter(isProtected)
      .map((a) => ({
        start: Math.max(winStartMs, new Date(a.start_time).getTime()),
        end: Math.min(winEndMs, new Date(a.end_time).getTime()),
      }))
      .filter((p) => p.end > p.start)
      .sort((a, b) => a.start - b.start);

    const recupSegments: Array<{ start: number; end: number }> = [];
    let remaining = totalMs;
    let cursor = winStartMs;
    for (const p of protectedSegs) {
      if (remaining <= 0 || cursor >= winEndMs) break;
      if (p.end <= cursor) continue;
      if (p.start > cursor) {
        const take = Math.min(p.start - cursor, remaining);
        if (take > 0) {
          recupSegments.push({ start: cursor, end: cursor + take });
          remaining -= take;
          cursor += take;
        }
      }
      cursor = Math.max(cursor, p.end);
    }
    if (remaining > 0 && cursor < winEndMs) {
      const take = Math.min(winEndMs - cursor, remaining);
      recupSegments.push({ start: cursor, end: cursor + take });
      remaining -= take;
    }

    if (remaining > 0) {
      toast.error(
        "Récupération automatique impossible : les activités protégées du jour cible occupent la fenêtre de travail. Choisissez une autre option."
      );
      setRecupOverwrite(null);
      setOverload({
        date: dayDate,
        excessHours: totalMs / 3600000,
        nextWorkIso: targetIso,
      });
      return;
    }

    const mergedRecups: Array<{ start: number; end: number }> = [];
    for (const r of recupSegments) {
      const last = mergedRecups[mergedRecups.length - 1];
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        mergedRecups.push({ ...r });
      }
    }

    const deletes: string[] = [];
    const replacementInserts: Array<Record<string, unknown>> = [];
    for (const a of nextActs) {
      if (isProtected(a)) continue;
      const s = new Date(a.start_time).getTime();
      const e = new Date(a.end_time).getTime();
      let intervals: Array<{ start: number; end: number }> = [{ start: s, end: e }];
      for (const r of mergedRecups) {
        const next: typeof intervals = [];
        for (const iv of intervals) {
          if (r.end <= iv.start || r.start >= iv.end) {
            next.push(iv);
          } else {
            if (r.start > iv.start) next.push({ start: iv.start, end: r.start });
            if (r.end < iv.end) next.push({ start: r.end, end: iv.end });
          }
        }
        intervals = next;
      }
      if (
        intervals.length === 1 &&
        intervals[0].start === s &&
        intervals[0].end === e
      ) {
        continue;
      }
      deletes.push(a.id);
      for (const iv of intervals) {
        replacementInserts.push({
          user_id: user.id,
          title: a.title,
          activity_type: a.activity_type,
          start_time: new Date(iv.start).toISOString(),
          end_time: new Date(iv.end).toISOString(),
          location: a.location ?? "",
          notes: a.notes ?? "",
          source: a.source ?? "manual",
          duration_kind: a.duration_kind ?? "custom",
          break_minutes: 0,
        });
      }
    }

    const sourceTag = recupSourceTag(dayDate);
    const recupInserts = mergedRecups.map((r) => ({
      user_id: user.id,
      title: "Récupération",
      activity_type: "recuperation",
      start_time: new Date(r.start).toISOString(),
      end_time: new Date(r.end).toISOString(),
      location: "",
      notes: sourceTag,
      source: "recuperation",
      duration_kind: "custom",
      break_minutes: 0,
    }));

    if (deletes.length > 0) {
      await supabase.from("activities").delete().in("id", deletes);
    }
    if (replacementInserts.length > 0) {
      await supabase.from("activities").insert(replacementInserts);
    }
    if (recupInserts.length > 0) {
      await supabase.from("activities").insert(recupInserts);
    }
    setRecupOverwrite(null);
    toast.success("Récupération planifiée.");
    loadData();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function importFromApi() {
    const toastId = toast.loading("Import en cours...");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-boku-kumasala`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erreur API");
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
                <DropdownMenuItem onClick={openExternalRecup}>
                  <Clock className="mr-2 h-4 w-4" /> Récupérer des heures externes
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
          specialCredit={kpiSpecialCredit}
          customRange={view === "custom" ? customRange : undefined}
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
            onValueChange={(v) =>
              setView(v as "day" | "week" | "month" | "custom")
            }
          >
            <TabsList>
              <TabsTrigger value="day">Jour</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="custom">Personnalisée</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "day" && (
          <DayView
            date={cursor}
            activities={activities}
            restDays={restDays}
            contract={contract}
            defaultWeek={defaultWeek}
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
          <WeekView
            weekStart={weekStart}
            activities={activities}
            restDays={restDays}
            contract={contract}
            defaultWeek={defaultWeek}
            holidays={holidaysMap}
            vacations={vacationLabelByIso}
            onAddActivity={openNewActivity}
            onEditActivity={openEditActivity}
            onToggleRest={toggleRestDay}
          />
        )}
        {view === "month" && (
          <MonthView
            month={cursor}
            activities={activities}
            restDays={restDays}
            contract={contract}
            holidays={holidaysMap}
            vacations={vacationLabelByIso}
            onSelectDay={(d) => {
              setCursor(d);
              setView("day");
            }}
          />
        )}
        {view === "custom" && (
          <CustomView
            range={customRange}
            onChangeRange={setCustomRange}
            activities={activities}
            restDays={restDays}
            contract={contract}
            holidays={holidaysMap}
            vacations={vacationLabelByIso}
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
            label:
              overload &&
              overload.nextWorkIso &&
              overload.nextWorkIso === formatDateISO(addDays(overload.date, 1))
                ? "Récupérer le lendemain"
                : "Récupérer le prochain jour ouvrable",
            description:
              overload &&
              overload.nextWorkIso &&
              overload.nextWorkIso === formatDateISO(addDays(overload.date, 1))
                ? "Conserve les activités et ajoute des créneaux de récupération le jour suivant."
                : "Conserve les activités et planifie la récupération sur le premier jour sans repos, férié, maladie ni vacances.",
            disabled: overload ? !overload.nextWorkIso : false,
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
        open={weekOverload !== null}
        onOpenChange={(o) => {
          if (!o) setWeekOverload(null);
        }}
        title="Objectif hebdomadaire dépassé"
        description={
          weekOverload
            ? `La semaine du ${formatDateISO(weekOverload.weekStart)} dépasse de ${weekOverload.excessHours.toFixed(2)} h l'objectif hebdomadaire (${contract?.weekly_hours ?? 35} h). Que souhaitez-vous faire ?`
            : ""
        }
        actions={[
          {
            key: "reduce",
            label: "Réduire l'activité",
            description:
              "Raccourcit la dernière activité saisie pour rester dans l'objectif.",
            onSelect: () => reduceWeekSavedActivity(),
          },
          {
            key: "recup-next",
            label: "Récupérer le prochain jour ouvrable",
            description:
              "Planifie la récupération sur le premier jour sans repos, férié, maladie ni vacances.",
            onSelect: () => scheduleWeeklyRecuperation(),
          },
          {
            key: "recup-custom",
            label: "Récupérer un autre jour",
            description:
              "Choisissez la date (et l'heure si souhaité) pour planifier la récupération.",
            onSelect: () => openCustomWeeklyRecup(),
          },
          {
            key: "keep",
            label: "Conserver tel quel",
            variant: "outline",
            onSelect: () => setWeekOverload(null),
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
            ? `Récupération de ${(recupOverwrite.totalMs / 3600000).toFixed(2)} h à planifier. Souhaitez-vous écraser les activités existantes du jour cible (hors pauses) ?`
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
      <ChoiceDialog
        open={externalRecupOpen}
        onOpenChange={(o) => {
          if (!o) setExternalRecupOpen(false);
        }}
        title="Récupérer des heures externes"
        description="Renseignez les heures à récupérer (issues de semaines antérieures non enregistrées)."
        actions={[
          {
            key: "next",
            label: "Suivant",
            onSelect: () => confirmExternalRecupHours(),
            disabled:
              (parseInt(externalRecupHours || "0", 10) || 0) * 60 +
                (parseInt(externalRecupMinutes || "0", 10) || 0) <=
              0,
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setExternalRecupOpen(false),
          },
        ]}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ext-recup-hours">Heures</Label>
            <Input
              id="ext-recup-hours"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={externalRecupHours}
              onChange={(e) => setExternalRecupHours(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ext-recup-minutes">Minutes</Label>
            <Input
              id="ext-recup-minutes"
              type="number"
              min="0"
              max="59"
              step="1"
              inputMode="numeric"
              value={externalRecupMinutes}
              onChange={(e) => setExternalRecupMinutes(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
      </ChoiceDialog>
    </div>
  );
}
