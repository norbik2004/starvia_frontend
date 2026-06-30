export type UserAccount = {
  userName: string;
  email: string;
  profilePictureUrl: string | null;
};

function parseOptionalString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function parseUserAccount(value: unknown): UserAccount | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const userName =
    typeof record['userName'] === 'string'
      ? record['userName']
      : typeof record['UserName'] === 'string'
        ? record['UserName']
        : null;
  const email =
    typeof record['email'] === 'string'
      ? record['email']
      : typeof record['Email'] === 'string'
        ? record['Email']
        : null;

  if (!userName || !email) {
    return null;
  }

  const profilePictureUrl = parseOptionalString(
    record,
    'profilePictureUrl',
    'ProfilePictureUrl',
    'avatarUrl',
    'AvatarUrl',
    'profileImageUrl',
    'ProfileImageUrl',
    'pictureUrl',
    'PictureUrl'
  );

  return { userName, email, profilePictureUrl };
}

export function getUserInitials(userName: string): string {
  const parts = userName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
