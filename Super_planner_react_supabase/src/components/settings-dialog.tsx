import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ContractSettings,
  Profile,
  RestRules,
  UserRole,
} from "@/lib/supabase";
import { ROLE_LABELS } from "@/lib/supabase";
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
  onSaved: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  userId,
  contract,
  rules,
  profile,
  onSaved,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("logisticien");
  const [weeklyHours, setWeeklyHours] = useState(35);
  const [dailyMax, setDailyMax] = useState(10);
  const [minRest, setMinRest] = useState(11);
  const [overtimeRate, setOvertimeRate] = useState(1.25);
  const [preferredDays, setPreferredDays] = useState<number[]>([1, 5]);
  const [autoSuggest, setAutoSuggest] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name ?? "");
    setRole((profile?.role as UserRole) ?? "logisticien");
    setWeeklyHours(contract?.weekly_hours ?? 35);
    setDailyMax(contract?.daily_max_hours ?? 10);
    setMinRest(contract?.min_rest_hours ?? 11);
    setOvertimeRate(contract?.overtime_rate ?? 1.25);
    setPreferredDays(rules?.preferred_rest_days ?? [1, 5]);
    setAutoSuggest(rules?.auto_suggest ?? true);
  }, [open, contract, rules, profile]);

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

    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Paramètres</DialogTitle>
          <DialogDescription>
            Personnalisez votre contrat et vos règles de repos.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="contract">Contrat</TabsTrigger>
            <TabsTrigger value="rules">Règles</TabsTrigger>
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
  );
}
