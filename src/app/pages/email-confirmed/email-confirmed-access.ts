export type EmailConfirmedAccessPayload = {
  status: 'success' | 'error';
  email: string | null;
  message: string | null;
};

export type EmailConfirmedAccess = EmailConfirmedAccessPayload & {
  expiresAt: number;
};

const ACCESS_KEY = 'auth:email-confirmed:access';
const USED_TICKETS_KEY = 'auth:email-confirmed:used-tickets';
const SUCCESS_TTL_MS = 60_000;
const ERROR_TTL_MS = 20 * 60_000;
const MAX_USED_TICKETS = 50;
const MIN_TICKET_LENGTH = 8;

function isAccess(value: unknown): value is EmailConfirmedAccess {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record['status'] === 'success' || record['status'] === 'error') &&
    (record['email'] === null || typeof record['email'] === 'string') &&
    (record['message'] === null || typeof record['message'] === 'string') &&
    typeof record['expiresAt'] === 'number'
  );
}

function readUsedTickets(): string[] {
  try {
    const raw = localStorage.getItem(USED_TICKETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeUsedTickets(tickets: string[]): void {
  try {
    localStorage.setItem(USED_TICKETS_KEY, JSON.stringify(tickets.slice(-MAX_USED_TICKETS)));
  } catch {
    // no-op
  }
}

/** One-time pass from backend redirect: ticket | token | code */
export function readEmailConfirmedTicket(
  query: Pick<{ get(name: string): string | null }, 'get'>
): string | null {
  const raw = query.get('ticket') ?? query.get('token') ?? query.get('code');
  if (typeof raw !== 'string') return null;
  const ticket = raw.trim();
  if (ticket.length < MIN_TICKET_LENGTH) return null;
  return ticket;
}

export function isEmailConfirmedTicketUsed(ticket: string): boolean {
  return readUsedTickets().includes(ticket);
}

/** Marks ticket as consumed. Returns false if it was already used. */
export function consumeEmailConfirmedTicket(ticket: string): boolean {
  const used = readUsedTickets();
  if (used.includes(ticket)) return false;
  writeUsedTickets([...used, ticket]);
  return true;
}

export function grantEmailConfirmedAccess(payload: EmailConfirmedAccessPayload): void {
  const ttlMs = payload.status === 'error' ? ERROR_TTL_MS : SUCCESS_TTL_MS;
  const access: EmailConfirmedAccess = {
    ...payload,
    expiresAt: Date.now() + ttlMs,
  };

  try {
    sessionStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readEmailConfirmedAccess(): EmailConfirmedAccess | null {
  try {
    const raw = sessionStorage.getItem(ACCESS_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isAccess(parsed) || parsed.expiresAt <= Date.now()) {
      clearEmailConfirmedAccess();
      return null;
    }

    return parsed;
  } catch {
    clearEmailConfirmedAccess();
    return null;
  }
}

export function hasValidEmailConfirmedAccess(): boolean {
  return readEmailConfirmedAccess() !== null;
}

export function clearEmailConfirmedAccess(): void {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    // no-op
  }
}

/**
 * Validates callback query: status + fresh one-time ticket.
 * Bare ?status=error is rejected.
 */
export function tryClaimEmailConfirmedCallback(query: {
  get(name: string): string | null;
}): EmailConfirmedAccessPayload | null {
  const status = query.get('status');
  if (status !== 'success' && status !== 'error') return null;

  const ticket = readEmailConfirmedTicket(query);
  if (!ticket) return null;
  if (!consumeEmailConfirmedTicket(ticket)) return null;

  const emailRaw = query.get('email');
  const messageRaw = query.get('message');

  return {
    status,
    email: typeof emailRaw === 'string' && emailRaw.trim().length ? emailRaw.trim() : null,
    message:
      status === 'error' && typeof messageRaw === 'string' && messageRaw.trim().length
        ? messageRaw.trim()
        : null,
  };
}
