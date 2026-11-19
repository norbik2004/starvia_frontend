/**
 * Calendar module of the v1 API.
 *
 * - Every user owns at most one content calendar (`GET /v1/calendars`).
 * - A calendar holds entries: `{ id, postId, scheduledAt, status }`. An entry only references a
 *   post (no title/body), so post data has to be resolved separately.
 * - `CalendarEntryStatus` mirrors the backend enum:
 *   Scheduled = 0, Processing = 1, Published = 2, Failed = 3, Cancelled = 4.
 */

export const CALENDAR_ENTRY_STATUS_OPTIONS = [
  { value: 'Scheduled', label: 'Zaplanowany', icon: 'schedule' },
  { value: 'Processing', label: 'Publikowanie', icon: 'autorenew' },
  { value: 'Published', label: 'Opublikowany', icon: 'check_circle' },
  { value: 'Failed', label: 'Nieudany', icon: 'error' },
  { value: 'Cancelled', label: 'Anulowany', icon: 'block' },
] as const;

export type CalendarEntryStatus = (typeof CALENDAR_ENTRY_STATUS_OPTIONS)[number]['value'];

const STATUS_BY_NUMBER: Record<number, CalendarEntryStatus> = {
  0: 'Scheduled',
  1: 'Processing',
  2: 'Published',
  3: 'Failed',
  4: 'Cancelled',
};

const STATUS_BY_NAME = new Map<string, CalendarEntryStatus>([
  ...CALENDAR_ENTRY_STATUS_OPTIONS.map((option) => [option.value.toLowerCase(), option.value] as const),
  ['canceled', 'Cancelled'],
]);

export type CalendarEntry = {
  id: string;
  postId: string;
  /** ISO date-time. */
  scheduledAt: string;
  status: CalendarEntryStatus;
};

export type ContentCalendar = {
  id: string;
  name: string;
  createdAt: string;
  entries: CalendarEntry[];
};

export type AddCalendarEntryPayload = {
  calendarId: string;
  postId: string;
  /** ISO date-time (UTC). */
  scheduledAt: string;
};

/** Backend validator: required, max 100 characters. */
export const CALENDAR_NAME_MAX_LENGTH = 100;
export const DEFAULT_CALENDAR_NAME = 'Mój kalendarz treści';

export function parseCalendarEntryStatus(value: unknown): CalendarEntryStatus {
  if (typeof value === 'number' && STATUS_BY_NUMBER[value]) {
    return STATUS_BY_NUMBER[value];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const byName = STATUS_BY_NAME.get(trimmed);
    if (byName) {
      return byName;
    }

    const numeric = Number(trimmed);
    if (trimmed !== '' && Number.isInteger(numeric) && STATUS_BY_NUMBER[numeric]) {
      return STATUS_BY_NUMBER[numeric];
    }
  }

  return 'Scheduled';
}

export function getCalendarEntryStatusLabel(status: CalendarEntryStatus): string {
  return CALENDAR_ENTRY_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function getCalendarEntryStatusIcon(status: CalendarEntryStatus): string {
  return CALENDAR_ENTRY_STATUS_OPTIONS.find((option) => option.value === status)?.icon ?? 'schedule';
}

export function getCalendarEntryStatusClass(status: CalendarEntryStatus): string {
  return `calendar-status--${status.toLowerCase()}`;
}

/** Only entries still waiting in the queue can be moved to another time. */
export function isCalendarEntryReschedulable(entry: Pick<CalendarEntry, 'status'>): boolean {
  return entry.status === 'Scheduled';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseCalendarEntry(value: unknown): CalendarEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record['id'] ?? record['Id'] ?? record['calendarEntryId'] ?? record['CalendarEntryId']);
  const postId = readString(record['postId'] ?? record['PostId']);
  const scheduledAt = readString(record['scheduledAt'] ?? record['ScheduledAt']);

  if (!id || !postId || !scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
    return null;
  }

  return {
    id,
    postId,
    scheduledAt,
    status: parseCalendarEntryStatus(record['status'] ?? record['Status']),
  };
}

export function parseContentCalendar(value: unknown): ContentCalendar | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record['id'] ?? record['Id'] ?? record['contentCalendarId'] ?? record['ContentCalendarId']);
  if (!id) {
    return null;
  }

  const rawEntries = record['calendarEntries'] ?? record['CalendarEntries'] ?? record['entries'];
  const entries = Array.isArray(rawEntries)
    ? rawEntries.map(parseCalendarEntry).filter((entry): entry is CalendarEntry => entry !== null)
    : [];

  return {
    id,
    name: readString(record['name'] ?? record['Name']) ?? DEFAULT_CALENDAR_NAME,
    createdAt: readString(record['createdAt'] ?? record['CreatedAt']) ?? '',
    entries,
  };
}

/**
 * Reads the id out of an "add" response. Depending on the endpoint wrapper the id comes back as
 * `{ <idKey> }`, `{ items: [{ <idKey> }] }` or a bare string.
 */
export function parseCreatedId(value: unknown, idKey: string): string | null {
  const direct = readString(value);
  if (direct) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const pascalKey = idKey.charAt(0).toUpperCase() + idKey.slice(1);
  const fromRecord = readString(record[idKey] ?? record[pascalKey] ?? record['id'] ?? record['Id']);
  if (fromRecord) {
    return fromRecord;
  }

  const items = record['items'] ?? record['Items'];
  return Array.isArray(items) && items.length > 0 ? parseCreatedId(items[0], idKey) : null;
}
