import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ActivityType,
  CustomActivityType,
} from "@/lib/supabase";
import { BUILTIN_ACTIVITY_TYPES } from "@/lib/supabase";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatDayLong } from "@/lib/time";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  activity: Activity | null;
  defaultDate?: Date;
  fixedDate?: boolean;
  onSaved: () => void;
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
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("prestation");
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [dateField, setDateField] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [customTypes, setCustomTypes] = useState<CustomActivityType[]>([]);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [creatingType, setCreatingType] = useState(false);

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
      setStartTime("09:00");
      setEndTime("17:00");
      setLocation("");
      setNotes("");
    }
    setCreatingType(false);
    setNewTypeLabel("");
  }, [open, activity, defaultDate]);

  function buildDateTime(timeStr: string): Date {
    const [h, m] = timeStr.split(":").map(Number);
    let d: Date;
    if (fixedDate) {
      d = new Date(baseDate);
    } else {
      const [y, mo, day] = dateField.split("-").map(Number);
      d = new Date(y, (mo ?? 1) - 1, day ?? 1);
    }
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  }

  async function handleSave() {
    if (!title || !startTime || !endTime) return;
    setSaving(true);
    const startDt = buildDateTime(startTime);
    const endDt = buildDateTime(endTime);
    const payload = {
      user_id: userId,
      title,
      activity_type: type,
      start_time: startDt.toISOString(),
      end_time: endDt.toISOString(),
      location,
      notes,
      source: activity?.source || "manual",
    };
    if (activity) {
      await supabase.from("activities").update(payload).eq("id", activity.id);
    } else {
      await supabase.from("activities").insert(payload);
    }
    setSaving(false);
    onSaved();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activity ? "Modifier l'activité" : "Nouvelle activité"}
          </DialogTitle>
          <DialogDescription>
            {fixedDate
              ? `${formatDayLong(baseDate)} — renseignez les horaires.`
              : "Renseignez les détails du créneau."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Livraison Paris centre"
            />
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
          {fixedDate ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-time">Heure de début</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Heure de fin</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Heure de début</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Heure de fin</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </>
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
