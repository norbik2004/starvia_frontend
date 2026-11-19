/**
 * BrandProfiles module of the v1 API (`/v1/brand-profiles`).
 *
 * A profile holds a brand brief + generation defaults, catalogue platform types,
 * and linked connected user platforms (with at most one marked as default).
 */

import { PlatformType } from './platform';

export { PlatformType } from './platform';

export const BRAND_PROFILE_NAME_MAX_LENGTH = 100;
export const BRAND_PROFILE_TEXT_MAX_LENGTH = 1000;
export const BRAND_PROFILE_SHORT_TEXT_MAX_LENGTH = 200;
export const BRAND_PROFILE_DEFAULT_PAGE_SIZE = 12;

export type BrandCompany = {
  name: string | null;
  industry: string | null;
  description: string | null;
};

export type BrandOffering = {
  name: string | null;
  description: string | null;
};

export type BrandTargetAudience = {
  type: string | null;
  painPoints: string[];
};

export type BrandIdentity = {
  toneOfVoice: string | null;
  style: string | null;
  wordsToAvoid: string[];
};

export type BrandBrief = {
  company: BrandCompany | null;
  offerings: BrandOffering[];
  targetAudience: BrandTargetAudience | null;
  brandIdentity: BrandIdentity | null;
  marketingGoals: string[];
};

export type BrandGenerationDefaults = {
  platform: string | null;
  postType: string | null;
  goal: string | null;
  language: string | null;
};

export type BrandProfileUserPlatformLink = {
  userPlatformId: string;
  isDefault: boolean;
};

export type BrandProfileSummary = {
  id: string;
  name: string | null;
  createdAt: string;
  ownerId: string | null;
  linkedUserPlatformCount: number;
};

export type BrandProfile = {
  id: string;
  name: string | null;
  brief: BrandBrief | null;
  generationDefaults: BrandGenerationDefaults | null;
  /** Catalogue platform types this brand targets (required, non-empty on write). */
  platforms: PlatformType[];
  userPlatforms: BrandProfileUserPlatformLink[];
  createdAt: string;
  ownerId: string | null;
};

export type CreateBrandProfilePayload = {
  name: string;
  /** Required by the API even when empty (`The Brief field is required.`). */
  brief?: BrandBrief | Record<string, never> | null;
  /** Required by the API — at least one unique `PlatformType`. */
  platforms: readonly PlatformType[];
  generationDefaults?: BrandGenerationDefaults | null;
};

/** Minimal brief accepted by `POST /v1/brand-profiles` when the user only provides a name. */
export function emptyCreateBrandBrief(): Record<string, never> {
  return {};
}

export const DEFAULT_BRAND_PLATFORMS: readonly PlatformType[] = [PlatformType.LinkedIn];

export type UpdateBrandProfilePayload = {
  name: string | null;
  brief: BrandBrief | null;
  platforms: readonly PlatformType[];
  generationDefaults: BrandGenerationDefaults | null;
};

export type PagedBrandProfilesResponse = {
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  items: BrandProfileSummary[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type BrandProfilePlatformOption = {
  id: string;
  accountUsername: string;
  platformLabel: string;
  platformType: string | null;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

function readUuid(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

function parseCompany(value: unknown): BrandCompany | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    name: readNullableString(record['name'] ?? record['Name']),
    industry: readNullableString(record['industry'] ?? record['Industry']),
    description: readNullableString(record['description'] ?? record['Description']),
  };
}

function parseOffering(value: unknown): BrandOffering | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    name: readNullableString(record['name'] ?? record['Name']),
    description: readNullableString(record['description'] ?? record['Description']),
  };
}

function parseTargetAudience(value: unknown): BrandTargetAudience | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    type: readNullableString(record['type'] ?? record['Type']),
    painPoints: readStringList(record['painPoints'] ?? record['PainPoints']),
  };
}

function parseIdentity(value: unknown): BrandIdentity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    toneOfVoice: readNullableString(record['toneOfVoice'] ?? record['ToneOfVoice']),
    style: readNullableString(record['style'] ?? record['Style']),
    wordsToAvoid: readStringList(record['wordsToAvoid'] ?? record['WordsToAvoid']),
  };
}

