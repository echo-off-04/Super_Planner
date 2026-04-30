import type {
  Activity,
  ContractSettings,
  CustomActivityType,
  DefaultWeekSettings,
  Profile,
  RestDay,
  RestKind,
  RestRules,
  Vacation,
} from "@/lib/planning";

export interface AppUser {
  id: string;
  email: string;
}

export interface AppSession {
  user: AppUser;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object;
};

interface SettingsBootstrap {
  profile: Profile;
  contract: ContractSettings;
  rules: RestRules;
  defaultWeek: DefaultWeekSettings;
  vacations: Vacation[];
}

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:4000/api";

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    typeof options.body !== "string" &&
    !(options.body instanceof URLSearchParams)
  ) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  } else {
    body = options.body as BodyInit | undefined;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String(payload.error)
        : typeof payload === "string"
          ? payload
          : "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

export const api = {
  auth: {
    async getSession(): Promise<AppSession | null> {
      const payload = await request<{ session: AppSession | null }>("/auth/session");
      return payload.session;
    },
    async signIn(email: string, password: string): Promise<AppUser> {
      const payload = await request<{ user: AppUser }>("/auth/sign-in", {
        method: "POST",
        body: { email, password },
      });
      return payload.user;
    },
    async signUp(email: string, password: string, fullName: string): Promise<AppUser> {
      const payload = await request<{ user: AppUser }>("/auth/sign-up", {
        method: "POST",
        body: { email, password, full_name: fullName },
      });
      return payload.user;
    },
    async signOut(): Promise<void> {
      await request<void>("/auth/sign-out", { method: "POST" });
    },
  },
  settings: {
    async getBootstrap(): Promise<SettingsBootstrap> {
      return request<SettingsBootstrap>("/settings/bootstrap");
    },
    async save(payload: {
      profile: Pick<Profile, "full_name" | "role">;
      contract: Pick<
        ContractSettings,
        "weekly_hours" | "daily_max_hours" | "min_rest_hours" | "overtime_rate"
      >;
      rules: Pick<
        RestRules,
        | "preferred_rest_days"
        | "preferred_time_of_day"
        | "min_consecutive_rest_days"
        | "auto_suggest"
      >;
      defaultWeek: Pick<
        DefaultWeekSettings,
        | "rest_days"
        | "default_title"
        | "default_type"
        | "morning_start"
        | "morning_end"
        | "afternoon_start"
        | "afternoon_end"
        | "pause_start"
        | "pause_end"
        | "break_minutes"
      >;
    }): Promise<{
      profile: Profile;
      contract: ContractSettings;
      rules: RestRules;
      defaultWeek: DefaultWeekSettings;
    }> {
      return request("/settings", {
        method: "PUT",
        body: payload,
      });
    },
  },
  activityTypes: {
    async list(): Promise<CustomActivityType[]> {
      const payload = await request<{ items: CustomActivityType[] }>("/activity-types");
      return payload.items;
    },
    async create(input: Pick<CustomActivityType, "value" | "label">) {
      const payload = await request<{ item: CustomActivityType }>("/activity-types", {
        method: "POST",
        body: input,
      });
      return payload.item;
    },
  },
  activities: {
    async list(params: { start: string; end: string }): Promise<Activity[]> {
      const search = new URLSearchParams(params);
      const payload = await request<{ items: Activity[] }>(`/activities?${search.toString()}`);
      return payload.items;
    },
    async create(input: Omit<Activity, "id">): Promise<Activity> {
      const payload = await request<{ item: Activity }>("/activities", {
        method: "POST",
        body: input,
      });
      return payload.item;
    },
    async createMany(items: Array<Omit<Activity, "id">>): Promise<number> {
      const payload = await request<{ count: number }>("/activities/bulk", {
        method: "POST",
        body: { items },
      });
      return payload.count;
    },
    async update(id: string, input: Partial<Omit<Activity, "id">>): Promise<Activity> {
      const payload = await request<{ item: Activity }>(`/activities/${id}`, {
        method: "PATCH",
        body: input,
      });
      return payload.item;
    },
    async bulkUpdate(updates: Array<{ id: string; data: Partial<Omit<Activity, "id">> }>) {
      await request<{ ok: true }>("/activities/bulk-update", {
        method: "POST",
        body: { updates },
      });
    },
    async delete(id: string): Promise<void> {
      await request<void>(`/activities/${id}`, { method: "DELETE" });
    },
    async deleteMany(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const payload = await request<{ count: number }>("/activities/bulk-delete", {
        method: "POST",
        body: { ids },
      });
      return payload.count;
    },
  },
  restDays: {
    async list(params: {
      start: string;
      end: string;
      status?: RestDay["status"];
      kind?: RestKind;
    }): Promise<RestDay[]> {
      const search = new URLSearchParams();
      search.set("start", params.start);
      search.set("end", params.end);
      if (params.status) search.set("status", params.status);
      if (params.kind) search.set("kind", params.kind);
      const payload = await request<{ items: RestDay[] }>(`/rest-days?${search.toString()}`);
      return payload.items;
    },
    async create(input: Omit<RestDay, "id">): Promise<RestDay> {
      const payload = await request<{ item: RestDay }>("/rest-days", {
        method: "POST",
        body: input,
      });
      return payload.item;
    },
    async upsertMany(rows: Array<Omit<RestDay, "id">>): Promise<RestDay[]> {
      const payload = await request<{ items: RestDay[] }>("/rest-days/upsert", {
        method: "POST",
        body: { rows },
      });
      return payload.items;
    },
    async delete(id: string): Promise<void> {
      await request<void>(`/rest-days/${id}`, { method: "DELETE" });
    },
    async deleteByDates(dates: string[]): Promise<number> {
      if (dates.length === 0) return 0;
      const payload = await request<{ count: number }>("/rest-days/delete-by-dates", {
        method: "POST",
        body: { dates },
      });
      return payload.count;
    },
  },
  vacations: {
    async list(): Promise<Vacation[]> {
      const payload = await request<{ items: Vacation[] }>("/vacations");
      return payload.items;
    },
    async create(input: Omit<Vacation, "id" | "created_at">): Promise<Vacation> {
      const payload = await request<{ item: Vacation }>("/vacations", {
        method: "POST",
        body: input,
      });
      return payload.item;
    },
    async delete(id: string): Promise<void> {
      await request<void>(`/vacations/${id}`, { method: "DELETE" });
    },
  },
  imports: {
    async importBokuKumasala(since?: string) {
      return request<{ imported: number; skipped: number; total: number }>(
        "/imports/boku-kumasala",
        {
          method: "POST",
          body: since ? { since } : {},
        }
      );
    },
  },
};