import { formatDateISO } from "./time";

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface Holiday {
  date: string;
  name: string;
}

export function frenchHolidaysForYear(year: number): Holiday[] {
  const easter = easterSunday(year);
  const easterMonday = addDaysLocal(easter, 1);
  const ascension = addDaysLocal(easter, 39);
  const pentecostMonday = addDaysLocal(easter, 50);

  const fixed: Array<[number, number, string]> = [
    [1, 1, "Jour de l'An"],
    [5, 1, "Fête du Travail"],
    [5, 8, "Victoire 1945"],
    [7, 14, "Fête nationale"],
    [8, 15, "Assomption"],
    [11, 1, "Toussaint"],
    [11, 11, "Armistice 1918"],
    [12, 25, "Noël"],
  ];

  const items: Holiday[] = fixed.map(([m, d, name]) => ({
    date: formatDateISO(new Date(year, m - 1, d)),
    name,
  }));

  items.push(
    { date: formatDateISO(easterMonday), name: "Lundi de Pâques" },
    { date: formatDateISO(ascension), name: "Ascension" },
    { date: formatDateISO(pentecostMonday), name: "Lundi de Pentecôte" }
  );

  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function getFrenchHolidaysInRange(start: Date, end: Date): Holiday[] {
  const years = new Set<number>();
  const cur = new Date(start);
  while (cur <= end) {
    years.add(cur.getFullYear());
    cur.setMonth(cur.getMonth() + 1);
  }
  years.add(end.getFullYear());
  const startIso = formatDateISO(start);
  const endIso = formatDateISO(end);
  const all: Holiday[] = [];
  for (const y of years) {
    for (const h of frenchHolidaysForYear(y)) {
      if (h.date >= startIso && h.date <= endIso) all.push(h);
    }
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export function buildHolidayMap(holidays: Holiday[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of holidays) m.set(h.date, h.name);
  return m;
}

export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

export function holidayCreditHours(params: {
  dailyHours: number;
  restDays: number[];
  date: Date;
}): number {
  const wd = isoWeekday(params.date);
  if (params.restDays.includes(wd)) return 0;
  return params.dailyHours;
}

export function countHolidayCreditHours(params: {
  dailyHours: number;
  restDays: number[];
  holidays: Holiday[];
  rangeStart: Date;
  rangeEnd: Date;
}): { hours: number; count: number } {
  const startIso = formatDateISO(params.rangeStart);
  const endIso = formatDateISO(params.rangeEnd);
  let hours = 0;
  let count = 0;
  for (const h of params.holidays) {
    if (h.date < startIso || h.date > endIso) continue;
    const d = new Date(h.date + "T00:00:00");
    const credit = holidayCreditHours({
      dailyHours: params.dailyHours,
      restDays: params.restDays,
      date: d,
    });
    if (credit > 0) {
      hours += credit;
      count += 1;
    }
  }
  return { hours, count };
}
