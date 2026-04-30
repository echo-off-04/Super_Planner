import type {
  Activity,
  ContractSettings,
  CustomActivityType,
  DefaultWeekSettings,
  Profile,
  RestDay,
  RestRules,
  Vacation,
} from "@prisma/client";
import { formatDateOnly } from "./date.js";
import type { SessionUser } from "./auth.js";

export function serializeUser(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
  };
}

export function serializeProfile(profile: Profile) {
  return {
    id: profile.id,
    full_name: profile.fullName,
    role: profile.role,
  };
}

export function serializeContract(contract: ContractSettings) {
  return {
    id: contract.id,
    user_id: contract.userId,
    weekly_hours: contract.weeklyHours,
    daily_max_hours: contract.dailyMaxHours,
    min_rest_hours: contract.minRestHours,
    overtime_rate: contract.overtimeRate,
  };
}

export function serializeRestRules(rules: RestRules) {
  return {
    id: rules.id,
    user_id: rules.userId,
    preferred_rest_days: rules.preferredRestDays,
    preferred_time_of_day: rules.preferredTimeOfDay,
    min_consecutive_rest_days: rules.minConsecutiveRestDays,
    auto_suggest: rules.autoSuggest,
  };
}

export function serializeDefaultWeek(settings: DefaultWeekSettings) {
  return {
    id: settings.id,
    user_id: settings.userId,
    rest_days: settings.restDays,
    default_title: settings.defaultTitle,
    default_type: settings.defaultType,
    morning_start: settings.morningStart,
    morning_end: settings.morningEnd,
    afternoon_start: settings.afternoonStart,
    afternoon_end: settings.afternoonEnd,
    pause_start: settings.pauseStart,
    pause_end: settings.pauseEnd,
    break_minutes: settings.breakMinutes,
  };
}

export function serializeActivityType(activityType: CustomActivityType) {
  return {
    id: activityType.id,
    user_id: activityType.userId,
    value: activityType.value,
    label: activityType.label,
  };
}

export function serializeActivity(activity: Activity) {
  return {
    id: activity.id,
    user_id: activity.userId,
    title: activity.title,
    activity_type: activity.activityType,
    start_time: activity.startTime.toISOString(),
    end_time: activity.endTime.toISOString(),
    location: activity.location,
    notes: activity.notes,
    source: activity.source,
    external_id: activity.externalId,
    duration_kind: activity.durationKind,
    break_minutes: activity.breakMinutes,
  };
}

export function serializeRestDay(restDay: RestDay) {
  return {
    id: restDay.id,
    user_id: restDay.userId,
    rest_date: formatDateOnly(restDay.restDate),
    status: restDay.status,
    reason: restDay.reason,
    rest_period: restDay.restPeriod,
    kind: restDay.kind,
  };
}

export function serializeVacation(vacation: Vacation) {
  return {
    id: vacation.id,
    user_id: vacation.userId,
    start_date: formatDateOnly(vacation.startDate),
    end_date: formatDateOnly(vacation.endDate),
    label: vacation.label,
    created_at: vacation.createdAt.toISOString(),
  };
}