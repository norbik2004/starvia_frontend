import { PLATFORM_TYPES } from './post';
import { getPlatformBrandClass, LINKEDIN_PLATFORM_ID } from './platform';

export { LINKEDIN_PLATFORM_ID };

export function userPlatformPhotoKey(connection: UserPlatform): string {
  return String(connection.id);
}

export type UserPlatform = {
  id: number;
  platformId: number;
  externalAccountId: string;
  accountUsername: string;
  accountComment: string;
  profilePictureLink: string | null;
};

export type UpdateUserPlatformRequest = {
  accountUsername: string;
  accountComment: string;
};

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseOptionalString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function parseNumericId(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function parseOptionalIdentifier(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function parsePlatformId(record: Record<string, unknown>): number | null {
  const nestedPlatform = record['platform'] ?? record['Platform'];
  const candidates: unknown[] = [
    record['platformId'],
    record['PlatformId'],
    record['platformType'],
    record['PlatformType'],
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['id']
      : null,
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['Id']
      : null,
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['name']
      : null,
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['Name']
      : null,
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['type']
      : null,
    typeof nestedPlatform === 'object' && nestedPlatform !== null
      ? (nestedPlatform as Record<string, unknown>)['Type']
      : null,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }

      const byLabel = PLATFORM_TYPES.find(
        (platform) => platform.label.toLowerCase() === trimmed.toLowerCase()
      );
      if (byLabel) {
        return byLabel.value;
      }
    }
  }

  return null;
}

export function parseUserPlatform(value: unknown): UserPlatform | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = parseNumericId(record, 'id', 'Id');
  const platformId = parsePlatformId(record);
  const externalAccountId =
    parseOptionalIdentifier(
      record,
      'externalAccountId',
      'ExternalAccountId',
      'sub',
      'Sub'
    ) ?? (id !== null ? String(id) : null);
  const accountUsername =
    parseOptionalString(record, 'accountUsername', 'AccountUsername', 'name', 'Name') ??
    externalAccountId;

  if (id === null || platformId === null || !accountUsername) {
    return null;
  }

  return {
    id,
    platformId,
    externalAccountId: externalAccountId ?? String(id),
    accountUsername,
    accountComment: parseOptionalString(record, 'accountComment', 'AccountComment') ?? '',
    profilePictureLink: parseOptionalString(
      record,
      'profilePictureLink',
      'ProfilePictureLink',
      'profilePictureUrl',
      'ProfilePictureUrl',
      'pfpUrl',
      'PFPurl',
      'PfpUrl'
    ),
  };
}

function extractPlatformItems(value: unknown): unknown[] {
  const normalized = typeof value === 'string' ? tryParseJson(value) : value;

  if (Array.isArray(normalized)) {
    return normalized;
  }

  if (!normalized || typeof normalized !== 'object') {
    return [];
  }

  const record = normalized as Record<string, unknown>;
  const collectionKeys = [
    'items',
    'Items',
    'userPlatforms',
    'UserPlatforms',
    'data',
    'Data',
    'results',
    'Results',
    'value',
    'Value',
  ];

  for (const key of collectionKeys) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  const single = parseUserPlatform(normalized);
  return single ? [single] : [];
}

export function parseUserPlatformsResponse(value: unknown): UserPlatform[] {
  return extractPlatformItems(value)
    .map(parseUserPlatform)
    .filter((item): item is UserPlatform => item !== null);
}

export function getPlatformLabel(platformId: number): string {
  return PLATFORM_TYPES.find((platform) => platform.value === platformId)?.label ?? 'Platform';
}

export function getConnectablePlatformBrandClass(platformId: number): string {
  const label = getPlatformLabel(platformId);
  return getPlatformBrandClass(label);
}
