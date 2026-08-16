export type SignInResponse = {
  accessToken: string;
  expiresAt: number;
  userId: string;
  email: string;
  roles: string[];
};

export type AuthenticatedUser = {
  userId: string;
  email: string;
  roles: readonly string[];
};

export type AuthSession = {
  accessToken: string;
  expiresAtMs: number;
  user: AuthenticatedUser;
};

const UNIX_MILLISECONDS_THRESHOLD = 10_000_000_000;

export function parseSignInResponse(response: unknown): AuthSession {
  const body = parseResponseBody(response);

  if (!isRecord(body)) {
    throw new Error('Invalid sign-in response.');
  }

  const accessToken = readRequiredString(body, 'accessToken');
  const userId = readRequiredString(body, 'userId');
  const email = readRequiredString(body, 'email');
  const expiresAt = body['expiresAt'];
  const roles = body['roles'];

  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    throw new Error('Invalid sign-in expiration.');
  }

  if (!Array.isArray(roles) || roles.some((role) => typeof role !== 'string')) {
    throw new Error('Invalid sign-in roles.');
  }

  const expiresAtMs = expiresAt < UNIX_MILLISECONDS_THRESHOLD ? expiresAt * 1000 : expiresAt;

  if (expiresAtMs <= Date.now()) {
    throw new Error('Received an expired access token.');
  }

  return {
    accessToken,
    expiresAtMs,
    user: {
      userId,
      email,
      roles: roles.map((role) => role.trim()).filter(Boolean),
    },
  };
}

function parseResponseBody(response: unknown): unknown {
  if (typeof response !== 'string') {
    return response;
  }

  try {
    return JSON.parse(response);
  } catch {
    throw new Error('Invalid sign-in response.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid sign-in ${key}.`);
  }

  return value.trim();
}