export function parseBrandBrief(value: unknown): BrandBrief | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawOfferings = record['offerings'] ?? record['Offerings'];
  const offerings = Array.isArray(rawOfferings)
    ? rawOfferings.map(parseOffering).filter((item): item is BrandOffering => item !== null)
    : [];

  return {
    company: parseCompany(record['company'] ?? record['Company']),
    offerings,
    targetAudience: parseTargetAudience(record['targetAudience'] ?? record['TargetAudience']),
    brandIdentity: parseIdentity(record['brandIdentity'] ?? record['BrandIdentity']),
    marketingGoals: readStringList(record['marketingGoals'] ?? record['MarketingGoals']),
  };
}

export function parseBrandGenerationDefaults(value: unknown): BrandGenerationDefaults | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    platform: readNullableString(record['platform'] ?? record['Platform']),
    postType: readNullableString(record['postType'] ?? record['PostType']),
    goal: readNullableString(record['goal'] ?? record['Goal']),
    language: readNullableString(record['language'] ?? record['Language']),
  };
}

export function parseBrandProfileUserPlatformLink(value: unknown): BrandProfileUserPlatformLink | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const userPlatformId = readUuid(
    record['userPlatformId'] ?? record['UserPlatformId'] ?? record['id'] ?? record['Id'],
  );
  if (!userPlatformId) {
    return null;
  }

  return {
    userPlatformId,
    isDefault: record['isDefault'] === true || record['IsDefault'] === true,
  };
}

export function parseBrandProfileSummary(value: unknown): BrandProfileSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(
    record['id'] ?? record['Id'] ?? record['brandProfileId'] ?? record['BrandProfileId'],
  );
  if (!id) {
    return null;
  }

  const linked =
    record['linkedUserPlatformCount'] ?? record['LinkedUserPlatformCount'] ?? record['linkedCount'];

  return {
    id,
    name: readNullableString(record['name'] ?? record['Name']),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    ownerId: readUuid(record['ownerId'] ?? record['OwnerId']),
    linkedUserPlatformCount: typeof linked === 'number' && Number.isFinite(linked) ? linked : 0,
  };
}

export function parseBrandProfile(value: unknown): BrandProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(
    record['id'] ?? record['Id'] ?? record['brandProfileId'] ?? record['BrandProfileId'],
  );
  if (!id) {
    return null;
  }

  const rawLinks = record['userPlatforms'] ?? record['UserPlatforms'];
  const userPlatforms = Array.isArray(rawLinks)
    ? rawLinks
        .map(parseBrandProfileUserPlatformLink)
        .filter((item): item is BrandProfileUserPlatformLink => item !== null)
    : [];

  return {
    id,
    name: readNullableString(record['name'] ?? record['Name']),
    brief: parseBrandBrief(record['brief'] ?? record['Brief']),
    generationDefaults: parseBrandGenerationDefaults(
      record['generationDefaults'] ?? record['GenerationDefaults'],
    ),
    platforms: parseBrandPlatforms(record['platforms'] ?? record['Platforms']),
    userPlatforms,
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    ownerId: readUuid(record['ownerId'] ?? record['OwnerId']),
  };
}

export function parseBrandPlatforms(value: unknown): PlatformType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed = value
    .map((entry) => {
      if (typeof entry === 'number' && entry >= 0 && entry <= 2) {
        return entry as PlatformType;
      }
      if (typeof entry === 'string' && entry.trim()) {
        const asNumber = Number(entry.trim());
        if (Number.isFinite(asNumber) && asNumber >= 0 && asNumber <= 2) {
          return asNumber as PlatformType;
        }
        switch (entry.trim().toLowerCase()) {
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
    })
    .filter((entry): entry is PlatformType => entry !== null);

  return [...new Set(parsed)].sort((left, right) => left - right);
}

export function parsePagedBrandProfilesResponse(value: unknown): PagedBrandProfilesResponse | null {
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
    .map(parseBrandProfileSummary)
    .filter((item): item is BrandProfileSummary => item !== null);

  return {
    pageIndex,
    totalPages,
    totalCount: typeof totalCount === 'number' ? totalCount : parsedItems.length,
    items: parsedItems,
    hasPreviousPage: pageIndex > 1,
    hasNextPage: pageIndex < totalPages,
  };
}

export function parseCreatedBrandProfileId(value: unknown): string | null {
  const direct = readUuid(value);
  if (direct) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return readUuid(
    record['brandProfileId'] ??
      record['BrandProfileId'] ??
      record['id'] ??
      record['Id'],
  );
}

export function displayBrandProfileName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Bez nazwy';
}

