export type ConfirmEmailAccessPayload = {
  email: string;
  userId?: string | null;
};

export type ConfirmEmailAccess = ConfirmEmailAccessPayload & {
  expiresAt: number;
};

const ACCESS_KEY = 'auth:confirm-email:access';
const TTL_MS = 30 * 60_000;

function isAccess(value: unknown): value is ConfirmEmailAccess {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['email'] === 'string' &&
    record['email'].trim().length > 0 &&
    typeof record['expiresAt'] === 'number' &&
    (record['userId'] === undefined ||
      record['userId'] === null ||
      typeof record['userId'] === 'string')
  );
}

export function grantConfirmEmailAccess(payload: ConfirmEmailAccessPayload): void {
  const email = payload.email.trim();
  if (!email) return;

  const access: ConfirmEmailAccess = {
    email,
    userId:
      typeof payload.userId === 'string' && payload.userId.trim().length
        ? payload.userId.trim()
        : null,
    expiresAt: Date.now() + TTL_MS,
  };

  try {
    sessionStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {
    // no-op
  }
}

export function readConfirmEmailAccess(): ConfirmEmailAccess | null {
  try {
    const raw = sessionStorage.getItem(ACCESS_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isAccess(parsed) || parsed.expiresAt <= Date.now()) {
      clearConfirmEmailAccess();
      return null;
    }

    return parsed;
  } catch {
    clearConfirmEmailAccess();
    return null;
  }
}

export function hasValidConfirmEmailAccess(): boolean {
  return readConfirmEmailAccess() !== null;
}

export function clearConfirmEmailAccess(): void {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    // no-op
  }
}

export function readConfirmEmailFromHistoryState(state: unknown): ConfirmEmailAccessPayload | null {
  if (!state || typeof state !== 'object') return null;
  const record = state as Record<string, unknown>;
  const email = record['email'];
  if (typeof email !== 'string' || !email.trim()) return null;

  const userId = record['userId'];
  return {
    email: email.trim(),
    userId: typeof userId === 'string' && userId.trim() ? userId.trim() : null,
  };
}
