export type UpdatePostPayload = {
  title: string;
  body: string | null;
  status: PostStatus;
  /** Required by `PUT /v1/posts` — at least one unique `PlatformType`. */
  platforms: PlatformType[];
};

export type CreatePostPayload = {
  title: string;
  /** Required by `POST /v1/posts` — at least one unique `PlatformType`. */
  platforms: PlatformType[];
};

export type PostAttachmentItem = {
  /** Attachment id (GUID in the v1 API). */
  id: string | null;
  postId: string;
  userUploadedFileId: string;
  order: number;
};

// Title: validator 3-100, column max 75. Body: validator max 2000.
export const POST_TITLE_MIN_LENGTH = 3;
export const POST_TITLE_MAX_LENGTH = 75;
export const POST_BODY_MAX_LENGTH = 2000;

export function normalizePostTitle(title: string | null | undefined): string {
  const unified = (title ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLineBreak = unified.indexOf('\n');

  if (firstLineBreak === -1) {
    return unified;
  }

  return unified.slice(0, firstLineBreak + 1) + unified.slice(firstLineBreak + 1).replace(/\n/g, '');
}

export function normalizePostBody(body: string | null | undefined): string {
  return body ?? '';
}

export function normalizeUpdatePostBody(body: string | null | undefined): string | null {
  const normalized = normalizePostBody(body).slice(0, POST_BODY_MAX_LENGTH).trim();
  return normalized || null;
}

export type HashtagTextSegment = {
  highlighted: boolean;
  text: string;
};

export function parseHashtagSegments(text: string | null | undefined): HashtagTextSegment[] {
  if (!text) {
    return [];
  }

  const segments: HashtagTextSegment[] = [];
  const regex = /#[^\s]*/g;
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ highlighted: false, text: text.slice(lastIndex, index) });
    }

    segments.push({ highlighted: true, text: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ highlighted: false, text: text.slice(lastIndex) });
  }

  return segments;
}

// Mirrors the backend `PostStatus` enum: Generated = 0, Draft = 1, Done = 2.
export const POST_STATUS_OPTIONS = [
  { value: 'Generated', label: 'Wygenerowany', icon: 'auto_awesome' },
  { value: 'Draft', label: 'Szkic', icon: 'edit' },
  { value: 'Done', label: 'Gotowy', icon: 'check' },
] as const;
export const POST_STATUSES = POST_STATUS_OPTIONS.map((option) => option.value);
export type PostStatus = (typeof POST_STATUSES)[number];

/** Mirrors `StarviaBackend.Shared.Abstractions.Platforms.PlatformType` (0/1/2). */
export const PLATFORM_TYPES = [
  { value: 0, label: 'LinkedIn', type: 'linkedin' },
  { value: 1, label: 'Facebook', type: 'facebook' },
  { value: 2, label: 'Instagram', type: 'instagram' },
] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number]['value'];
export const DEFAULT_POST_PLATFORMS: readonly PlatformType[] = [PLATFORM_TYPES[0].value];

const POST_STATUS_BY_VALUE = new Map<string, PostStatus>(
  POST_STATUSES.map((status) => [status.toLowerCase(), status])
);
const POST_STATUS_BY_NUMBER: Record<number, PostStatus> = {
  0: 'Generated',
  1: 'Draft',
  2: 'Done',
};
const POST_STATUS_TO_NUMBER: Record<PostStatus, number> = {
  Generated: 0,
  Draft: 1,
  Done: 2,
};

/** The posts API exchanges `PostStatus` as an integer enum. */
export function postStatusToApiValue(status: PostStatus): number {
  return POST_STATUS_TO_NUMBER[status];
}
const PLATFORM_VALUES = new Set<PlatformType>(PLATFORM_TYPES.map((platform) => platform.value));
const PLATFORM_BY_LABEL = new Map<string, PlatformType>(
  PLATFORM_TYPES.map((platform) => [platform.label.toLowerCase(), platform.value])
);
const PLATFORM_BY_TYPE = new Map<string, PlatformType>(
  PLATFORM_TYPES.map((platform) => [platform.type, platform.value])
);

export function getPostStatusLabel(status: PostStatus | string | null | undefined): string {
  const normalized = parsePostStatus(status);
  return POST_STATUS_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized;
}

export function getPostStatusIcon(status: PostStatus | string | null | undefined): string {
  const normalized = parsePostStatus(status);
  return POST_STATUS_OPTIONS.find((option) => option.value === normalized)?.icon ?? 'edit';
}

export function getPostStatusClass(status: PostStatus | string | null | undefined): string {
  switch (parsePostStatus(status)) {
    case 'Generated':
      return 'post-status--generated';
    case 'Done':
      return 'post-status--done';
    case 'Draft':
    default:
      return 'post-status--draft';
  }
}

