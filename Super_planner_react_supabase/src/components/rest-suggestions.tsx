import { useMemo } from "react";
import type { Activity, RestDay, RestRules } from "@/lib/supabase";
import {
  DAY_LABELS,
  addDays,
  formatDateISO,
  formatDayLong,
} from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X } from "lucide-react";

interface Props {
  weekStart: Date;
  activities: Activity[];
  restDays: RestDay[];
  rules: RestRules | null;
  onValidate: (date: Date) => void;
  onReject: (date: Date) => void;
}

export function RestSuggestions({
  weekStart,
  activities,
  restDays,
  rules,
  onValidate,
  onReject,
}: Props) {
  const suggestions = useMemo(() => {
    const preferredDays = rules?.preferred_rest_days ?? [1, 5];
    const busyDays = new Set<string>();
    for (const a of activities) {
      if (a.activity_type === "pause") continue;
      const d = new Date(a.start_time);
      busyDays.add(formatDateISO(d));
    }
    const validatedOrRejected = new Map<string, string>();
    for (const r of restDays) validatedOrRejected.set(r.rest_date, r.status);

    const result: { date: Date; iso: string; reason: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const iso = formatDateISO(d);
      const weekday = (d.getDay() + 6) % 7 + 1;
      if (busyDays.has(iso)) continue;
      const existing = validatedOrRejected.get(iso);
      if (existing === "validated" || existing === "rejected") continue;
      const isPreferred = preferredDays.includes(weekday);
      if (isPreferred) {
        result.push({
          date: d,
          iso,
          reason: `Jour préféré (${DAY_LABELS[(d.getDay() + 6) % 7]})`,
        });
      }
    }
    return result.slice(0, 3);
  }, [weekStart, activities, restDays, rules]);

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Suggestions de repos
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5 pt-0">
          <p className="text-sm text-muted-foreground">
            Aucune suggestion cette semaine. Votre planning est cohérent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Suggestions de repos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-5 pt-0">
        {suggestions.map((s) => (
          <div
            key={s.iso}
            className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium capitalize">
                {formatDayLong(s.date)}
              </span>
              <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                {s.reason}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(s.date)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => onValidate(s.date)}
                className="h-8"
              >
                <Check className="mr-1 h-4 w-4" /> Valider
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
