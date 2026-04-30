import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ContractSettings,
  DefaultWeekSettings,
  CustomActivityType,
  Profile,
  ProtectedActivityType,
  RestDay,
  RestPeriod,
  RestRules,
  UserRole,
  Vacation,
} from "@/lib/supabase";
import { ChoiceDialog } from "@/components/choice-dialog";
import {
  TreePalm as Palmtree,
  Plus,
  Thermometer,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ACTIVITY_TAG_PRESETS,
  BUILTIN_ACTIVITY_TYPES,
  DEFAULT_WEEK_FALLBACK,
  ROLE_LABELS,
} from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_LABELS } from "@/lib/time";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  contract: ContractSettings | null;
  rules: RestRules | null;
  profile: Profile | null;
  defaultWeek: DefaultWeekSettings | null;
  onSaved: () => void;
  onApplyDefaultWeek: () => void | Promise<void>;
}

export function SettingsDialog({
  open,
  onOpenChange,
  userId,
  contract,
  rules,
  profile,
  defaultWeek,
  onSaved,
  onApplyDefaultWeek,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("logisticien");
  const [weeklyHours, setWeeklyHours] = useState(35);
  const [dailyMax, setDailyMax] = useState(10);
  const [minRest, setMinRest] = useState(11);
  const [overtimeRate, setOvertimeRate] = useState(1.25);
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 5]);
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [dwRestDays, setDwRestDays] = useState<number[]>(
    DEFAULT_WEEK_FALLBACK.rest_days
  );
  const [dwTitle, setDwTitle] = useState(DEFAULT_WEEK_FALLBACK.default_title);
  const [dwType, setDwType] = useState(DEFAULT_WEEK_FALLBACK.default_type);
  const [dwCreatingType, setDwCreatingType] = useState(false);
  const [dwNewTypeLabel, setDwNewTypeLabel] = useState("");
  const [dwMorningStart, setDwMorningStart] = useState(
    DEFAULT_WEEK_FALLBACK.morning_start
  );
  const [dwMorningEnd, setDwMorningEnd] = useState(
    DEFAULT_WEEK_FALLBACK.morning_end
  );
  const [dwAfternoonStart, setDwAfternoonStart] = useState(
    DEFAULT_WEEK_FALLBACK.afternoon_start
  );
  const [dwAfternoonEnd, setDwAfternoonEnd] = useState(
    DEFAULT_WEEK_FALLBACK.afternoon_end
  );
  const [dwBreakMinutes, setDwBreakMinutes] = useState(
    DEFAULT_WEEK_FALLBACK.break_minutes
  );
  const [dwPauseStart, setDwPauseStart] = useState(
    DEFAULT_WEEK_FALLBACK.pause_start
  );
  const [dwPauseEnd, setDwPauseEnd] = useState(
    DEFAULT_WEEK_FALLBACK.pause_end
  );
  const [saving, setSaving] = useState(false);
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [newVacStart, setNewVacStart] = useState("");
  const [newVacEnd, setNewVacEnd] = useState("");
  const [newVacLabel, setNewVacLabel] = useState("");
  const [vacBusy, setVacBusy] = useState(false);
  const [vacConflict, setVacConflict] = useState<{
    start: string;
    end: string;
    label: string;
    activities: Activity[];
  } | null>(null);

  type SickMode = "single" | "range" | "list";
  const [sickRests, setSickRests] = useState<RestDay[]>([]);
  const [sickMode, setSickMode] = useState<SickMode>("single");
  const [sickSingleDate, setSickSingleDate] = useState("");
  const [sickPeriod, setSickPeriod] = useState<RestPeriod>("full_day");
  const [sickRangeStart, setSickRangeStart] = useState("");
  const [sickRangeEnd, setSickRangeEnd] = useState("");
  const [sickListDraft, setSickListDraft] = useState("");
  const [sickListDates, setSickListDates] = useState<string[]>([]);
  const [sickReason, setSickReason] = useState("");
  const [sickBusy, setSickBusy] = useState(false);
  const [sickConflict, setSickConflict] = useState<{
    entries: { date: string; period: RestPeriod }[];
    reason: string;
    activities: Activity[];
  } | null>(null);
  const [vacationIsoSet, setVacationIsoSet] = useState<Set<string>>(new Set());

  const [protectedTypes, setProtectedTypes] = useState<
    ProtectedActivityType[]
  >([]);
  const [customTypes, setCustomTypes] = useState<CustomActivityType[]>([]);
  const [protectedTypeToAdd, setProtectedTypeToAdd] = useState<string>("");
  const [creatingNewType, setCreatingNewType] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [protectedBusy, setProtectedBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name ?? "");
    setRole((profile?.role as UserRole) ?? "logisticien");
    setWeeklyHours(contract?.weekly_hours ?? 35);
    setDailyMax(contract?.daily_max_hours ?? 8);
    setMinRest(contract?.min_rest_hours ?? 11);
    setOvertimeRate(contract?.overtime_rate ?? 1.25);
    setPreferredDays(rules?.preferred_rest_days ?? [1, 5]);
    setAutoSuggest(rules?.auto_suggest ?? true);
    setDwRestDays(defaultWeek?.rest_days ?? DEFAULT_WEEK_FALLBACK.rest_days);
    setDwTitle(defaultWeek?.default_title ?? DEFAULT_WEEK_FALLBACK.default_title);
    setDwType(defaultWeek?.default_type ?? DEFAULT_WEEK_FALLBACK.default_type);
    setDwMorningStart(
      defaultWeek?.morning_start ?? DEFAULT_WEEK_FALLBACK.morning_start
    );
    setDwMorningEnd(
      defaultWeek?.morning_end ?? DEFAULT_WEEK_FALLBACK.morning_end
    );
    setDwAfternoonStart(
      defaultWeek?.afternoon_start ?? DEFAULT_WEEK_FALLBACK.afternoon_start
    );
    setDwAfternoonEnd(
      defaultWeek?.afternoon_end ?? DEFAULT_WEEK_FALLBACK.afternoon_end
    );
    setDwBreakMinutes(
      defaultWeek?.break_minutes ?? DEFAULT_WEEK_FALLBACK.break_minutes
    );
    setDwPauseStart(
      defaultWeek?.pause_start ?? DEFAULT_WEEK_FALLBACK.pause_start
    );
    setDwPauseEnd(defaultWeek?.pause_end ?? DEFAULT_WEEK_FALLBACK.pause_end);
  }, [open, contract, rules, profile, defaultWeek]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("vacations")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: true })
      .then(({ data }) => {
        const list = (data as Vacation[]) ?? [];
        setVacations(list);
        const set = new Set<string>();
        for (const v of list) {
          const start = new Date(v.start_date + "T00:00:00");
          const end = new Date(v.end_date + "T00:00:00");
          for (
            let d = new Date(start);
            d <= end;
            d.setDate(d.getDate() + 1)
          ) {
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            set.add(iso);
          }
        }
        setVacationIsoSet(set);
      });
    supabase
      .from("rest_days")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "sick")
      .order("rest_date", { ascending: true })
      .then(({ data }) => {
        setSickRests((data as RestDay[]) ?? []);
      });
    supabase
      .from("protected_activity_types")
      .select("*")
      .eq("user_id", userId)
      .order("activity_type", { ascending: true })
      .then(({ data }) => {
        setProtectedTypes((data as ProtectedActivityType[]) ?? []);
      });
    supabase
      .from("activity_types")
      .select("*")
      .eq("user_id", userId)
      .order("label")
      .then(({ data }) => {
        setCustomTypes((data as CustomActivityType[]) ?? []);
      });
    setProtectedTypeToAdd("");
    setCreatingNewType(false);
    setNewTypeLabel("");
    setNewVacStart("");
    setNewVacEnd("");
    setNewVacLabel("");
    setSickMode("single");
    setSickSingleDate("");
    setSickPeriod("full_day");
    setSickRangeStart("");
    setSickRangeEnd("");
    setSickListDraft("");
    setSickListDates([]);
    setSickReason("");
  }, [open, userId]);

  async function addVacation() {
    if (!newVacStart || !newVacEnd) return;
    if (newVacEnd < newVacStart) {
      toast.error("La date de fin doit être postérieure à la date de début.");
      return;
    }
    setVacBusy(true);
    const startIso = `${newVacStart}T00:00:00`;
    const endIso = `${newVacEnd}T23:59:59`;
    const { data: overlapping, error: fetchErr } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", userId)
      .gte("start_time", startIso)
      .lte("start_time", endIso);
    if (fetchErr) {
      setVacBusy(false);
      toast.error("Impossible de vérifier les activités existantes.");
      return;
    }
    const conflicts = (overlapping as Activity[]) ?? [];
    if (conflicts.length > 0) {
      setVacBusy(false);
      setVacConflict({
        start: newVacStart,
        end: newVacEnd,
        label: newVacLabel.trim(),
        activities: conflicts,
      });
      return;
    }
    await insertVacation(newVacStart, newVacEnd, newVacLabel.trim());
    setVacBusy(false);
  }

  async function insertVacation(start: string, end: string, label: string) {
    const { data, error } = await supabase
      .from("vacations")
      .insert({
        user_id: userId,
        start_date: start,
        end_date: end,
        label,
      })
      .select()
      .maybeSingle();
    if (error || !data) {
      toast.error("Impossible d'ajouter la période.");
      return false;
    }
    setVacations((prev) =>
      [...prev, data as Vacation].sort((a, b) =>
        a.start_date.localeCompare(b.start_date)
      )
    );
    setNewVacStart("");
    setNewVacEnd("");
    setNewVacLabel("");
    onSaved();
    return true;
  }

  async function confirmVacationDeleteActivities() {
    if (!vacConflict) return;
    setVacBusy(true);
    const ids = vacConflict.activities.map((a) => a.id);
    const { error } = await supabase.from("activities").delete().in("id", ids);
    if (error) {
      setVacBusy(false);
      toast.error("Impossible de supprimer les activités.");
      return;
    }
    await insertVacation(vacConflict.start, vacConflict.end, vacConflict.label);
    setVacConflict(null);
    setVacBusy(false);
  }

  async function confirmVacationKeepActivities() {
    if (!vacConflict) return;
    setVacBusy(true);
    await insertVacation(vacConflict.start, vacConflict.end, vacConflict.label);
    setVacConflict(null);
    setVacBusy(false);
  }

  function cancelVacationConflict() {
    setVacConflict(null);
  }

  function buildSickEntries(): { date: string; period: RestPeriod }[] | null {
    if (sickMode === "single") {
      if (!sickSingleDate) {
        toast.error("Sélectionnez une date.");
        return null;
      }
      return [{ date: sickSingleDate, period: sickPeriod }];
    }
    if (sickMode === "range") {
      if (!sickRangeStart || !sickRangeEnd) {
        toast.error("Sélectionnez les dates de début et de fin.");
        return null;
      }
      if (sickRangeEnd < sickRangeStart) {
        toast.error("La date de fin doit être postérieure à la date de début.");
        return null;
      }
      const entries: { date: string; period: RestPeriod }[] = [];
      const start = new Date(sickRangeStart + "T00:00:00");
      const end = new Date(sickRangeEnd + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        entries.push({ date: iso, period: "full_day" });
      }
      return entries;
    }
    if (sickListDates.length === 0) {
      toast.error("Ajoutez au moins une date à la liste.");
      return null;
    }
    return sickListDates.map((d) => ({ date: d, period: "full_day" }));
  }

  function addSickListDate() {
    if (!sickListDraft) return;
    if (sickListDates.includes(sickListDraft)) {
      toast.error("Cette date est déjà dans la liste.");
      return;
    }
    setSickListDates((prev) =>
      [...prev, sickListDraft].sort((a, b) => a.localeCompare(b))
    );
    setSickListDraft("");
  }

  function removeSickListDate(iso: string) {
    setSickListDates((prev) => prev.filter((d) => d !== iso));
  }

  async function submitSickRests() {
    const entries = buildSickEntries();
    if (!entries) return;
    const conflictingVac = entries.filter((e) => vacationIsoSet.has(e.date));
    if (conflictingVac.length > 0) {
      toast.error(
        `Impossible : ${conflictingVac.length} date(s) sont déjà en vacances.`
      );
      return;
    }
    const existingIsos = new Set(sickRests.map((r) => r.rest_date));
    const freshEntries = entries.filter((e) => !existingIsos.has(e.date));
    if (freshEntries.length === 0) {
      toast.error("Ces dates sont déjà enregistrées comme repos maladie.");
      return;
    }
    setSickBusy(true);
    const isos = freshEntries.map((e) => e.date);
    const sorted = [...isos].sort();
    const startIso = `${sorted[0]}T00:00:00`;
    const endIso = `${sorted[sorted.length - 1]}T23:59:59`;
    const { data: ov, error: fetchErr } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", userId)
      .gte("start_time", startIso)
      .lte("start_time", endIso);
    if (fetchErr) {
      setSickBusy(false);
      toast.error("Impossible de vérifier les activités existantes.");
      return;
    }
    const isoSet = new Set(isos);
    const conflicts = ((ov as Activity[]) ?? []).filter((a) => {
      const d = new Date(a.start_time);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return isoSet.has(iso);
    });
    if (conflicts.length > 0) {
      setSickBusy(false);
      setSickConflict({
        entries: freshEntries,
        reason: sickReason.trim(),
        activities: conflicts,
      });
      return;
    }
    await insertSickRests(freshEntries, sickReason.trim());
    setSickBusy(false);
  }

  async function insertSickRests(
    entries: { date: string; period: RestPeriod }[],
    reason: string
  ) {
    const rows = entries.map((e) => ({
      user_id: userId,
      rest_date: e.date,
      status: "validated",
      reason: reason || "Repos maladie",
      rest_period: e.period,
      kind: "sick",
    }));
    const { data, error } = await supabase
      .from("rest_days")
      .upsert(rows, { onConflict: "user_id,rest_date" })
      .select();
    if (error) {
      toast.error("Impossible d'enregistrer les repos maladie.");
      return false;
    }
    setSickRests((prev) => {
      const map = new Map(prev.map((r) => [r.rest_date, r]));
      for (const r of (data as RestDay[]) ?? []) map.set(r.rest_date, r);
      return Array.from(map.values()).sort((a, b) =>
        a.rest_date.localeCompare(b.rest_date)
      );
    });
    setSickSingleDate("");
    setSickRangeStart("");
    setSickRangeEnd("");
    setSickListDates([]);
    setSickListDraft("");
    setSickReason("");
    onSaved();
    return true;
  }

  async function removeSickRest(id: string) {
    setSickBusy(true);
    await supabase.from("rest_days").delete().eq("id", id);
    setSickBusy(false);
    setSickRests((prev) => prev.filter((r) => r.id !== id));
    onSaved();
  }

  async function confirmSickDeleteActivities() {
    if (!sickConflict) return;
    setSickBusy(true);
    const ids = sickConflict.activities.map((a) => a.id);
    const { error } = await supabase.from("activities").delete().in("id", ids);
    if (error) {
      setSickBusy(false);
      toast.error("Impossible de supprimer les activités.");
      return;
    }
    await insertSickRests(sickConflict.entries, sickConflict.reason);
    setSickConflict(null);
    setSickBusy(false);
  }

  async function confirmSickKeepActivities() {
    if (!sickConflict) return;
    setSickBusy(true);
    await insertSickRests(sickConflict.entries, sickConflict.reason);
    setSickConflict(null);
    setSickBusy(false);
  }

  function cancelSickConflict() {
    setSickConflict(null);
  }

  function periodLabel(p: RestPeriod): string {
    return p === "morning"
      ? "Matin"
      : p === "afternoon"
        ? "Après-midi"
        : "Journée complète";
  }

  function formatIsoShort(iso: string): string {
    const d = new Date(iso + "T00:00:00");
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }

  async function removeVacation(id: string) {
    setVacBusy(true);
    await supabase.from("vacations").delete().eq("id", id);
    setVacBusy(false);
    setVacations((prev) => prev.filter((v) => v.id !== id));
    onSaved();
  }

  function slugifyType(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function addProtectedType(value: string) {
    if (!value) return;
    if (protectedTypes.some((p) => p.activity_type === value)) {
      toast.error("Ce type est déjà protégé.");
      return;
    }
    setProtectedBusy(true);
    const { data, error } = await supabase
      .from("protected_activity_types")
      .insert({ user_id: userId, activity_type: value })
      .select()
      .maybeSingle();
    setProtectedBusy(false);
    if (error || !data) {
      toast.error("Impossible d'ajouter le type protégé.");
      return;
    }
    setProtectedTypes((prev) =>
      [...prev, data as ProtectedActivityType].sort((a, b) =>
        a.activity_type.localeCompare(b.activity_type)
      )
    );
    setProtectedTypeToAdd("");
    onSaved();
  }

  async function createAndProtectType() {
    const label = newTypeLabel.trim();
    if (!label) return;
    const base = slugifyType(label) || `custom_${Date.now()}`;
    const existingValues = new Set([
      ...BUILTIN_ACTIVITY_TYPES.map((t) => t.value),
      ...customTypes.map((t) => t.value),
    ]);
    let value = base;
    let i = 1;
    while (existingValues.has(value)) {
      value = `${base}_${i++}`;
    }
    setProtectedBusy(true);
    const { data: createdType, error: createErr } = await supabase
      .from("activity_types")
      .insert({ user_id: userId, value, label })
      .select()
      .maybeSingle();
    if (createErr || !createdType) {
      setProtectedBusy(false);
      toast.error("Impossible de créer le type.");
      return;
    }
    const created = createdType as CustomActivityType;
    setCustomTypes((prev) => [...prev, created]);
    const { data, error } = await supabase
      .from("protected_activity_types")
      .insert({ user_id: userId, activity_type: created.value })
      .select()
      .maybeSingle();
    setProtectedBusy(false);
    if (error || !data) {
      toast.error("Type créé mais protection impossible.");
      return;
    }
    setProtectedTypes((prev) =>
      [...prev, data as ProtectedActivityType].sort((a, b) =>
        a.activity_type.localeCompare(b.activity_type)
      )
    );
    setCreatingNewType(false);
    setNewTypeLabel("");
    onSaved();
  }

  async function removeProtectedType(id: string) {
    setProtectedBusy(true);
    await supabase.from("protected_activity_types").delete().eq("id", id);
    setProtectedBusy(false);
    setProtectedTypes((prev) => prev.filter((p) => p.id !== id));
    onSaved();
  }

  async function createDwType() {
    const label = dwNewTypeLabel.trim();
    if (!label) return;
    const base = slugifyType(label) || `custom_${Date.now()}`;
    const existingValues = new Set([
      ...BUILTIN_ACTIVITY_TYPES.map((t) => t.value),
      ...customTypes.map((t) => t.value),
    ]);
    let value = base;
    let i = 1;
    while (existingValues.has(value)) {
      value = `${base}_${i++}`;
    }
    const { data, error } = await supabase
      .from("activity_types")
      .insert({ user_id: userId, value, label })
      .select()
      .maybeSingle();
    if (error || !data) {
      toast.error("Impossible de créer le type.");
      return;
    }
    const created = data as CustomActivityType;
    setCustomTypes((prev) => [...prev, created]);
    setDwType(created.value);
    setDwCreatingType(false);
    setDwNewTypeLabel("");
    onSaved();
  }

  function labelForType(value: string): string {
    const builtin = BUILTIN_ACTIVITY_TYPES.find((t) => t.value === value);
    if (builtin) return builtin.label;
    const custom = customTypes.find((t) => t.value === value);
    if (custom) return custom.label;
    return value;
  }

  function formatRange(v: Vacation): string {
    const start = new Date(v.start_date + "T00:00:00");
    const end = new Date(v.end_date + "T00:00:00");
    const f = new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${f.format(start)} – ${f.format(end)}`;
  }

  function toggleDefaultRest(day: number) {
    setDwRestDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleDay(day: number) {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    setSaving(true);

    await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        role,
      },
      { onConflict: "id" }
    );

    const contractPayload = {
      user_id: userId,
      weekly_hours: weeklyHours,
      daily_max_hours: dailyMax,
      min_rest_hours: minRest,
      overtime_rate: overtimeRate,
      updated_at: new Date().toISOString(),
    };
    if (contract) {
      await supabase
        .from("contract_settings")
        .update(contractPayload)
        .eq("user_id", userId);
    } else {
      await supabase.from("contract_settings").insert(contractPayload);
    }

    const rulesPayload = {
      user_id: userId,
      preferred_rest_days: preferredDays,
      auto_suggest: autoSuggest,
      preferred_time_of_day: rules?.preferred_time_of_day ?? "any",
      min_consecutive_rest_days: rules?.min_consecutive_rest_days ?? 1,
      updated_at: new Date().toISOString(),
    };
    if (rules) {
      await supabase
        .from("rest_rules")
        .update(rulesPayload)
        .eq("user_id", userId);
    } else {
      await supabase.from("rest_rules").insert(rulesPayload);
    }

    const defaultWeekPayload = {
      user_id: userId,
      rest_days: dwRestDays,
      default_title: dwTitle,
      default_type: dwType,
      morning_start: dwMorningStart,
      morning_end: dwMorningEnd,
      afternoon_start: dwAfternoonStart,
      afternoon_end: dwAfternoonEnd,
      pause_start: dwPauseStart,
      pause_end: dwPauseEnd,
      break_minutes: dwBreakMinutes,
      updated_at: new Date().toISOString(),
    };
    if (defaultWeek) {
      await supabase
        .from("default_week_settings")
        .update(defaultWeekPayload)
        .eq("user_id", userId);
    } else {
      await supabase.from("default_week_settings").insert(defaultWeekPayload);
    }

    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  const allTypes = [
    ...BUILTIN_ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ];

  const conflictDays = vacConflict
    ? new Set(
        vacConflict.activities.map((a) =>
          new Date(a.start_time).toISOString().slice(0, 10)
        )
      ).size
    : 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
          <DialogDescription>
            Personnalisez votre contrat et vos règles de repos.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="contract">Contrat</TabsTrigger>
            <TabsTrigger value="rules">Règles</TabsTrigger>
            <TabsTrigger value="default-week">Semaine type</TabsTrigger>
            <TabsTrigger value="vacations">Vacances</TabsTrigger>
            <TabsTrigger value="sickness">Maladie</TabsTrigger>
            <TabsTrigger value="protected">Protégées</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="fullname">Nom complet</Label>
              <Input
                id="fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rôle</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserRole)}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent value="contract" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="weekly">Heures / semaine</Label>
                <Input
                  id="weekly"
                  type="number"
                  step="0.5"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily">Max / jour</Label>
                <Input
                  id="daily"
                  type="number"
                  step="0.5"
                  value={dailyMax}
                  onChange={(e) => setDailyMax(parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rest">Repos min. (h)</Label>
                <Input
                  id="rest"
                  type="number"
                  step="0.5"
                  value={minRest}
                  onChange={(e) => setMinRest(parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="over">Taux heures supp.</Label>
                <Input
                  id="over"
                  type="number"
                  step="0.05"
                  value={overtimeRate}
                  onChange={(e) => setOvertimeRate(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="rules" className="space-y-4 pt-4">
            <div className="space-y-3">
              <Label>Jours de repos préférés</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const day = idx + 1;
                  const checked = preferredDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="auto">Suggestions automatiques</Label>
                <p className="text-xs text-muted-foreground">
                  Proposer des jours de repos basés sur vos préférences.
                </p>
              </div>
              <Switch
                id="auto"
                checked={autoSuggest}
                onCheckedChange={setAutoSuggest}
              />
            </div>
          </TabsContent>
          <TabsContent value="default-week" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Ces paramètres définissent votre semaine type. Utilisez le bouton
              "Appliquer à la semaine courante" pour pré-remplir la semaine
              affichée.
            </p>
            <div className="space-y-2">
              <Label htmlFor="dw-title">Titre d'activité par défaut</Label>
              <Input
                id="dw-title"
                value={dwTitle}
                onChange={(e) => setDwTitle(e.target.value)}
                placeholder="Ex. Travail"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {ACTIVITY_TAG_PRESETS.map((preset) => (
                  <Badge
                    key={preset.key}
                    variant="outline"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDwTitle(preset.title);
                      setDwType(preset.type);
                    }}
                    className="cursor-pointer select-none hover:bg-accent"
                  >
                    {preset.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dw-type">Type d'activité</Label>
              {dwCreatingType ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={dwNewTypeLabel}
                    onChange={(e) => setDwNewTypeLabel(e.target.value)}
                    placeholder="Nom du nouveau type"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createDwType();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={createDwType}
                    disabled={!dwNewTypeLabel.trim()}
                  >
                    Ajouter
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDwCreatingType(false);
                      setDwNewTypeLabel("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <Select
                  value={dwType}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setDwCreatingType(true);
                      return;
                    }
                    setDwType(v);
                  }}
                >
                  <SelectTrigger id="dw-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="__new__">
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5" />
                        Créer un type
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Jours de repos (semaine type)</Label>
              <div className="grid grid-cols-2 gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const day = idx + 1;
                  const checked = dwRestDays.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDefaultRest(day)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dw-morning-start">Matin - début</Label>
                <Input
                  id="dw-morning-start"
                  type="time"
                  value={dwMorningStart}
                  onChange={(e) => setDwMorningStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dw-morning-end">Matin - fin</Label>
                <Input
                  id="dw-morning-end"
                  type="time"
                  value={dwMorningEnd}
                  onChange={(e) => setDwMorningEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dw-pause-start">Pause - début</Label>
                <Input
                  id="dw-pause-start"
                  type="time"
                  value={dwPauseStart}
                  onChange={(e) => setDwPauseStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dw-pause-end">Pause - fin</Label>
                <Input
                  id="dw-pause-end"
                  type="time"
                  value={dwPauseEnd}
                  onChange={(e) => setDwPauseEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dw-afternoon-start">Après-midi - début</Label>
                <Input
                  id="dw-afternoon-start"
                  type="time"
                  value={dwAfternoonStart}
                  onChange={(e) => setDwAfternoonStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dw-afternoon-end">Après-midi - fin</Label>
                <Input
                  id="dw-afternoon-end"
                  type="time"
                  value={dwAfternoonEnd}
                  onChange={(e) => setDwAfternoonEnd(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="dw-break">Pause (minutes)</Label>
                <Input
                  id="dw-break"
                  type="number"
                  min={0}
                  step={15}
                  value={dwBreakMinutes}
                  onChange={(e) =>
                    setDwBreakMinutes(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await onApplyDefaultWeek();
                onOpenChange(false);
              }}
            >
              Appliquer à la semaine courante
            </Button>
          </TabsContent>
          <TabsContent value="vacations" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Définissez des périodes de vacances. Aucune activité ni action
              automatique ne sera appliquée sur ces jours.
            </p>
            <div className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vac-start">Début</Label>
                  <Input
                    id="vac-start"
                    type="date"
                    value={newVacStart}
                    onChange={(e) => setNewVacStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vac-end">Fin</Label>
                  <Input
                    id="vac-end"
                    type="date"
                    value={newVacEnd}
                    onChange={(e) => setNewVacEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vac-label">Libellé (optionnel)</Label>
                <Input
                  id="vac-label"
                  placeholder="Été, Noël, congés..."
                  value={newVacLabel}
                  onChange={(e) => setNewVacLabel(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={addVacation}
                disabled={vacBusy || !newVacStart || !newVacEnd}
              >
                <Palmtree className="mr-2 h-4 w-4" />
                Ajouter une période
              </Button>
            </div>
            <div className="space-y-2">
              {vacations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune période enregistrée.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {vacations.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {v.label || "Vacances"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRange(v)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVacation(v.id)}
                        disabled={vacBusy}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
          <TabsContent value="sickness" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Déclarez les jours où vous ne serez pas en mesure de travailler
              pour raison de santé. Ces jours apparaissent en rose dans le
              planning et ne génèrent aucune activité automatique.
            </p>
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label>Type de déclaration</Label>
                <Select
                  value={sickMode}
                  onValueChange={(v) => setSickMode(v as SickMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Un jour</SelectItem>
                    <SelectItem value="range">Période consécutive</SelectItem>
                    <SelectItem value="list">Plusieurs dates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sickMode === "single" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sick-single-date">Date</Label>
                    <Input
                      id="sick-single-date"
                      type="date"
                      value={sickSingleDate}
                      onChange={(e) => setSickSingleDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sick-period">Portée</Label>
                    <Select
                      value={sickPeriod}
                      onValueChange={(v) => setSickPeriod(v as RestPeriod)}
                    >
                      <SelectTrigger id="sick-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_day">
                          Journée complète
                        </SelectItem>
                        <SelectItem value="morning">Matin</SelectItem>
                        <SelectItem value="afternoon">Après-midi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {sickMode === "range" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sick-range-start">Début</Label>
                    <Input
                      id="sick-range-start"
                      type="date"
                      value={sickRangeStart}
                      onChange={(e) => setSickRangeStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sick-range-end">Fin</Label>
                    <Input
                      id="sick-range-end"
                      type="date"
                      value={sickRangeEnd}
                      onChange={(e) => setSickRangeEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {sickMode === "list" && (
                <div className="space-y-2">
                  <Label htmlFor="sick-list-draft">
                    Ajoutez les dates concernées
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="sick-list-draft"
                      type="date"
                      value={sickListDraft}
                      onChange={(e) => setSickListDraft(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addSickListDate}
                      disabled={!sickListDraft}
                    >
                      Ajouter
                    </Button>
                  </div>
                  {sickListDates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sickListDates.map((iso) => (
                        <Badge
                          key={iso}
                          variant="outline"
                          className="gap-1 border-rose-500/60 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                        >
                          {formatIsoShort(iso)}
                          <button
                            type="button"
                            onClick={() => removeSickListDate(iso)}
                            aria-label="Retirer"
                            className="ml-0.5 inline-flex"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="sick-reason">Motif (optionnel)</Label>
                <Input
                  id="sick-reason"
                  placeholder="Ex. Grippe, rendez-vous médical..."
                  value={sickReason}
                  onChange={(e) => setSickReason(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={submitSickRests}
                disabled={sickBusy}
              >
                <Thermometer className="mr-2 h-4 w-4" />
                Enregistrer
              </Button>
            </div>
            <div className="space-y-2">
              {sickRests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun repos maladie enregistré.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {sickRests.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {formatIsoShort(r.rest_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {periodLabel(r.rest_period)}
                          {r.reason && r.reason !== "Repos maladie"
                            ? ` · ${r.reason}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSickRest(r.id)}
                        disabled={sickBusy}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
          <TabsContent value="protected" className="space-y-4 pt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Les activités dont le type figure dans cette liste ne seront
                jamais supprimées, déplacées ou écrasées par les opérations
                automatiques (application de la semaine type, récupération
                automatique, nettoyage de période de repos, etc.). Par défaut,
                le type « Prestation » est protégé.
              </p>
            </div>
            {creatingNewType ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="Nom du nouveau type"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createAndProtectType();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={createAndProtectType}
                  disabled={protectedBusy || !newTypeLabel.trim()}
                >
                  Créer et protéger
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreatingNewType(false);
                    setNewTypeLabel("");
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={protectedTypeToAdd}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      setCreatingNewType(true);
                      return;
                    }
                    setProtectedTypeToAdd(v);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Sélectionner un type à protéger" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      ...BUILTIN_ACTIVITY_TYPES,
                      ...customTypes.map((t) => ({
                        value: t.value,
                        label: t.label,
                      })),
                    ]
                      .filter(
                        (t) =>
                          !protectedTypes.some(
                            (p) => p.activity_type === t.value
                          )
                      )
                      .map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    <SelectItem value="__new__">Créer un type…</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => addProtectedType(protectedTypeToAdd)}
                  disabled={protectedBusy || !protectedTypeToAdd}
                >
                  Ajouter
                </Button>
              </div>
            )}
            {protectedTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun type protégé pour le moment.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {protectedTypes.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-sm">
                      {labelForType(p.activity_type)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProtectedType(p.id)}
                      disabled={protectedBusy}
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ChoiceDialog
      open={vacConflict !== null}
      onOpenChange={(o) => {
        if (!o) cancelVacationConflict();
      }}
      title="Activités existantes sur la période"
      description={
        vacConflict
          ? `${vacConflict.activities.length} activité(s) sur ${conflictDays} jour(s) de la période choisie. Que souhaitez-vous faire ?`
          : ""
      }
      actions={[
        {
          key: "delete",
          label: "Effacer les activités",
          description:
            "Supprime les activités existantes puis crée la période de vacances.",
          variant: "destructive",
          onSelect: () => confirmVacationDeleteActivities(),
          disabled: vacBusy,
        },
        {
          key: "keep",
          label: "Appliquer malgré les activités",
          description:
            "Conserve les activités sur la période (elles resteront visibles en vacances).",
          onSelect: () => confirmVacationKeepActivities(),
          disabled: vacBusy,
        },
        {
          key: "change",
          label: "Changer la période",
          description:
            "Revenir au formulaire pour ajuster les dates de début et de fin.",
          variant: "outline",
          onSelect: () => cancelVacationConflict(),
          disabled: vacBusy,
        },
      ]}
    />
    <ChoiceDialog
      open={sickConflict !== null}
      onOpenChange={(o) => {
        if (!o) cancelSickConflict();
      }}
      title="Activités existantes sur ces jours"
      description={
        sickConflict
          ? `${sickConflict.activities.length} activité(s) sur les jours sélectionnés. Que souhaitez-vous faire ?`
          : ""
      }
      actions={[
        {
          key: "delete",
          label: "Effacer les activités",
          description:
            "Supprime les activités existantes puis enregistre les repos maladie.",
          variant: "destructive",
          onSelect: () => confirmSickDeleteActivities(),
          disabled: sickBusy,
        },
        {
          key: "keep",
          label: "Appliquer malgré les activités",
          description:
            "Conserve les activités et ajoute quand même les repos maladie.",
          onSelect: () => confirmSickKeepActivities(),
          disabled: sickBusy,
        },
        {
          key: "change",
          label: "Modifier les dates",
          description: "Revenir au formulaire pour ajuster les jours.",
          variant: "outline",
          onSelect: () => cancelSickConflict(),
          disabled: sickBusy,
        },
      ]}
    />
    </>
  );
}
