export const DEFAULT_ROLE = "logisticien" as const;

export const DEFAULT_CONTRACT_SETTINGS = {
  weekly_hours: 35,
  daily_max_hours: 10,
  min_rest_hours: 11,
  overtime_rate: 1.25,
};

export const DEFAULT_REST_RULES = {
  preferred_rest_days: [1, 5],
  preferred_time_of_day: "any",
  min_consecutive_rest_days: 1,
  auto_suggest: true,
};

export const DEFAULT_WEEK_SETTINGS = {
  rest_days: [6, 7],
  default_title: "Travail",
  default_type: "prestation",
  morning_start: "09:00",
  morning_end: "13:00",
  afternoon_start: "14:00",
  afternoon_end: "16:00",
  pause_start: "13:00",
  pause_end: "14:00",
  break_minutes: 60,
};