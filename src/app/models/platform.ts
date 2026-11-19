/**
 * Platforms catalogue of the v1 API (`/v1/platforms`).
 */

/** Mirrors `StarviaBackend.Modules.Platforms.Core.Platforms.Enums.PlatformType`. */
export enum PlatformType {
  LinkedIn = 0,
  Facebook = 1,
  Instagram = 2,
}

export type Platform = {
  id: string;
  platformType: PlatformType;
  /** Display label derived from `platformType` (e.g. LinkedIn). */
  type: string;
  isOnline: boolean;
};

export type PlatformCategory = {
  key: string;
  label: string;
  icon: string;
  matcher: (platform: Platform) => boolean;
};

/** @deprecated Prefer `PlatformType.LinkedIn`. */
export const LINKEDIN_PLATFORM_ID = PlatformType.LinkedIn;

export const PLATFORM_CATEGORIES: readonly PlatformCategory[] = [
  {
    key: 'professional',
    label: 'Professional networks',
    icon: 'work',
    matcher: (platform) => platform.platformType === PlatformType.LinkedIn,
  },
  {
    key: 'social',
    label: 'Social networks',
    icon: 'people',
    matcher: (platform) =>
      platform.platformType === PlatformType.Facebook ||
      platform.platformType === PlatformType.Instagram,
  },
] as const;

export function getPlatformTypeLabel(platformType: PlatformType | number): string {
  switch (platformType) {
    case PlatformType.LinkedIn:
      return 'LinkedIn';
    case PlatformType.Facebook:
      return 'Facebook';
    case PlatformType.Instagram:
      return 'Instagram';
    default:
      return `Platform ${platformType}`;
  }
}

function readUuid(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parsePlatformTypeValue(value: unknown): PlatformType | null {
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

export function parsePlatform(value: unknown): Platform | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(record['id'] ?? record['Id']);
  const platformType = parsePlatformTypeValue(record['platformType'] ?? record['PlatformType']);

  if (!id || platformType === null) {
    return null;
  }

  return {
    id,
    platformType,
    type: getPlatformTypeLabel(platformType),
    isOnline: record['isOnline'] === true || record['IsOnline'] === true,
  };
}

export function parsePlatformsResponse(value: unknown): Platform[] {
  if (Array.isArray(value)) {
    return value.map(parsePlatform).filter((item): item is Platform => item !== null);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const items = record['items'] ?? record['Items'];
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(parsePlatform).filter((item): item is Platform => item !== null);
}

export function groupPlatformsByCategory(
  platforms: readonly Platform[],
): { category: PlatformCategory; platforms: Platform[] }[] {
  return PLATFORM_CATEGORIES.map((category) => ({
    category,
    platforms: platforms.filter(category.matcher),
  })).filter((group) => group.platforms.length > 0);
}

export function isPlatformConnectable(platform: Platform): boolean {
  return platform.platformType === PlatformType.LinkedIn && platform.isOnline;
}

export function getPlatformBrandClass(type: string): string {
  switch (type.toLowerCase()) {
    case 'linkedin':
      return 'social-account-card--linkedin';
    case 'facebook':
      return 'social-account-card--facebook';
    case 'instagram':
      return 'social-account-card--instagram';
    default:
      return '';
  }
}

export function getPlatformDescription(type: string): string {
  switch (type.toLowerCase()) {
    case 'linkedin':
      return 'Publish posts to your LinkedIn profile.';
    case 'facebook':
      return 'Share content on your Facebook page.';
    case 'instagram':
      return 'Post visuals to your Instagram account.';
    default:
      return 'Connect this platform to Starvia.';
  }
}
