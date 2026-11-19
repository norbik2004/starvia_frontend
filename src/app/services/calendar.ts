import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  parseContentCalendar,
  parseCreatedId,
  type AddCalendarEntryPayload,
  type ContentCalendar,
} from '../models/calendar';

const CALENDAR_NOT_FOUND_CODE = 'calendar_not_found';

/**
 * The API reports business errors as `400 { errors: [{ code, message }] }`, so a missing calendar
 * arrives as `400 calendar_not_found` (the Swagger document advertises 404 for the same case).
 */
function isCalendarNotFound(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  const errors = (error.error as { errors?: unknown } | null)?.errors;
  return (
    error.status === 400 &&
    Array.isArray(errors) &&
    errors.some(
      (entry) => (entry as { code?: unknown } | null)?.code === CALENDAR_NOT_FOUND_CODE,
    )
  );
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly calendarsUrl = new URL('calendars', environment.backendUrl).toString();
  private readonly entriesUrl = new URL('calendar-entries', environment.backendUrl).toString();

  /** Emits `null` when the user has not created a calendar yet. */
  getMyCalendar(): Observable<ContentCalendar | null> {
    return this.http.get<unknown>(this.calendarsUrl).pipe(
      map((response) => {
        const parsed = parseContentCalendar(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (kalendarz).');
        }

        return parsed;
      }),
      catchError((error: unknown) => (isCalendarNotFound(error) ? of(null) : throwError(() => error))),
    );
  }

  /** Creates the (single) calendar of the user and returns it. */
  createCalendar(name: string): Observable<ContentCalendar> {
    return this.http.post<unknown>(this.calendarsUrl, { name }).pipe(
      switchMap((response) => {
        const id = parseCreatedId(response, 'contentCalendarId');
        if (id) {
          return of<ContentCalendar>({ id, name, createdAt: new Date().toISOString(), entries: [] });
        }

        return this.getMyCalendar().pipe(
          map((calendar) => {
            if (!calendar) {
              throw new Error('Nieprawidłowa odpowiedź serwera (kalendarz).');
            }

            return calendar;
          }),
        );
      }),
    );
  }

  renameCalendar(contentCalendarId: string, name: string): Observable<void> {
    return this.http
      .put<unknown>(this.calendarsUrl, { contentCalendarId, name })
      .pipe(map(() => undefined));
  }

  deleteCalendar(contentCalendarId: string): Observable<void> {
    return this.http.request<void>('DELETE', this.calendarsUrl, { body: { contentCalendarId } });
  }

  /** Returns the id of the new entry (its status always starts as `Scheduled`). */
  addEntry(payload: AddCalendarEntryPayload): Observable<string> {
    return this.http.post<unknown>(this.entriesUrl, payload).pipe(
      map((response) => {
        const id = parseCreatedId(response, 'calendarEntryId');
        if (!id) {
          throw new Error('Nieprawidłowa odpowiedź serwera (wpis kalendarza).');
        }

        return id;
      }),
    );
  }

  updateEntry(calendarEntryId: string, scheduledAt: string): Observable<void> {
    return this.http
      .put<unknown>(this.entriesUrl, { calendarEntryId, scheduledAt })
      .pipe(map(() => undefined));
  }

  removeEntry(calendarEntryId: string): Observable<void> {
    return this.http.request<void>('DELETE', this.entriesUrl, { body: { calendarEntryId } });
  }
}