export function getPlatformTypeLabel(tag: PlatformType | null | undefined): string {
  if (tag === null || tag === undefined) {
    return '';
  }

  return PLATFORM_TYPES.find((platform) => platform.value === tag)?.label ?? 'Platform';
}

export function getPlatformTypeName(tag: PlatformType | null | undefined): string {
  if (tag === null || tag === undefined) {
    return '';
  }

  return PLATFORM_TYPES.find((platform) => platform.value === tag)?.type ?? '';
}

export function parsePostStatus(value: unknown): PostStatus {
  if (typeof value === 'number' && POST_STATUS_BY_NUMBER[value]) {
    return POST_STATUS_BY_NUMBER[value];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Draft';
    }

    const byName = POST_STATUS_BY_VALUE.get(trimmed.toLowerCase());
    if (byName) {
      return byName;
    }
  }

  return 'Draft';
}

export function parsePostTag(value: unknown): PlatformType | null {
  if (typeof value === 'number' && PLATFORM_VALUES.has(value as PlatformType)) {
    return value as PlatformType;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && PLATFORM_VALUES.has(numeric as PlatformType)) {
      return numeric as PlatformType;
    }

    const byLabel = PLATFORM_BY_LABEL.get(trimmed.toLowerCase());
    if (byLabel !== undefined) {
      return byLabel;
    }

    const byType = PLATFORM_BY_TYPE.get(trimmed.toLowerCase());
    if (byType !== undefined) {
      return byType;
    }
  }

  return null;
}

export function normalizePostPlatforms(platforms: readonly PlatformType[]): PlatformType[] {
  return [...new Set(platforms)].sort((left, right) => left - right);
}

/** Comma-separated enum names for `GET /v1/posts?platforms=Facebook,Instagram,LinkedIn`. */
export function platformTypesToApiQueryValue(platforms: readonly PlatformType[]): string {
  return normalizePostPlatforms(platforms)
    .map((platform) => getPlatformTypeLabel(platform))
    .filter(Boolean)
    .join(',');
}

/** @deprecated Prefer `normalizePostPlatforms`. */
export function normalizePostTags(tags: readonly PlatformType[]): PlatformType[] {
  return normalizePostPlatforms(tags);
}

export function arePostPlatformsEqual(
  left: readonly PlatformType[],
  right: readonly PlatformType[],
): boolean {
  const normalizedLeft = normalizePostPlatforms(left);
  const normalizedRight = normalizePostPlatforms(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((platform, index) => platform === normalizedRight[index])
  );
}

/** @deprecated Prefer `arePostPlatformsEqual`. */
export function arePostTagsEqual(
  left: readonly PlatformType[],
  right: readonly PlatformType[],
): boolean {
  return arePostPlatformsEqual(left, right);
}

export function hasPostPlatform(platforms: readonly PlatformType[], platform: PlatformType): boolean {
  return platforms.includes(platform);
}

/** @deprecated Prefer `hasPostPlatform`. */
export function hasPostTag(tags: readonly PlatformType[], tag: PlatformType): boolean {
  return hasPostPlatform(tags, tag);
}

export function parsePostPlatforms(value: unknown): PlatformType[] {
  if (Array.isArray(value)) {
    return normalizePostPlatforms(
      value.map(parsePostTag).filter((tag): tag is PlatformType => tag !== null),
    );
  }

  const single = parsePostTag(value);
  return single ? [single] : [];
}

/** @deprecated Prefer `parsePostPlatforms`. */
export function parsePostTags(value: unknown): PlatformType[] {
  return parsePostPlatforms(value);
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parsePostAttachment(value: unknown, fallbackPostId?: string): PostAttachmentItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record['id'] ?? record['Id'] ?? record['postAttachmentId'] ?? record['PostAttachmentId'];
  const postId = record['postId'] ?? record['PostId'] ?? fallbackPostId;
  const userUploadedFileId =
    record['fileId'] ?? record['FileId'] ?? record['userUploadedFileId'] ?? record['UserUploadedFileId'];
  const order = record['order'] ?? record['Order'];

  if (typeof postId !== 'string' || !postId.trim()) {
    return null;
  }
  if (typeof userUploadedFileId !== 'string' || !userUploadedFileId.trim()) {
    return null;
  }
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    return null;
  }

  return {
    id: typeof id === 'string' && id.trim() ? id.trim() : typeof id === 'number' ? String(id) : null,
    postId,
    userUploadedFileId: userUploadedFileId.trim(),
    order,
  };
}

