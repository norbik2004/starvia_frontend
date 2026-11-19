import type { ParamMap } from '@angular/router';
import {
  POST_SORT_BY_OPTIONS,
  POST_STATUSES,
  normalizePostPlatforms,
  parsePostTag,
  platformTypesToApiQueryValue,
  type PlatformType,
  type PostSortBy,
  type PostStatus,
  type PostsFilterParams,
} from '../../../models/post';

/** `desc` = newest / Z→A first, `asc` = oldest / A→Z first. Maps to the API's `Descending`. */
export type SortDirection = 'desc' | 'asc';
export type StatusFilter = '' | PostStatus;
export type SortByFilter = PostSortBy;

export type PostsListQuery = {
  page: number;
  pageSize: number;
  search: string;
  status: StatusFilter;
  /** Selected platform filters; empty = no platform filter. */
  platformTypes: PlatformType[];
  sortBy: SortByFilter;
  order: SortDirection;
};

export const DEFAULT_POSTS_LIST_QUERY: PostsListQuery = {
  page: 1,
  pageSize: 10,
  search: '',
  status: '',
  platformTypes: [],
  sortBy: 'CreatedAt',
  order: 'desc',
};

export const POSTS_SEARCH_MAX_LENGTH = 100;

const PAGE_SIZE_OPTIONS = new Set([10, 20, 50]);
const SORT_BY_VALUES = new Set<string>(POST_SORT_BY_OPTIONS.map((option) => option.value));

export function postsListQueryToParams(query: PostsListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page,
    pageSize: query.pageSize,
  };

  const search = query.search.trim();
  if (search) {
    params['search'] = search;
  }
  if (query.status) {
    params['status'] = query.status;
  }
  if (query.platformTypes.length > 0) {
    params['platforms'] = platformTypesToApiQueryValue(query.platformTypes);
  }
  if (query.sortBy !== DEFAULT_POSTS_LIST_QUERY.sortBy) {
    params['sortBy'] = query.sortBy;
  }
  if (query.order !== DEFAULT_POSTS_LIST_QUERY.order) {
    params['order'] = query.order;
  }

  return params;
}

export function parsePostsListQuery(params: ParamMap): PostsListQuery {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));

  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : DEFAULT_POSTS_LIST_QUERY.page,
    pageSize: PAGE_SIZE_OPTIONS.has(pageSize) ? pageSize : DEFAULT_POSTS_LIST_QUERY.pageSize,
    // `title` is the legacy name of the text filter.
    search: sanitizeSearch(params.get('search') ?? params.get('title')),
    status: isPostStatus(params.get('status')) ? (params.get('status') as PostStatus) : '',
    platformTypes: parsePlatformTypesFilter(
      params.getAll('platforms').length > 0
        ? params.getAll('platforms')
        : params.get('platforms')
          ? [params.get('platforms')!]
          : params.getAll('platformType').length > 0
            ? params.getAll('platformType')
            : params.get('platformType')
              ? [params.get('platformType')!]
              : [],
    ),
    sortBy: isPostSortBy(params.get('sortBy'))
      ? (params.get('sortBy') as PostSortBy)
      : DEFAULT_POSTS_LIST_QUERY.sortBy,
    order: params.get('order') === 'asc' ? 'asc' : DEFAULT_POSTS_LIST_QUERY.order,
  };
}

export function postsListQueryToFilterParams(query: PostsListQuery): PostsFilterParams {
  const filters: PostsFilterParams = {
    sortBy: query.sortBy,
    descending: query.order === 'desc',
  };

  if (query.status) {
    filters.status = query.status;
  }
  if (query.platformTypes.length > 0) {
    filters.platformTypes = normalizePostPlatforms(query.platformTypes);
  }
  const search = query.search.trim();
  if (search) {
    filters.search = search;
  }

  return filters;
}

export function hasActiveFilters(query: PostsListQuery): boolean {
  return (
    query.status !== '' ||
    query.platformTypes.length > 0 ||
    query.search.trim() !== '' ||
    query.sortBy !== DEFAULT_POSTS_LIST_QUERY.sortBy ||
    query.order !== DEFAULT_POSTS_LIST_QUERY.order
  );
}

export function arePlatformTypeFiltersEqual(
  left: readonly PlatformType[],
  right: readonly PlatformType[],
): boolean {
  const a = normalizePostPlatforms(left);
  const b = normalizePostPlatforms(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function readPostsListQueryFromHistory(): PostsListQuery | null {
  const state = history.state as { postsReturn?: Partial<PostsListQuery> } | null;
  const postsReturn = state?.postsReturn;

  if (!postsReturn) {
    return null;
  }

  return parsePostsListQueryFromObject(postsReturn);
}

function parsePostsListQueryFromObject(value: Partial<PostsListQuery>): PostsListQuery {
  const page = Number(value.page);

  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : DEFAULT_POSTS_LIST_QUERY.page,
    pageSize: PAGE_SIZE_OPTIONS.has(Number(value.pageSize))
      ? Number(value.pageSize)
      : DEFAULT_POSTS_LIST_QUERY.pageSize,
    search: sanitizeSearch(value.search),
    status: isPostStatus(value.status) ? value.status : '',
    platformTypes: parsePlatformTypesFilter(
      Array.isArray(value.platformTypes)
        ? value.platformTypes.map(String)
        : typeof (value as { platformType?: unknown }).platformType === 'number' ||
            typeof (value as { platformType?: unknown }).platformType === 'string'
          ? [String((value as { platformType: string | number }).platformType)]
          : [],
    ),
    sortBy: isPostSortBy(value.sortBy) ? value.sortBy : DEFAULT_POSTS_LIST_QUERY.sortBy,
    order: value.order === 'asc' ? 'asc' : DEFAULT_POSTS_LIST_QUERY.order,
  };
}

function sanitizeSearch(value: string | null | undefined): string {
  return (value ?? '').slice(0, POSTS_SEARCH_MAX_LENGTH);
}

function isPostStatus(value: string | null | undefined): value is PostStatus {
  return POST_STATUSES.includes(value as PostStatus);
}

function isPostSortBy(value: string | null | undefined): value is PostSortBy {
  return SORT_BY_VALUES.has(value as string);
}

function parsePlatformTypesFilter(values: readonly string[]): PlatformType[] {
  const parsed: PlatformType[] = [];

  for (const raw of values) {
    for (const part of raw.split(',')) {
      const platform = parsePostTag(part);
      if (platform !== null) {
        parsed.push(platform);
      }
    }
  }

  return normalizePostPlatforms(parsed);
}
