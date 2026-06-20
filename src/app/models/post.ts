export type UpdatePostPayload = {
  title: string;
  body: string;
};

export type CreatePostPayload = {
  title: string;
};

export const POST_TITLE_MAX_LENGTH = 75;
export const POST_BODY_MAX_LENGTH = 1000;

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

export const POST_STATUSES = ['Generated', 'Draft', 'Done'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const PLATFORM_TYPES = [
  { value: 1, label: 'LinkedIn' },
  { value: 2, label: 'Facebook' },
  { value: 3, label: 'Instagram' },
] as const;
export type PlatformType = (typeof PLATFORM_TYPES)[number]['value'];

export const POST_SORT_BY_OPTIONS = [
  { value: 'Id', label: 'ID' },
  { value: 'CreatedAt', label: 'Created at' },
  { value: 'Status', label: 'Status' },
  { value: 'UpdatedAt', label: 'Updated at' },
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
  status: string;
  createdAt: string;
};

export type PagedPostsResponse = {
  pageIndex: number;
  totalPages: number;
  items: PostItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
