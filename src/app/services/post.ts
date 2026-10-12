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
  filterAndSortPosts,
  hasLocalPostsQuery,
  parseCreatedPostId,
  parsePagedPostsResponse,
  parsePostId,
  parsePostItem,
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
   * `GET /v1/posts` only returns `{ id, title, createdAt, createdBy }` and supports `Page` and
   * `PageSize` only. Items are enriched with `GET /v1/posts/{id}` (body, status, ...) and, when
   * filters or sorting are requested, the full list is loaded and filtered/sorted/paged locally.
   */
  getMyPosts(
    pageNumber: number,
    pageSize: number,
    filters: PostsFilterParams = {},
  ): Observable<PagedPostsResponse> {
    if (!hasLocalPostsQuery(filters)) {
      return this.fetchPostsPage(pageNumber, pageSize).pipe(
        switchMap((page) =>
          this.withDetails(page.items).pipe(map((items) => ({ ...page, items }))),
        ),
      );
    }

    return this.fetchAllPosts().pipe(
      switchMap((items) => this.withDetails(items)),
      map((items) => this.paginateLocally(filterAndSortPosts(items, filters), pageNumber, pageSize)),
    );
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
      .post<unknown>(this.postsUrl, { title: payload.title }, { observe: 'response' })
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

  private fetchPostsPage(pageNumber: number, pageSize: number): Observable<PagedPostsResponse> {
    const params = new HttpParams()
      .set('Page', String(pageNumber))
      .set('PageSize', String(pageSize));

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

  private paginateLocally(
    items: readonly PostItem[],
    pageNumber: number,
    pageSize: number,
  ): PagedPostsResponse {
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