export function parsePostAttachments(value: unknown, fallbackPostId?: string): PostAttachmentItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => parsePostAttachment(item, fallbackPostId))
    .filter((item): item is PostAttachmentItem => item !== null)
    .sort((left, right) => left.order - right.order);
}

export function parsePostItem(value: unknown): PostItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = parsePostId(record['id'] ?? record['Id'] ?? record['postId'] ?? record['PostId']);

  if (!id) {
    return null;
  }

  // `createdBy` identifies the author; the v1 API has no separate `userId`.
  const createdBy = readNullableString(record['createdBy'] ?? record['CreatedBy']);

  return {
    id,
    title: readNullableString(record['title'] ?? record['Title']),
    // Prompt text is not on the v1 post DTO. Platforms come as `platforms` (enum ints).
    promptText: readNullableString(record['promptText'] ?? record['PromptText']),
    userId: createdBy ?? '',
    createdBy,
    body: readNullableString(record['body'] ?? record['Body']),
    status: parsePostStatus(record['status'] ?? record['Status']),
    platforms: parsePostPlatforms(
      record['platforms'] ??
        record['Platforms'] ??
        record['tags'] ??
        record['Tags'] ??
        record['tag'] ??
        record['Tag'],
    ),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    lastModifiedAt: readNullableString(record['lastModifiedAt'] ?? record['LastModifiedAt']),
    attachments: parsePostAttachments(
      record['postAttachments'] ?? record['PostAttachments'] ?? record['attachments'] ?? record['Attachments'],
      id,
    ),
  };
}

/** Post ids are GUIDs (strings) in the v1 API. */
export function parsePostId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

/**
 * Reads the id out of an "add post" response. Depending on the endpoint wrapper the id can come
 * back as `{ postId }`, `{ items: [{ postId }] }` or a bare string.
 */
export function parseCreatedPostId(value: unknown): string | null {
  const direct = parsePostId(value);
  if (direct) {
    return direct;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const fromRecord = parsePostId(
    record['postId'] ?? record['PostId'] ?? record['id'] ?? record['Id']
  );
  if (fromRecord) {
    return fromRecord;
  }

  const items = record['items'] ?? record['Items'];
  if (Array.isArray(items) && items.length > 0) {
    return parseCreatedPostId(items[0]);
  }

  return null;
}

export function parsePagedPostsResponse(value: unknown): PagedPostsResponse | null {
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

  const parsedItems = items.map(parsePostItem).filter((item): item is PostItem => item !== null);

  return {
    pageIndex,
    totalPages,
    totalCount: typeof totalCount === 'number' ? totalCount : parsedItems.length,
    items: parsedItems,
    hasPreviousPage: pageIndex > 1,
    hasNextPage: pageIndex < totalPages,
  };
}

/**
 * Sort fields accepted by `GET /v1/posts` (`SortBy`). The API exchanges the enum as an integer:
 * 0 = CreatedAt, 1 = LastModifiedAt, 2 = Title.
 */
export const POST_SORT_BY_OPTIONS = [
  { value: 'CreatedAt', apiValue: 0, label: 'Data utworzenia', icon: 'event' },
  { value: 'LastModifiedAt', apiValue: 1, label: 'Ostatnia zmiana', icon: 'history' },
  { value: 'Title', apiValue: 2, label: 'Tytuł', icon: 'sort_by_alpha' },
] as const;
export type PostSortBy = (typeof POST_SORT_BY_OPTIONS)[number]['value'];

export function postSortByToApiValue(sortBy: PostSortBy): number {
  return POST_SORT_BY_OPTIONS.find((option) => option.value === sortBy)?.apiValue ?? 0;
}

/** Server-side query of `GET /v1/posts` (`Status`, `platforms`, `Search`, `SortBy`, `Descending`). */
export type PostsFilterParams = {
  status?: PostStatus;
  /**
   * Only posts that include any of these platforms
   * (`platforms=Facebook,Instagram,LinkedIn` — OR match).
   */
  platformTypes?: readonly PlatformType[];
  /** Free text matched against the post title. */
  search?: string;
  sortBy?: PostSortBy;
  descending?: boolean;
};

export type PostItem = {
  /** GUID assigned by the API. */
  id: string;
  title: string | null;
  /** Not provided by the v1 API. */
  promptText: string | null;
  /** Mirrors `createdBy`. */
  userId: string;
  createdBy: string | null;
  body: string | null;
  status: PostStatus;
  /** Target channels (`PlatformType` enum ints from the API). */
  platforms: PlatformType[];
  createdAt: string;
  lastModifiedAt: string | null;
  /** Not provided by the v1 API. */
  attachments: PostAttachmentItem[];
};

export type PagedPostsResponse = {
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  items: PostItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
