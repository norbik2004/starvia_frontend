export type Platform = {
  id: number;
  type: string;
};

export type PlatformCategory = {
  key: string;
  label: string;
  icon: string;
  matcher: (platform: Platform) => boolean;
};

export const LINKEDIN_PLATFORM_ID = 1;

export const PLATFORM_CATEGORIES: readonly PlatformCategory[] = [
  {
    key: 'professional',
    label: 'Professional networks',
    icon: 'work',
    matcher: (platform) => platform.type.toLowerCase() === 'linkedin',
  },
  {
    key: 'social',
    label: 'Social networks',
    icon: 'people',
    matcher: (platform) => ['facebook', 'instagram'].includes(platform.type.toLowerCase()),
  },
] as const;

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

function parsePlatformId(record: Record<string, unknown>): number | null {
  const value = record['id'] ?? record['Id'];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePlatformType(record: Record<string, unknown>): string | null {
  const value = record['type'] ?? record['Type'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parsePlatform(value: unknown): Platform | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = parsePlatformId(record);
  const type = parsePlatformType(record);

  if (id === null || !type) {
    return null;
  }

  return { id, type };
}

export function parsePlatformsResponse(value: unknown): Platform[] {
  const normalized = typeof value === 'string' ? tryParseJson(value) : value;

  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized.map(parsePlatform).filter((item): item is Platform => item !== null);
}

export function groupPlatformsByCategory(
  platforms: readonly Platform[]
): { category: PlatformCategory; platforms: Platform[] }[] {
  return PLATFORM_CATEGORIES.map((category) => ({
    category,
    platforms: platforms.filter(category.matcher),
  })).filter((group) => group.platforms.length > 0);
}

export function isPlatformConnectable(platform: Platform): boolean {
  return platform.id === LINKEDIN_PLATFORM_ID;
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
