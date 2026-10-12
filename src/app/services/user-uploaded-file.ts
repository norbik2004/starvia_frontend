import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  EMPTY,
  Observable,
  concatMap,
  expand,
  from,
  map,
  reduce,
  shareReplay,
  switchMap,
  take,
  tap,
  toArray,
} from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  PagedUserUploadedFilesResponse,
  UserUploadedFileItem,
  UserUploadedFileUpdateRequest,
  UserUploadedFilesFilterParams,
} from '../models/user-uploaded-file';
import {
  filterAndSortUserUploadedFiles,
  hasLocalUserUploadedFilesQuery,
  parsePagedUserUploadedFilesResponse,
  parseUserUploadedFileItem,
} from '../models/user-uploaded-file';

/** Page size used when the whole list has to be loaded to filter/sort it locally. */
const LOAD_ALL_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class UserUploadedFileService {
  private readonly http = inject(HttpClient);
  private readonly filesUrl = new URL('media-files', environment.backendUrl).toString();
  private readonly previewCache = new Map<string, Observable<string>>();

  /**
   * `GET /v1/media-files?Page&PageSize` returns the current user's files, newest first. Other
   * filters/ordering are applied locally on the full list.
   */
  getFiles(
    pageNumber: number,
    pageSize: number,
    filters: UserUploadedFilesFilterParams = {},
  ): Observable<PagedUserUploadedFilesResponse> {
    if (!hasLocalUserUploadedFilesQuery(filters)) {
      return this.fetchFilesPage(pageNumber, pageSize);
    }

    return this.fetchAllFiles().pipe(
      map((items) =>
        this.paginateLocally(filterAndSortUserUploadedFiles(items, filters), pageNumber, pageSize),
      ),
    );
  }

  /** `GET /v1/media-files/{id}`; `previewUrl` is the (authorized) content route of the file. */
  getFile(fileId: string): Observable<UserUploadedFileItem> {
    return this.http.get<unknown>(this.fileUrl(fileId)).pipe(
      map((response) => {
        const parsed = parseUserUploadedFileItem(response);
        if (!parsed) {
          throw new Error('Invalid file response.');
        }

        return parsed;
      }),
    );
  }

  /** The API accepts one file per request, so files are uploaded one after another. */
  uploadFiles(files: File[]): Observable<UserUploadedFileItem[]> {
    return from(files).pipe(
      concatMap((file) => this.uploadFile(file)),
      toArray(),
    );
  }

  uploadFile(file: File, description?: string | null): Observable<UserUploadedFileItem> {
    const formData = new FormData();
    formData.append('File', file);
    if (description) {
      formData.append('Description', description);
    }

    return this.http.post<unknown>(this.filesUrl, formData).pipe(
      map((response) => {
        const parsed = parseUserUploadedFileItem(response);
        if (!parsed) {
          throw new Error('Invalid file response.');
        }

        return {
          ...parsed,
          description: parsed.description ?? description ?? null,
          createdAt: parsed.createdAt || new Date().toISOString(),
        };
      }),
    );
  }

  /**
   * The `url` returned by the API (`/v1/media-files/{id}/content`) is an authorized endpoint, so it
   * cannot be used as `<img src>` directly. The content is downloaded with the bearer token and
   * exposed as an object URL. Results (and in-flight requests) are cached per file.
   */
  getPreviewUrl(fileId: string): Observable<string> {
    const cached = this.previewCache.get(fileId);
    if (cached) {
      return cached;
    }

    const request$ = this.downloadFile(fileId).pipe(
      map((blob) => URL.createObjectURL(blob)),
      tap({ error: () => this.previewCache.delete(fileId) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.previewCache.set(fileId, request$);

    return request$;
  }

  /** `GET /v1/media-files/{id}/content` returns the raw file. */
  downloadFile(fileId: string): Observable<Blob> {
    return this.http.get(`${this.fileUrl(fileId)}/content`, { responseType: 'blob' });
  }

  /** Frees the cached object URL of a file (e.g. after it was deleted). */
  releasePreview(fileId: string): void {
    const cached = this.previewCache.get(fileId);
    this.previewCache.delete(fileId);

    cached?.pipe(take(1)).subscribe({
      next: (url) => URL.revokeObjectURL(url),
      error: () => {},
    });
  }

  /** `PUT /v1/media-files` only updates the description; the file name cannot be changed. */
  updateFile(payload: UserUploadedFileUpdateRequest): Observable<UserUploadedFileItem> {
    return this.http
      .put<unknown>(this.filesUrl, { fileId: payload.id, description: payload.description })
      .pipe(switchMap(() => this.getFile(payload.id)));
  }

  deleteFile(fileId: string): Observable<void> {
    return this.http
      .request<void>('DELETE', this.filesUrl, { body: { fileId } })
      .pipe(tap(() => this.releasePreview(fileId)));
  }

  private fileUrl(fileId: string): string {
    return `${this.filesUrl}/${encodeURIComponent(fileId)}`;
  }

  private fetchFilesPage(
    pageNumber: number,
    pageSize: number,
  ): Observable<PagedUserUploadedFilesResponse> {
    const params = new HttpParams()
      .set('Page', String(pageNumber))
      .set('PageSize', String(pageSize));

    return this.http.get<unknown>(this.filesUrl, { params }).pipe(
      map((response) => {
        const parsed = parsePagedUserUploadedFilesResponse(response);
        if (!parsed) {
          throw new Error('Invalid files response.');
        }

        return parsed;
      }),
    );
  }

  private fetchAllFiles(): Observable<UserUploadedFileItem[]> {
    return this.fetchFilesPage(1, LOAD_ALL_PAGE_SIZE).pipe(
      expand((page) =>
        page.hasNextPage ? this.fetchFilesPage(page.pageIndex + 1, LOAD_ALL_PAGE_SIZE) : EMPTY,
      ),
      reduce((all, page) => [...all, ...page.items], [] as UserUploadedFileItem[]),
    );
  }

  private paginateLocally(
    items: readonly UserUploadedFileItem[],
    pageNumber: number,
    pageSize: number,
  ): PagedUserUploadedFilesResponse {
    const totalPages = Math.ceil(items.length / pageSize);
    const pageIndex = Math.min(Math.max(1, pageNumber), Math.max(1, totalPages));
    const start = (pageIndex - 1) * pageSize;

    return {
      pageIndex,
      totalPages,
      totalCount: items.length,
      items: items.slice(start, start + pageSize),
      hasPreviousPage: pageIndex > 1,
      hasNextPage: pageIndex < totalPages,
    };
  }
}
