/**
 * UserPlatforms module of the v1 API (`/v1/user-platforms`).
 */

import {
  PlatformType,
  getPlatformBrandClass,
  getPlatformTypeLabel,
} from './platform';

export { PlatformType, getPlatformTypeLabel } from './platform';

/** @deprecated Prefer `PlatformType.LinkedIn`. Kept for existing LinkedIn checks. */
export const LINKEDIN_PLATFORM_TYPE = PlatformType.LinkedIn;

/** @deprecated Use `LINKEDIN_PLATFORM_TYPE`. */
export const LINKEDIN_PLATFORM_ID = LINKEDIN_PLATFORM_TYPE;

/** Mirrors browse `SortBy` query enum (int). */
export enum UserPlatformSortBy {
  CreatedAt = 0,
  AccountUsername = 1,
}

export const USER_PLATFORM_DEFAULT_PAGE_SIZE = 20;

export type UserPlatform = {
  id: string;
  platformType: PlatformType;
  accountUsername: string | null;
  createdAt: string;
  externalAccountId: string | null;
  accountComment: string | null;
  profilePictureLink: string | null;
  ownerId: string | null;
};

export type BrowseUserPlatformsQuery = {
  platformType?: PlatformType | null;
  ownerId?: string | null;
  sortBy?: UserPlatformSortBy | null;
  descending?: boolean | null;
  page?: number;
  pageSize?: number;
  search?: string | null;
};

export type PagedUserPlatformsResponse = {
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  items: UserPlatform[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type AddUserPlatformPayload = {
  platformId: string;
  accountUserName: string;
  accountComment?: string | null;
};

export function userPlatformPhotoKey(connection: UserPlatform): string {
  return connection.id;
}

/** @deprecated Prefer `getPlatformTypeLabel`. */
export function getPlatformLabel(platformType: PlatformType | number): string {
  return getPlatformTypeLabel(platformType);
}

export function getConnectablePlatformBrandClass(platformType: PlatformType | number): string {
  return getPlatformBrandClass(getPlatformTypeLabel(platformType));
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readUuid(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parsePlatformType(value: unknown): PlatformType | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2) {
    return value as PlatformType;
  }

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber >= 0 && asNumber <= 2) {
      return asNumber as PlatformType;
    }

    switch (trimmed.toLowerCase()) {
      case 'linkedin':
        return PlatformType.LinkedIn;
      case 'facebook':
        return PlatformType.Facebook;
      case 'instagram':
        return PlatformType.Instagram;
      default:
        return null;
    }
  }

  return null;
}

export function parseUserPlatform(value: unknown): UserPlatform | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(record['id'] ?? record['Id'] ?? record['userPlatformId'] ?? record['UserPlatformId']);
  const platformType = parsePlatformType(record['platformType'] ?? record['PlatformType']);

  if (!id || platformType === null) {
    return null;
  }

  return {
    id,
    platformType,
    accountUsername: readNullableString(record['accountUsername'] ?? record['AccountUsername']),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    externalAccountId: readNullableString(record['externalAccountId'] ?? record['ExternalAccountId']),
    accountComment: readNullableString(record['accountComment'] ?? record['AccountComment']),
    profilePictureLink: readNullableString(
      record['profilePictureLink'] ??
        record['ProfilePictureLink'] ??
        record['profilePictureUrl'] ??
        record['ProfilePictureUrl'],
    ),
    ownerId: readUuid(record['ownerId'] ?? record['OwnerId']),
  };
}

export function parsePagedUserPlatformsResponse(value: unknown): PagedUserPlatformsResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const pageIndex = record['page'] ?? record['Page'];
  const totalPages = record['totalPages'] ?? record['TotalPages'];
  const totalCount = record['totalCount'] ?? record['TotalCount'];
  const items = record['items'] ?? record['Items'];

  if (typeof pageIndex !== 'number' || typeof totalPages !== 'number' || !Array.isArray(items)) {
    return null;
  }

  const parsedItems = items
    .map(parseUserPlatform)
    .filter((item): item is UserPlatform => item !== null);

  return {
    pageIndex,
    totalPages,
    totalCount: typeof totalCount === 'number' ? totalCount : parsedItems.length,
    items: parsedItems,
    hasPreviousPage: pageIndex > 1,
    hasNextPage: pageIndex < totalPages,
  };
}

/** Flat list helper when the API returns an array or a paged envelope. */
export function parseUserPlatformsResponse(value: unknown): UserPlatform[] {
  const paged = parsePagedUserPlatformsResponse(value);
  if (paged) {
    return paged.items;
  }

  if (Array.isArray(value)) {
    return value.map(parseUserPlatform).filter((item): item is UserPlatform => item !== null);
  }

  const single = parseUserPlatform(value);
  return single ? [single] : [];
}

export function parseCreatedUserPlatformId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = readUuid(
    record['userPlatformId'] ?? record['UserPlatformId'] ?? record['id'] ?? record['Id'],
  );
  if (direct) {
    return direct;
  }

  const items = record['items'] ?? record['Items'];
  if (Array.isArray(items) && items.length > 0) {
    return parseCreatedUserPlatformId(items[0]);
  }

  return null;
}
