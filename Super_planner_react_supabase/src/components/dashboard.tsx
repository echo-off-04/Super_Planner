import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  Activity,
  ContractSettings,
  Profile,
  RestDay,
  RestRules,
} from "@/lib/supabase";
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

interface Props {
  user: User;
}

export function Dashboard({ user }: Props) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const [kpiRestDays, setKpiRestDays] = useState<RestDay[]>([]);
  const [contract, setContract] = useState<ContractSettings | null>(null);
  const [rules, setRules] = useState<RestRules | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [defaultActivityDate, setDefaultActivityDate] = useState<
    Date | undefined
  >();
  const [fixedDate, setFixedDate] = useState(false);

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
    const [contractRes, rulesRes, profileRes] = await Promise.all([
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
    setEditingActivity(null);
    setDefaultActivityDate(date);
    setFixedDate(Boolean(date));
    setActivityDialogOpen(true);
  }

  function openEditActivity(a: Activity) {
    setEditingActivity(a);
    setDefaultActivityDate(undefined);
    setFixedDate(false);
    setActivityDialogOpen(true);
  }

  async function toggleRestDay(date: Date) {
    const iso = formatDateISO(date);
    const existing = restDays.find((r) => r.rest_date === iso);
    if (existing) {
      if (existing.status === "validated") {
        await supabase.from("rest_days").delete().eq("id", existing.id);
      } else {
        await supabase
          .from("rest_days")
          .update({ status: "validated" })
          .eq("id", existing.id);
      }
    } else {
      await supabase.from("rest_days").insert({
        user_id: user.id,
        rest_date: iso,
        status: "validated",
        reason: "Validé manuellement",
      });
    }
    loadData();
  }

  async function validateSuggestion(date: Date) {
    const iso = formatDateISO(date);
    const existing = restDays.find((r) => r.rest_date === iso);
    if (existing) {
      await supabase
        .from("rest_days")
        .update({ status: "validated" })
        .eq("id", existing.id);
    } else {
      await supabase.from("rest_days").insert({
        user_id: user.id,
        rest_date: iso,
        status: "validated",
        reason: "Suggestion validée",
      });
    }
    loadData();
  }

  async function rejectSuggestion(date: Date) {
    const iso = formatDateISO(date);
    await supabase.from("rest_days").upsert(
      {
        user_id: user.id,
        rest_date: iso,
        status: "rejected",
        reason: "Refusée",
      },
      { onConflict: "user_id,rest_date" }
    );
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
          activities={activities}
          contract={contract}
          restDaysCount={validatedCount}
          view={view}
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
        onSaved={loadData}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userId={user.id}
        contract={contract}
        rules={rules}
        profile={profile}
        onSaved={loadSettings}
      />
    </div>
  );
}
