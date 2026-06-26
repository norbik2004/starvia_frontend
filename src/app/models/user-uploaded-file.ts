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
