import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  Activity,
  ActivityType,
  CustomActivityType,
  DefaultWeekSettings,
  DurationKind,
  RestDay,
} from "@/lib/planning";
import {
  ACTIVITY_TAG_PRESETS,
  BUILTIN_ACTIVITY_TYPES,
  buildDurationPresets,
  pauseOverlapMinutesForRange,
  restRangesForPeriod,
  parseHM,
  overlapMinutes,
} from "@/lib/planning";
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
import { formatDayLong, formatDateISO, sameDay } from "@/lib/time";

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

  useEffect(() => {
    if (!open) return;
    api.activityTypes
      .list()
      .then((data) => {
        setCustomTypes(data);
      })
      .catch(() => {
        setCustomTypes([]);
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

  function buildDateTime(timeStr: string): Date {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(activeDate);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  }

  const startMin = parseHM(startTime);
  const endMin = parseHM(endTime);

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
  }, [restEntry, restRanges, startMin, endMin, isPauseType, availableHalf]);

  const pauseConflict = useMemo(() => {
    if (isPauseType) return 0;
    if (endMin <= startMin) return 0;
    const w = defaultWeek;
    if (!w) return 0;
    const pStart = parseHM(w.pause_start);
    const pEnd = parseHM(w.pause_end);
    if (pEnd <= pStart) return 0;
    return overlapMinutes(startMin, endMin, pStart, pEnd);
  }, [defaultWeek, startMin, endMin, isPauseType]);

  const canSave =
    !!title &&
    endMin > startMin &&
    !restConflict &&
    (!restEntry || restEntry.rest_period !== "full_day" || isPauseType);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const startDt = buildDateTime(startTime);
    const endDt = buildDateTime(endTime);
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
      external_id: activity?.external_id || "",
      duration_kind: durationKind,
      break_minutes: breakMinutes,
    };
    let savedId: string | undefined = activity?.id;
    if (activity) {
      await api.activities.update(activity.id, payload);
    } else {
      const data = await api.activities.create(payload);
      savedId = data.id;
    }
    setSaving(false);
    onSaved({ savedDate: startDt, savedId });
    onOpenChange(false);
  }

  async function handleDelete() {
    if (!activity) return;
    setSaving(true);
    await api.activities.delete(activity.id);
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
    const created = await api.activityTypes.create({ value, label });
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
      <DialogContent className="sm:max-w-lg">
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
          {pauseConflict > 0 && (
            <p className="text-xs text-muted-foreground">
              Pause de {pauseConflict} min comprise dans le créneau — décomptée automatiquement.
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
    </Dialog>
  );
}
