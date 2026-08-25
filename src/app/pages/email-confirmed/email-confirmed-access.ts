import type { ConfirmEmailRequest } from '../../services/auth';

export function readEmailConfirmationCallback(query: {
  get(name: string): string | null;
}): ConfirmEmailRequest | null {
  const userId = query.get('userId')?.trim();
  const code = query.get('code');

  if (!userId || !code?.trim()) {
    return null;
  }

  return { userId, code };
}
