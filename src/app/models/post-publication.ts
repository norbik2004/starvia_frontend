/**
 * PostPublications module of the v1 API (`/v1/post-publications`).
 */

/** Mirrors `StarviaBackend.Modules.Posts.Core.Posts.Enums.PostPublicationStatus`. */
export enum PostPublicationStatus {
  Created = 0,
  Draft = 1,
  Published = 2,
  Deleted = 3,
  NeedsChange = 4,
}

export type PostPublication = {
  id: string;
  postId: string;
  status: PostPublicationStatus;
  userPlatformId: string;
  publishedAt: string | null;
  externalPostId: string | null;
  createdAt: string;
};

export type BrowsePostPublicationsQuery = {
  postId?: string | null;
  status?: PostPublicationStatus | null;
  userPlatformId?: string | null;
};

export type PublishPostToLinkedInPayload = {
  postId: string;
  userPlatformId: string;
  /** Optional LinkedIn article/URL share (backend: `articleUrl`). */
  articleUrl?: string | null;
  articleDescription?: string | null;
};

export type PublishPostToLinkedInResult = {
  postPublicationId: string;
  externalPostId: string | null;
  publishedAt: string;
};

export function postPublicationStatusLabel(status: PostPublicationStatus | number): string {
  switch (status) {
    case PostPublicationStatus.Created:
      return 'Utworzona';
    case PostPublicationStatus.Draft:
      return 'Szkic';
    case PostPublicationStatus.Published:
      return 'Opublikowana';
    case PostPublicationStatus.Deleted:
      return 'Usunięta';
    case PostPublicationStatus.NeedsChange:
      return 'Wymaga zmian';
    default:
      return `Status ${status}`;
  }
}

function readUuid(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseStatus(value: unknown): PostPublicationStatus | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 4) {
    return value as PostPublicationStatus;
  }

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber >= 0 && asNumber <= 4) {
      return asNumber as PostPublicationStatus;
    }

    switch (trimmed.toLowerCase()) {
      case 'created':
        return PostPublicationStatus.Created;
      case 'draft':
        return PostPublicationStatus.Draft;
      case 'published':
        return PostPublicationStatus.Published;
      case 'deleted':
        return PostPublicationStatus.Deleted;
      case 'needschange':
      case 'needs_change':
      case 'needs-change':
        return PostPublicationStatus.NeedsChange;
      default:
        return null;
    }
  }

  return null;
}

export function parsePostPublication(value: unknown): PostPublication | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readUuid(record['id'] ?? record['Id']);
  const postId = readUuid(record['postId'] ?? record['PostId']);
  const userPlatformId = readUuid(record['userPlatformId'] ?? record['UserPlatformId']);
  const status = parseStatus(record['status'] ?? record['Status']);

  if (!id || !postId || !userPlatformId || status === null) {
    return null;
  }

  return {
    id,
    postId,
    status,
    userPlatformId,
    publishedAt: readNullableString(record['publishedAt'] ?? record['PublishedAt']),
    externalPostId: readNullableString(record['externalPostId'] ?? record['ExternalPostId']),
    createdAt: String(record['createdAt'] ?? record['CreatedAt'] ?? ''),
  };
}

export function parsePostPublicationsResponse(value: unknown): PostPublication[] {
  if (Array.isArray(value)) {
    return value.map(parsePostPublication).filter((item): item is PostPublication => item !== null);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const items = record['items'] ?? record['Items'];
  if (!Array.isArray(items)) {
    const single = parsePostPublication(value);
    return single ? [single] : [];
  }

  return items.map(parsePostPublication).filter((item): item is PostPublication => item !== null);
}

export function parsePublishPostToLinkedInResult(value: unknown): PublishPostToLinkedInResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const postPublicationId = readUuid(
    record['postPublicationId'] ?? record['PostPublicationId'] ?? record['id'] ?? record['Id'],
  );
  const publishedAt = readNullableString(record['publishedAt'] ?? record['PublishedAt']);

  if (!postPublicationId || !publishedAt) {
    return null;
  }

  return {
    postPublicationId,
    externalPostId: readNullableString(record['externalPostId'] ?? record['ExternalPostId']),
    publishedAt,
  };
}
