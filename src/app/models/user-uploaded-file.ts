export type UserUploadedFileItem = {
  id: string;
  fileName: string | null;
  createdAt: string;
  previewUrl: string | null;
};

export const USER_UPLOADED_FILE_NAME_MAX_LENGTH = 50;

export type PagedUserUploadedFilesResponse = {
  pageIndex: number;
  totalPages: number;
  items: UserUploadedFileItem[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type UpdateUserUploadedFilePayload = {
  id: string;
  fileName: string;
};

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
