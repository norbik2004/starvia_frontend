import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, from, map, mergeMap, of, reduce, switchMap, toArray } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  CreatePostPayload,
  PagedPostsResponse,
  PostItem,
  PostsFilterParams,
  UpdatePostPayload,
} from '../models/post';
import {
  parseCreatedPostId,
  parsePagedPostsResponse,
  parsePostId,
  parsePostItem,
  platformTypesToApiQueryValue,
  postSortByToApiValue,
  postStatusToApiValue,
} from '../models/post';

/** Page size used when the whole list has to be loaded to filter/sort it locally. */
const LOAD_ALL_PAGE_SIZE = 100;
/** Max parallel `GET /posts/{id}` calls when enriching list items with details. */
const DETAILS_CONCURRENCY = 6;

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly postsUrl = new URL('posts', environment.backendUrl).toString();

  /**
   * `GET /v1/posts` filters (`Status`, `Search`), sorts (`SortBy`, `Descending`) and pages on the
   * server. The list DTO has no body or attachments, so the items of the requested page (and only
   * those) are enriched with `GET /v1/posts/{id}`.
   */
  getMyPosts(
    pageNumber: number,
    pageSize: number,
    filters: PostsFilterParams = {},
  ): Observable<PagedPostsResponse> {
    return this.fetchPostsPage(pageNumber, pageSize, filters).pipe(
      switchMap((page) => this.withDetails(page.items).pipe(map((items) => ({ ...page, items })))),
    );
  }

  /**
   * Lightweight list (`id`, `title`, `createdAt`) of every post of the user — one request per 100
   * posts, no per-post enrichment. Used by pickers that only need titles (e.g. the calendar).
   */
  getAllPostSummaries(): Observable<PostItem[]> {
    return this.fetchAllPosts();
  }

  getPost(id: string): Observable<PostItem> {
    return this.http.get<unknown>(this.postUrl(id)).pipe(
      map((response) => {
        const parsed = parsePostItem(response);
        if (!parsed) {
          throw new Error('Invalid post response.');
        }

        return parsed;
      }),
    );
  }

  createPost(payload: CreatePostPayload): Observable<PostItem> {
    return this.http
      .post<unknown>(
        this.postsUrl,
        {
          title: payload.title,
          platforms: payload.platforms,
        },
        { observe: 'response' },
      )
      .pipe(
        map((response: HttpResponse<unknown>) => {
          const id = parseCreatedPostId(response.body) ?? this.idFromLocation(response);
          if (!id) {
            throw new Error('Invalid post response.');
          }

          return id;
        }),
        switchMap((id) => this.getPost(id)),
      );
  }

  updatePost(id: string, payload: UpdatePostPayload): Observable<PostItem> {
    return this.http
      .put<unknown>(this.postsUrl, {
        postId: id,
        title: payload.title,
        body: payload.body ?? '',
        status: postStatusToApiValue(payload.status),
        platforms: payload.platforms,
      })
      .pipe(switchMap(() => this.getPost(id)));
  }

  deletePost(id: string): Observable<void> {
    return this.http.request<void>('DELETE', this.postsUrl, { body: { postId: id } });
  }

  private postUrl(id: string): string {
    return `${this.postsUrl}/${encodeURIComponent(id)}`;
  }

  private idFromLocation(response: HttpResponse<unknown>): string | null {
    const location = response.headers.get('Location');
    if (!location) {
      return null;
    }

    const lastSegment = location.split('?')[0].split('/').filter(Boolean).pop();
    return parsePostId(lastSegment ? decodeURIComponent(lastSegment) : null);
  }

  private fetchPostsPage(
    pageNumber: number,
    pageSize: number,
    filters: PostsFilterParams = {},
  ): Observable<PagedPostsResponse> {
    let params = new HttpParams()
      .set('Page', String(pageNumber))
      .set('PageSize', String(pageSize));

    if (filters.status) {
      params = params.set('Status', String(postStatusToApiValue(filters.status)));
    }
    if (filters.platformTypes && filters.platformTypes.length > 0) {
      params = params.set('platforms', platformTypesToApiQueryValue(filters.platformTypes));
    }
    const search = filters.search?.trim();
    if (search) {
      params = params.set('Search', search);
    }
    if (filters.sortBy) {
      params = params
        .set('SortBy', String(postSortByToApiValue(filters.sortBy)))
        .set('Descending', String(filters.descending ?? true));
    }

    return this.http.get<unknown>(this.postsUrl, { params }).pipe(
      map((response) => {
        const parsed = parsePagedPostsResponse(response);
        if (!parsed) {
          throw new Error('Invalid posts response.');
        }

        return parsed;
      }),
    );
  }

  private fetchAllPosts(): Observable<PostItem[]> {
    return this.fetchPostsPage(1, LOAD_ALL_PAGE_SIZE).pipe(
      expand((page) =>
        page.hasNextPage ? this.fetchPostsPage(page.pageIndex + 1, LOAD_ALL_PAGE_SIZE) : EMPTY,
      ),
      reduce((all, page) => [...all, ...page.items], [] as PostItem[]),
    );
  }

  private withDetails(items: readonly PostItem[]): Observable<PostItem[]> {
    return from(items).pipe(
      mergeMap(
        (item, index) =>
          this.getPost(item.id).pipe(
            map((full) => ({ index, post: { ...full, createdBy: full.createdBy ?? item.createdBy } })),
            // A failed details call must not break the list; fall back to the summary.
            catchError(() => of({ index, post: item })),
          ),
        DETAILS_CONCURRENCY,
      ),
      toArray(),
      map((entries) => entries.sort((left, right) => left.index - right.index).map((entry) => entry.post)),
    );
  }
}
