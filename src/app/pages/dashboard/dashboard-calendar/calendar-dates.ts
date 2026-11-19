/** Date helpers for the calendar. Everything works in the user's local time zone; weeks start on Monday. */

/** The calendar UI is Polish regardless of the app-wide locale. */
export const CALENDAR_LOCALE = 'pl-PL';

/** Intl returns lower-case month names in Polish ("październik 2026"); headings read better capitalised. */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(CALENDAR_LOCALE) + text.slice(1);
}

export type CalendarDay = {
  date: Date;
  key: string;
  inMonth: boolean;
};

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function isSameDay(left: Date, right: Date): boolean {
  return dayKey(left) === dayKey(right);
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` in local time — stable key for grouping entries by day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for `<input type="date">`. */
export function toDateInputValue(date: Date): string {
  return dayKey(date);
}

/** Value for `<input type="time">`. */
export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines `<input type="date">` and `<input type="time">` values into a local `Date`; `null` when incomplete. */
export function fromInputValues(dateValue: string, timeValue: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hours, minutes] = [Number(timeMatch[1]), Number(timeMatch[2])];
  const result = new Date(year, month - 1, day, hours, minutes);

  // `new Date(2026, 1, 31)` silently rolls over to March — reject such input.
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
    return null;
  }

  return result;
}

/** Keeps the clock time of `time` and moves it to the calendar day of `day`. */
export function moveToDay(time: Date, day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
}

/** Weeks (Mon–Sun) needed to show the whole month, padded with days of neighbouring months. */
export function buildMonthWeeks(month: Date): CalendarDay[][] {
  const first = startOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weekCount = Math.ceil((mondayOffset + daysInMonth) / 7);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + weekIndex * 7 + dayIndex,
      );

      return { date, key: dayKey(date), inMonth: isSameMonth(date, first) };
    }),
  );
}

export function nextMondayAt(now: Date, hours: number, minutes = 0): Date {
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday, hours, minutes);
}

export function tomorrowAt(now: Date, hours: number, minutes = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
}

/** Rounds `date` up to the next quarter of an hour (and at least one minute ahead). */
export function roundUpToQuarter(date: Date): Date {
  const result = new Date(date.getTime());
  result.setSeconds(0, 0);
  const remainder = result.getMinutes() % 15;
  result.setMinutes(result.getMinutes() + (remainder === 0 ? 15 : 15 - remainder));
  return result;
}