export function emptyBrandBrief(): BrandBrief {
  return {
    company: { name: null, industry: null, description: null },
    offerings: [],
    targetAudience: { type: null, painPoints: [] },
    brandIdentity: { toneOfVoice: null, style: null, wordsToAvoid: [] },
    marketingGoals: [],
  };
}

export function emptyBrandGenerationDefaults(): BrandGenerationDefaults {
  return {
    platform: null,
    postType: null,
    goal: null,
    language: null,
  };
}

/** Strips empty strings so the API receives null / empty arrays instead of blank noise. */
export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStringList(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

export function normalizeBrandBrief(brief: BrandBrief | null | undefined): BrandBrief | null {
  if (!brief) {
    return null;
  }

  const companyName = normalizeOptionalText(brief.company?.name);
  const companyIndustry = normalizeOptionalText(brief.company?.industry);
  const companyDescription = normalizeOptionalText(brief.company?.description);
  const company =
    companyName || companyIndustry || companyDescription
      ? {
          name: companyName,
          industry: companyIndustry,
          description: companyDescription,
        }
      : null;

  const offerings = (brief.offerings ?? [])
    .map((offering) => ({
      name: normalizeOptionalText(offering.name),
      description: normalizeOptionalText(offering.description),
    }))
    .filter((offering) => offering.name || offering.description);

  const audienceType = normalizeOptionalText(brief.targetAudience?.type);
  const painPoints = normalizeStringList(brief.targetAudience?.painPoints ?? []);
  const targetAudience =
    audienceType || painPoints.length > 0
      ? { type: audienceType, painPoints }
      : null;

  const toneOfVoice = normalizeOptionalText(brief.brandIdentity?.toneOfVoice);
  const style = normalizeOptionalText(brief.brandIdentity?.style);
  const wordsToAvoid = normalizeStringList(brief.brandIdentity?.wordsToAvoid ?? []);
  const brandIdentity =
    toneOfVoice || style || wordsToAvoid.length > 0
      ? { toneOfVoice, style, wordsToAvoid }
      : null;

  const marketingGoals = normalizeStringList(brief.marketingGoals ?? []);

  if (
    !company &&
    offerings.length === 0 &&
    !targetAudience &&
    !brandIdentity &&
    marketingGoals.length === 0
  ) {
    return null;
  }

  return {
    company,
    offerings,
    targetAudience,
    brandIdentity,
    marketingGoals,
  };
}

export function normalizeBrandGenerationDefaults(
  defaults: BrandGenerationDefaults | null | undefined,
): BrandGenerationDefaults | null {
  if (!defaults) {
    return null;
  }

  const platform = normalizeOptionalText(defaults.platform);
  const postType = normalizeOptionalText(defaults.postType);
  const goal = normalizeOptionalText(defaults.goal);
  const language = normalizeOptionalText(defaults.language);

  if (!platform && !postType && !goal && !language) {
    return null;
  }

  return { platform, postType, goal, language };
}

export function parseBrandProfilePlatformOption(value: unknown): BrandProfilePlatformOption | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(record['id'] ?? record['Id'] ?? record['userPlatformId'] ?? record['UserPlatformId']);
  if (!id) {
    return null;
  }

  const platformTypeRaw = record['platformType'] ?? record['PlatformType'] ?? record['type'] ?? record['Type'];
  let platformType: string | null = null;
  let platformLabel = 'Platforma';

  if (typeof platformTypeRaw === 'string' && platformTypeRaw.trim()) {
    platformType = platformTypeRaw.trim().toLowerCase();
    platformLabel =
      platformType.charAt(0).toUpperCase() + platformType.slice(1);
  } else if (typeof platformTypeRaw === 'number' && Number.isFinite(platformTypeRaw)) {
    const byIndex = ['LinkedIn', 'Facebook', 'Instagram'][platformTypeRaw];
    const byId = ({ 1: 'LinkedIn', 2: 'Facebook', 3: 'Instagram' } as Record<number, string>)[
      platformTypeRaw
    ];
    platformLabel = byIndex ?? byId ?? `Platforma ${platformTypeRaw}`;
    platformType = platformLabel.toLowerCase();
  }

  return {
    id,
    accountUsername:
      readString(record['accountUsername'] ?? record['AccountUsername']) ?? 'Konto',
    platformLabel,
    platformType,
  };
}
