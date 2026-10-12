export type UserUploadedFileItem = {
  id: string;
  fileName: string | null;
  description: string | null;
  createdAt: string;
  previewUrl: string | null;
};

export const USER_UPLOADED_FILE_NAME_MAX_LENGTH = 50;
export const USER_UPLOADED_FILE_DESCRIPTION_MAX_LENGTH = 250;

export type PagedUserUploadedFilesResponse = {
  pageIndex: number;
  totalPages: number;
  totalCount: number;
  items: UserUploadedFileItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type UserUploadedFileUpdateRequest = {
  id: string;
  fileName: string;
  description: string | null;
};

export function normalizeUserUploadedFileDescription(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasUserUploadedFileDescription(value: string | null | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

export function displayUserUploadedFileDescription(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'No description yet.';
}

export function resolveUserUploadedFileName(fileName: string | null | undefined): string {
  const trimmed = (fileName ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Untitled';
}

export function toUserUploadedFileUpdateRequest(
  file: Pick<UserUploadedFileItem, 'id' | 'fileName' | 'description'>,
  updates: Partial<Pick<UserUploadedFileUpdateRequest, 'fileName' | 'description'>> = {},
): UserUploadedFileUpdateRequest {
  const description =
    updates.description !== undefined ? updates.description : (file.description ?? null);

  return {
    id: file.id,
    fileName: resolveUserUploadedFileName(
      updates.fileName !== undefined ? updates.fileName : file.fileName,
    ),
    description,
  };
}

export type UserUploadedFilesFilterParams = {
  createdBefore?: string;
  createdAfter?: string;
  sortBy?: 'Id' | 'CreatedAt';
  isAscending?: boolean;
};

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Parses the media-files API shapes: `FileDto` (list), `FileLongDto` (single, includes a
 * presigned `url`) and `AddFileResult` (`fileId`, `fileName`, `filePath`).
 */
export function parseUserUploadedFileItem(value: unknown): UserUploadedFileItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record['id'] ?? record['Id'] ?? record['fileId'] ?? record['FileId'];

  if (typeof id !== 'string' || !id.trim()) {
    return null;
  }

  return {
    id: id.trim(),
    fileName: readNullableString(record['fileName'] ?? record['FileName']),
    description: readNullableString(record['description'] ?? record['Description']),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
    previewUrl: readNullableString(record['url'] ?? record['Url']),
  };
}

export function parsePagedUserUploadedFilesResponse(
  value: unknown,
): PagedUserUploadedFilesResponse | null {
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
    .map(parseUserUploadedFileItem)
    .filter((item): item is UserUploadedFileItem => item !== null);

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
 * The API lists the current user's files newest-first and supports plain paging only. Any other
 * filter/ordering is applied locally on the fully loaded list.
 */
export function hasLocalUserUploadedFilesQuery(filters: UserUploadedFilesFilterParams): boolean {
  return (
    !!filters.createdBefore ||
    !!filters.createdAfter ||
    filters.isAscending === true ||
    filters.sortBy === 'Id'
  );
}

export function filterAndSortUserUploadedFiles(
  files: readonly UserUploadedFileItem[],
  filters: UserUploadedFilesFilterParams,
): UserUploadedFileItem[] {
  const createdBefore = filters.createdBefore ? Date.parse(filters.createdBefore) : NaN;
  const createdAfter = filters.createdAfter ? Date.parse(filters.createdAfter) : NaN;

  const filtered = files.filter((file) => {
    const created = Date.parse(file.createdAt);
    if (!Number.isNaN(createdBefore) && !(created <= createdBefore)) {
      return false;
    }
    if (!Number.isNaN(createdAfter) && !(created >= createdAfter)) {
      return false;
    }

    return true;
  });

  const direction = filters.isAscending ? 1 : -1;

  return [...filtered].sort((left, right) =>
    filters.sortBy === 'Id'
      ? direction * left.id.localeCompare(right.id)
      : direction * ((Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0)),
  );
}

export const SUPPORTED_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'gif',
  'bmp',
  'webp',
  'tiff',
  'tif',
  'ico',
  'heic',
  'heif',
  'avif',
] as const;

export type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];

const SUPPORTED_IMAGE_EXTENSION_SET = new Set<string>(SUPPORTED_IMAGE_EXTENSIONS);

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/heic',
  'image/heif',
  'image/avif',
]);

export const SUPPORTED_IMAGE_ACCEPT = SUPPORTED_IMAGE_EXTENSIONS.map((extension) => `.${extension}`).join(',');

export function isSupportedImageFile(file: File): boolean {
  if (file.type && SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
    return true;
  }

  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex === -1) {
    return false;
  }

  return SUPPORTED_IMAGE_EXTENSION_SET.has(file.name.slice(dotIndex + 1).toLowerCase());
}
