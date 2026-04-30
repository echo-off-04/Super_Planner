import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ActivityType,
  CustomActivityType,
  DefaultWeekSettings,
  DurationKind,
  RestDay,
} from "@/lib/supabase";
import {
  ACTIVITY_TAG_PRESETS,
  BUILTIN_ACTIVITY_TYPES,
  buildDurationPresets,
  pauseOverlapMinutesForRange,
  restRangesForPeriod,
  parseHM,
  overlapMinutes,
} from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { addDays, formatDayLong, formatDateISO, sameDay } from "@/lib/time";
import { ChoiceDialog } from "./choice-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  activity: Activity | null;
  defaultDate?: Date;
  fixedDate?: boolean;
  defaultWeek: DefaultWeekSettings | null;
  restDays: RestDay[];
  onSaved: (info?: { savedDate?: Date; savedId?: string }) => void;
}

const NEW_TYPE_VALUE = "__new__";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ActivityDialog({
  open,
  onOpenChange,
  userId,
  activity,
  defaultDate,
  fixedDate,
  defaultWeek,
  restDays,
  onSaved,
}: Props) {
  const presets = useMemo(() => buildDurationPresets(defaultWeek), [defaultWeek]);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("prestation");
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [dateField, setDateField] = useState("");
  const [startTime, setStartTime] = useState(presets.full_day.start);
  const [endTime, setEndTime] = useState(presets.full_day.end);
  const [durationKind, setDurationKind] = useState<DurationKind>("full_day");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [customTypes, setCustomTypes] = useState<CustomActivityType[]>([]);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [pauseChoiceOpen, setPauseChoiceOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("activity_types")
      .select("*")
      .eq("user_id", userId)
      .order("label")
      .then(({ data }) => {
        setCustomTypes((data as CustomActivityType[]) ?? []);
      });
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      const s = new Date(activity.start_time);
      const e = new Date(activity.end_time);
      setTitle(activity.title);
      setType(activity.activity_type);
      setBaseDate(s);
      setDateField(
        `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`
      );
      setStartTime(toLocalTime(s));
      setEndTime(toLocalTime(e));
      setDurationKind((activity.duration_kind as DurationKind) || "custom");
      setLocation(activity.location);
      setNotes(activity.notes);
    } else {
      const base = defaultDate ? new Date(defaultDate) : new Date();
      base.setHours(0, 0, 0, 0);
      setTitle("");
      setType("prestation");
      setBaseDate(base);
      setDateField(
        `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(
          base.getDate()
        )}`
      );
      setStartTime(presets.full_day.start);
      setEndTime(presets.full_day.end);
      setDurationKind("full_day");
      setLocation("");
      setNotes("");
    }
    setCreatingType(false);
    setNewTypeLabel("");
  }, [open, activity, defaultDate, presets]);

  const activeDate = useMemo(() => {
    if (fixedDate) return baseDate;
    if (!dateField) return baseDate;
    const [y, mo, day] = dateField.split("-").map(Number);
    return new Date(y, (mo ?? 1) - 1, day ?? 1);
  }, [fixedDate, baseDate, dateField]);

  const restEntry = useMemo(() => {
    const iso = formatDateISO(activeDate);
    return restDays.find((r) => r.rest_date === iso && r.status !== "rejected") || null;
  }, [restDays, activeDate]);

  const restRanges = useMemo(() => {
    if (!restEntry) return [];
    return restRangesForPeriod(restEntry.rest_period, defaultWeek);
  }, [restEntry, defaultWeek]);

  const availableKinds = useMemo<Array<Exclude<DurationKind, "custom">>>(() => {
    if (!restEntry) return ["full_day", "morning", "afternoon"];
    if (restEntry.rest_period === "morning") return ["afternoon"];
    if (restEntry.rest_period === "afternoon") return ["morning"];
    return [];
  }, [restEntry]);

  const startMin = parseHM(startTime);
  const endMin = parseHM(endTime);

  const morningStartMin = useMemo(
    () => (defaultWeek ? parseHM(defaultWeek.morning_start) : 8 * 60),
    [defaultWeek]
  );

  const crossesMidnight = endMin <= startMin && endMin < morningStartMin;

  function buildDateTime(timeStr: string, nextDay = false): Date {
    const [h, m] = timeStr.split(":").map(Number);
    const d = nextDay ? addDays(activeDate, 1) : new Date(activeDate);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  }

  const isPauseType = type === "pause";

  const availableHalf = useMemo(() => {
    if (!restEntry || restEntry.rest_period === "full_day") return null;
    const w = defaultWeek;
    if (!w) return null;
    if (restEntry.rest_period === "morning") {
      return {
        startMin: parseHM(w.afternoon_start),
        endMin: parseHM(w.afternoon_end),
        label: "après-midi",
      };
    }
    return {
      startMin: parseHM(w.morning_start),
      endMin: parseHM(w.morning_end),
      label: "matin",
    };
  }, [restEntry, defaultWeek]);

  const restConflict = useMemo(() => {
    if (!restEntry || isPauseType) return null;
    if (crossesMidnight) return null;
    if (endMin <= startMin) return null;
    for (const r of restRanges) {
      const ov = overlapMinutes(startMin, endMin, r.startMin, r.endMin);
      if (ov > 0) return r;
    }
    if (availableHalf) {
      if (startMin < availableHalf.startMin || endMin > availableHalf.endMin) {
        return {
          startMin: availableHalf.startMin,
          endMin: availableHalf.endMin,
          label: `${availableHalf.label} uniquement`,
        };
      }
    }
    return null;
  }, [restEntry, restRanges, startMin, endMin, isPauseType, availableHalf, crossesMidnight]);

  const pauseConflict = useMemo(() => {
    if (isPauseType) return 0;
    if (crossesMidnight) return 0;
    if (endMin <= startMin) return 0;
    const w = defaultWeek;
    if (!w) return 0;
    const pStart = parseHM(w.pause_start);
    const pEnd = parseHM(w.pause_end);
    if (pEnd <= pStart) return 0;
    return overlapMinutes(startMin, endMin, pStart, pEnd);
  }, [defaultWeek, startMin, endMin, isPauseType, crossesMidnight]);

  const canSave =
    !!title &&
    (endMin > startMin || crossesMidnight) &&
    !restConflict &&
    (!restEntry || restEntry.rest_period !== "full_day" || isPauseType);

  function handleSave() {
    if (!canSave) return;
    if (pauseConflict > 0 && !isPauseType) {
      setPauseChoiceOpen(true);
      return;
    }
    void persistActivity({ splitAroundPause: false });
  }

  async function persistActivity({
    splitAroundPause,
  }: {
    splitAroundPause: boolean;
  }) {
    setSaving(true);
    const startDt = buildDateTime(startTime);
    const endDt = buildDateTime(endTime, crossesMidnight);

    if (splitAroundPause && defaultWeek && !crossesMidnight) {
      const pStartMin = parseHM(defaultWeek.pause_start);
      const pEndMin = parseHM(defaultWeek.pause_end);
      const pauseStart = new Date(activeDate);
      pauseStart.setHours(Math.floor(pStartMin / 60), pStartMin % 60, 0, 0);
      const pauseEnd = new Date(activeDate);
      pauseEnd.setHours(Math.floor(pEndMin / 60), pEndMin % 60, 0, 0);
      const segments: Array<{ start: Date; end: Date }> = [];
      if (startMin < pStartMin) {
        segments.push({ start: buildDateTime(startTime), end: pauseStart });
      }
      if (endMin > pEndMin) {
        segments.push({ start: pauseEnd, end: buildDateTime(endTime) });
      }
      if (segments.length === 0) {
        setSaving(false);
        return;
      }
      const basePayload = {
        user_id: userId,
        title,
        activity_type: type,
        location,
        notes,
        source: activity?.source || "manual",
        duration_kind: "custom" as DurationKind,
        break_minutes: 0,
      };
      if (activity) {
        await supabase.from("activities").delete().eq("id", activity.id);
      }
      const rows: Array<Record<string, unknown>> = segments.map((seg) => ({
        ...basePayload,
        start_time: seg.start.toISOString(),
        end_time: seg.end.toISOString(),
      }));

      const dayStart = new Date(activeDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEndBound = new Date(activeDate);
      dayEndBound.setHours(23, 59, 59, 999);
      const { data: existingPause } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", userId)
        .eq("activity_type", "pause")
        .gte("start_time", dayStart.toISOString())
        .lte("start_time", dayEndBound.toISOString())
        .limit(1);
      const hasPause = ((existingPause as Array<{ id: string }>) ?? []).length > 0;
      if (!hasPause) {
        rows.push({
          user_id: userId,
          title: "Pause",
          activity_type: "pause",
          start_time: pauseStart.toISOString(),
          end_time: pauseEnd.toISOString(),
          location: "",
          notes: "",
          source: activity?.source || "manual",
          duration_kind: "custom",
          break_minutes: 0,
        });
      }

      const { data } = await supabase.from("activities").insert(rows).select();
      const savedId = (data as Array<{ id: string }> | null)?.[0]?.id;
      setSaving(false);
      onSaved({ savedDate: segments[0].start, savedId });
      onOpenChange(false);
      return;
    }

    const breakMinutes = pauseOverlapMinutesForRange(
      startDt.toISOString(),
      endDt.toISOString(),
      defaultWeek
    );
    const payload = {
      user_id: userId,
      title,
      activity_type: type,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      location,
      notes,
      source: activity?.source || "manual",
      duration_kind: durationKind,
      break_minutes: breakMinutes,
    };
    let savedId: string | undefined = activity?.id;
    if (activity) {
      await supabase.from("activities").update(payload).eq("id", activity.id);
    } else {
      const { data } = await supabase
        .from("activities")
        .insert(payload)
        .select()
        .maybeSingle();
      savedId = (data as { id?: string } | null)?.id;
    }
    setSaving(false);
    onSaved({ savedDate: startDt, savedId });
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!activity) return;
    setSaving(true);
    await supabase.from("activities").delete().eq("id", activity.id);
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  async function handleCreateType() {
    const label = newTypeLabel.trim();
    if (!label) return;
    const base = slugify(label) || `custom_${Date.now()}`;
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
    if (error || !data) return;
    const created = data as CustomActivityType;
    setCustomTypes((prev) => [...prev, created]);
    setType(created.value);
    setCreatingType(false);
    setNewTypeLabel("");
  }

  const allTypes = [
    ...BUILTIN_ACTIVITY_TYPES,
    ...customTypes.map((t) => ({ value: t.value, label: t.label })),
  ];

  const hasHalfRest = restEntry && restEntry.rest_period !== "full_day";
  const blockedByFullRest =
    restEntry && restEntry.rest_period === "full_day" && !isPauseType;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {activity ? "Modifier l'activité" : "Nouvelle activité"}
          </DialogTitle>
          <DialogDescription>
            {fixedDate || sameDay(activeDate, baseDate)
              ? `${formatDayLong(activeDate)} — renseignez les horaires.`
              : "Renseignez les détails du créneau."}
          </DialogDescription>
        </DialogHeader>

        {(hasHalfRest || blockedByFullRest) && (
          <Alert variant={blockedByFullRest ? "destructive" : "default"}>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>
              {blockedByFullRest
                ? "Journée de repos"
                : restEntry?.rest_period === "morning"
                  ? "Matin en repos"
                  : "Après-midi en repos"}
            </AlertTitle>
            <AlertDescription>
              {blockedByFullRest
                ? "Retirez le repos pour planifier une activité ce jour."
                : restEntry?.rest_period === "morning"
                  ? "Les activités doivent se dérouler l'après-midi uniquement."
                  : "Les activités doivent se dérouler le matin uniquement."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Livraison Paris centre"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {ACTIVITY_TAG_PRESETS.map((preset) => (
                <Badge
                  key={preset.key}
                  variant="outline"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setTitle(preset.title);
                    setType(preset.type);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTitle(preset.title);
                      setType(preset.type);
                    }
                  }}
                  className="cursor-pointer select-none hover:bg-accent"
                >
                  {preset.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            {creatingType ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="Nom du nouveau type"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateType();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateType}
                  disabled={!newTypeLabel.trim()}
                >
                  Ajouter
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCreatingType(false);
                    setNewTypeLabel("");
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Select
                value={type}
                onValueChange={(v) => {
                  if (v === NEW_TYPE_VALUE) {
                    setCreatingType(true);
                    return;
                  }
                  setType(v);
                }}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_TYPE_VALUE}>
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      Créer un type
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {!fixedDate && (
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateField}
                onChange={(e) => setDateField(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Durée</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={durationKind}
              onValueChange={(v) => {
                if (!v) return;
                const kind = v as DurationKind;
                setDurationKind(kind);
                if (kind !== "custom") {
                  const preset = presets[kind];
                  setStartTime(preset.start);
                  setEndTime(preset.end);
                }
              }}
              className="flex flex-wrap gap-2"
            >
              <ToggleGroupItem
                value="full_day"
                className="flex-1 min-w-[8rem]"
                disabled={!!restEntry && !availableKinds.includes("full_day")}
              >
                Journée ({presets.full_day.start}–{presets.full_day.end})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="morning"
                className="flex-1 min-w-[8rem]"
                disabled={!!restEntry && !availableKinds.includes("morning")}
              >
                Matin ({presets.morning.start}–{presets.morning.end})
              </ToggleGroupItem>
              <ToggleGroupItem
                value="afternoon"
                className="flex-1 min-w-[8rem]"
                disabled={!!restEntry && !availableKinds.includes("afternoon")}
              >
                Après-midi ({presets.afternoon.start}–{presets.afternoon.end})
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="flex-1 min-w-[8rem]">
                Personnalisé
              </ToggleGroupItem>
            </ToggleGroup>
            {durationKind === "full_day" && presets.full_day.breakMinutes > 0 && (
              <p className="text-xs text-muted-foreground">
                Pause de {presets.full_day.breakMinutes} min comprise (non comptée dans le temps de travail).
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-time">Heure de début</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                disabled={durationKind !== "custom"}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Heure de fin</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                disabled={durationKind !== "custom"}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          {crossesMidnight && (
            <p className="text-xs text-muted-foreground">
              Fin le lendemain à {endTime} (avant {defaultWeek?.morning_start ?? "08:00"}).
            </p>
          )}
          {pauseConflict > 0 && !isPauseType && (
            <p className="text-xs text-muted-foreground">
              Le créneau chevauche la pause ({pauseConflict} min) — un choix
              vous sera proposé à l'enregistrement.
            </p>
          )}
          {restConflict && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Chevauchement avec le repos</AlertTitle>
              <AlertDescription>
                Le créneau empiète sur la demi-journée de repos ({restConflict.label}). Ajustez les horaires.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="location">Lieu</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {activity ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <ChoiceDialog
        open={pauseChoiceOpen}
        onOpenChange={(o) => {
          if (!o) setPauseChoiceOpen(false);
        }}
        title="Le créneau chevauche la pause"
        description={`La pause (${defaultWeek?.pause_start ?? ""}–${
          defaultWeek?.pause_end ?? ""
        }) est incluse dans l'horaire saisi. Comment souhaitez-vous l'enregistrer ?`}
        actions={[
          {
            key: "ignore",
            label: "Ignorer la pause",
            description:
              "Enregistre une seule activité ; la durée de la pause est déduite du temps de travail.",
            onSelect: () => {
              setPauseChoiceOpen(false);
              void persistActivity({ splitAroundPause: false });
            },
          },
          {
            key: "split",
            label: "Diviser autour de la pause",
            description:
              "Crée une activité avant la pause et une autre après, la pause reste libre.",
            onSelect: () => {
              setPauseChoiceOpen(false);
              void persistActivity({ splitAroundPause: true });
            },
          },
          {
            key: "cancel",
            label: "Annuler",
            variant: "outline",
            onSelect: () => setPauseChoiceOpen(false),
          },
        ]}
      />
    </Dialog>
  );
}
