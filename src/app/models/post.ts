export type UpdatePostPayload = {
  title: string;
  body: string | null;
  tags: PlatformType[] | null;
  status: PostStatus;
};

export type CreatePostPayload = {
  title: string;
};

export type PostAttachmentItem = {
  id: number | null;
  postId: number;
  userUploadedFileId: string;
  order: number;
};

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

export const POST_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft', icon: 'edit' },
  { value: 'InProgress', label: 'In progress', icon: 'hourglass_empty' },
  { value: 'Done', label: 'Done', icon: 'check' },
  { value: 'Archived', label: 'Archived', icon: 'archive' },
] as const;
export const POST_STATUSES = POST_STATUS_OPTIONS.map((option) => option.value);
export type PostStatus = (typeof POST_STATUSES)[number];

export const PLATFORM_TYPES = [
  { value: 1, label: 'LinkedIn', type: 'linkedin' },
  { value: 2, label: 'Facebook', type: 'facebook' },
  { value: 3, label: 'Instagram', type: 'instagram' },
] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number]['value'];

const POST_STATUS_BY_VALUE = new Map<string, PostStatus>(
  POST_STATUSES.map((status) => [status.toLowerCase(), status])
);
const POST_STATUS_BY_NUMBER: Record<number, PostStatus> = {
  0: 'Draft',
  1: 'InProgress',
  2: 'Done',
  3: 'Archived',
};
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
    case 'InProgress':
      return 'post-status--in-progress';
    case 'Done':
      return 'post-status--done';
    case 'Archived':
      return 'post-status--archived';
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
    if (byLabel) {
      return byLabel;
    }

    const byType = PLATFORM_BY_TYPE.get(trimmed.toLowerCase());
    if (byType) {
      return byType;
    }
  }

  return null;
}

export function normalizePostTags(tags: readonly PlatformType[]): PlatformType[] {
  return [...new Set(tags)].sort((left, right) => left - right);
}

export function arePostTagsEqual(
  left: readonly PlatformType[],
  right: readonly PlatformType[]
): boolean {
  const normalizedLeft = normalizePostTags(left);
  const normalizedRight = normalizePostTags(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((tag, index) => tag === normalizedRight[index])
  );
}

export function hasPostTag(tags: readonly PlatformType[], tag: PlatformType): boolean {
  return tags.includes(tag);
}

export function parsePostTags(value: unknown): PlatformType[] {
  if (Array.isArray(value)) {
    return normalizePostTags(
      value.map(parsePostTag).filter((tag): tag is PlatformType => tag !== null)
    );
  }

  const single = parsePostTag(value);
  return single ? [single] : [];
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parsePostAttachment(value: unknown, fallbackPostId?: number): PostAttachmentItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record['id'] ?? record['Id'] ?? record['postAttachmentId'] ?? record['PostAttachmentId'];
  const postId = record['postId'] ?? record['PostId'] ?? fallbackPostId;
  const userUploadedFileId = record['userUploadedFileId'] ?? record['UserUploadedFileId'];
  const order = record['order'] ?? record['Order'];

  if (typeof postId !== 'number' || !Number.isFinite(postId)) {
    return null;
  }
  if (typeof userUploadedFileId !== 'string' || !userUploadedFileId.trim()) {
    return null;
  }
  if (typeof order !== 'number' || !Number.isFinite(order)) {
    return null;
  }

  return {
    id: typeof id === 'number' && Number.isFinite(id) ? id : null,
    postId,
    userUploadedFileId: userUploadedFileId.trim(),
    order,
  };
}

export function parsePostAttachments(value: unknown, fallbackPostId?: number): PostAttachmentItem[] {
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
  const id = record['id'] ?? record['Id'];

  if (typeof id !== 'number' || !Number.isFinite(id)) {
    return null;
  }

  const userId = record['userId'] ?? record['UserId'];

  return {
    id,
    title: readNullableString(record['title'] ?? record['Title']),
    promptText: readNullableString(record['promptText'] ?? record['PromptText']),
    userId: typeof userId === 'string' ? userId : String(userId ?? ''),
    body: readNullableString(record['body'] ?? record['Body']),
    status: parsePostStatus(record['status'] ?? record['Status']),
    tags: parsePostTags(record['tags'] ?? record['Tags'] ?? record['tag'] ?? record['Tag']),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    attachments: parsePostAttachments(record['attachments'] ?? record['Attachments'], id),
  };
}

export function parsePagedPostsResponse(value: unknown): PagedPostsResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const pageIndex = record['pageIndex'] ?? record['PageIndex'];
  const totalPages = record['totalPages'] ?? record['TotalPages'];
  const items = record['items'] ?? record['Items'];

  if (typeof pageIndex !== 'number' || typeof totalPages !== 'number' || !Array.isArray(items)) {
    return null;
  }

  return {
    pageIndex,
    totalPages,
    items: items.map(parsePostItem).filter((item): item is PostItem => item !== null),
    hasPreviousPage: Boolean(record['hasPreviousPage'] ?? record['HasPreviousPage']),
    hasNextPage: Boolean(record['hasNextPage'] ?? record['HasNextPage']),
  };
}

export const POST_SORT_BY_OPTIONS = [
  { value: 'Id', label: 'ID', icon: 'tag' },
  { value: 'CreatedAt', label: 'Created at', icon: 'event' },
  { value: 'Status', label: 'Status', icon: 'label' },
  { value: 'UpdatedAt', label: 'Updated at', icon: 'history' },
] as const;
export type PostSortBy = (typeof POST_SORT_BY_OPTIONS)[number]['value'];

export type PostsFilterParams = {
  status?: PostStatus;
  hasPublication?: boolean;
  titleContains?: string;
  bodyContains?: string;
  publishedOn?: PlatformType;
  createdBefore?: string;
  createdAfter?: string;
  sortBy?: PostSortBy;
  isAscending?: boolean;
};

export type PostItem = {
  id: number;
  title: string | null;
  promptText: string | null;
  userId: string;
  body: string | null;
  status: PostStatus;
  tags: PlatformType[];
  createdAt: string;
  attachments: PostAttachmentItem[];
};

export type PagedPostsResponse = {
  pageIndex: number;
  totalPages: number;
  items: PostItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
