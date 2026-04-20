import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ActivityType = string;

export const BUILTIN_ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: "prestation", label: "Prestation" },
  { value: "deplacement", label: "Déplacement" },
  { value: "formation", label: "Formation" },
  { value: "pause", label: "Pause" },
  { value: "autre", label: "Autre" },
];

export interface CustomActivityType {
  id: string;
  user_id: string;
  value: string;
  label: string;
}

export interface Activity {
  id: string;
  user_id: string;
  title: string;
  activity_type: ActivityType;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  source: string;
  external_id: string;
}

export interface ContractSettings {
  id: string;
  user_id: string;
  weekly_hours: number;
  daily_max_hours: number;
  min_rest_hours: number;
  overtime_rate: number;
}

export interface RestRules {
  id: string;
  user_id: string;
  preferred_rest_days: number[];
  preferred_time_of_day: string;
  min_consecutive_rest_days: number;
  auto_suggest: boolean;
}

export interface RestDay {
  id: string;
  user_id: string;
  rest_date: string;
  status: "suggested" | "validated" | "rejected";
  reason: string;
}

export type UserRole = "logisticien" | "animateur" | "manager";

export const ROLE_LABELS: Record<UserRole, string> = {
  logisticien: "Logisticien",
  animateur: "Animateur",
  manager: "Manager",
};

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
}
