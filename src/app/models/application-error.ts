import { HttpErrorResponse } from '@angular/common/http';

export type ApplicationError = {
  description: string;
};

const DEFAULT_FALLBACK_DESCRIPTION = 'Coś poszło nie tak. Spróbuj ponownie.';
const DEFAULT_UNEXPECTED_DESCRIPTION =
  'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.';
const NETWORK_DESCRIPTION = 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
const FORBIDDEN_DESCRIPTION = 'Nie masz uprawnień do wykonania tej operacji.';
const TOO_MANY_REQUESTS_DESCRIPTION = 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';

/**
 * Turns any thrown value into the one message the UI shows. Order of precedence for HTTP errors:
 * message sent by the backend → status specific text → the caller's `fallbackDescription`.
 * Network failures and 5xx never leak backend internals; they use a generic text.
 */
export function toApplicationError(
  error: unknown,
  fallbackDescription = DEFAULT_FALLBACK_DESCRIPTION,
  unexpectedDescription = DEFAULT_UNEXPECTED_DESCRIPTION
): ApplicationError {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return {
        description:
          unexpectedDescription === DEFAULT_UNEXPECTED_DESCRIPTION
            ? NETWORK_DESCRIPTION
            : unexpectedDescription,
      };
    }

    if (error.status >= 500) {
      return { description: unexpectedDescription };
    }

    const fromBody = getErrorDescription(error.error);
    if (fromBody) {
      return { description: fromBody };
    }

    if (error.status === 403) {
      return { description: FORBIDDEN_DESCRIPTION };
    }
    if (error.status === 429) {
      return { description: TOO_MANY_REQUESTS_DESCRIPTION };
    }
  }

  return {
    description: fallbackDescription,
  };
}

function getErrorDescription(errorBody: unknown): string | null {
  if (typeof errorBody === 'string') {
    return parseStringBody(errorBody);
  }

  if (!errorBody || typeof errorBody !== 'object') {
    return null;
  }

  const body = errorBody as Record<string, unknown>;

  if (typeof body['description'] === 'string' && body['description'].trim()) {
    return body['description'].trim();
  }

  // ASP.NET `ProblemDetails`: `{ title, detail, status, errors? }`.
  if (typeof body['detail'] === 'string' && body['detail'].trim()) {
    return body['detail'].trim();
  }

  const errors = body['errors'];

  // Backend error envelope: `{ errors: [{ code, message }] }`.
  if (Array.isArray(errors)) {
    const messages = errors
      .map((entry: unknown) =>
        entry && typeof entry === 'object' && 'message' in entry && typeof entry.message === 'string'
          ? entry.message.trim()
          : '',
      )
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  // Validation `ProblemDetails`: `{ errors: { Field: ['message', ...] } }`.
  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .map((value) => value.trim());

    if (messages.length > 0) {
      return [...new Set(messages)].join(' ');
    }
  }

  return null;
}

function parseStringBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return getErrorDescription(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
