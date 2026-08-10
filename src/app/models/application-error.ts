import { HttpErrorResponse } from '@angular/common/http';

export type ApplicationError = {
  description: string;
};

const DEFAULT_UNEXPECTED_DESCRIPTION =
  'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.';

export function toApplicationError(
  error: unknown,
  fallbackDescription = 'Something went wrong. Please try again.',
  unexpectedDescription = DEFAULT_UNEXPECTED_DESCRIPTION
): ApplicationError {
  if (error instanceof HttpErrorResponse) {
    if (isUnexpectedHttpFailure(error)) {
      return {
        description: unexpectedDescription,
      };
    }

    return {
      description: getErrorDescription(error.error) ?? fallbackDescription,
    };
  }

  return {
    description: fallbackDescription,
  };
}

function isUnexpectedHttpFailure(error: HttpErrorResponse): boolean {
  return error.status === 0 || error.status >= 500;
}

function getErrorDescription(errorBody: unknown): string | null {
  if (
    errorBody &&
    typeof errorBody === 'object' &&
    'description' in errorBody &&
    typeof errorBody.description === 'string'
  ) {
    return errorBody.description;
  }

  if (typeof errorBody === 'string') {
    const trimmed = errorBody.trim();
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

  return null;
}
