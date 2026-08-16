import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  CreatePostPayload,
  PagedPostsResponse,
  PostItem,
  PostsFilterParams,
  UpdatePostPayload,
} from '../models/post';
import { parsePagedPostsResponse, parsePostItem } from '../models/post';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly postsUrl = new URL('Post', environment.backendUrl).toString();

  getMyPosts(
    pageNumber: number,
    pageSize: number,
    filters: PostsFilterParams = {},
  ): Observable<PagedPostsResponse> {
    let params = new HttpParams()
      .set('PageNumber', String(pageNumber))
      .set('PageSize', String(pageSize));

    if (filters.status) {
      params = params.set('Status', filters.status);
    }
    if (filters.hasPublication !== undefined) {
      params = params.set('HasPublication', String(filters.hasPublication));
    }
    if (filters.titleContains) {
      params = params.set('TitleContains', filters.titleContains);
    }
    if (filters.bodyContains) {
      params = params.set('BodyContains', filters.bodyContains);
    }
    if (filters.publishedOn !== undefined) {
      params = params.set('PublishedOn', String(filters.publishedOn));
    }
    if (filters.createdBefore) {
      params = params.set('CreatedBefore', filters.createdBefore);
    }
    if (filters.createdAfter) {
      params = params.set('CreatedAfter', filters.createdAfter);
    }
    if (filters.sortBy) {
      params = params.set('SortBy', filters.sortBy);
    }
    if (filters.isAscending !== undefined) {
      params = params.set('IsAscending', String(filters.isAscending));
    }

    return this.http
      .get<unknown>(this.postsUrl, {
        params,
      })
      .pipe(
        map((response) => {
          const parsed = parsePagedPostsResponse(response);
          if (!parsed) {
            throw new Error('Invalid posts response.');
          }

          return parsed;
        }),
      );
  }

  getPost(id: number): Observable<PostItem> {
    return this.http.get<unknown>(`${this.postsUrl}/${id}`).pipe(
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
    return this.http.post<unknown>(this.postsUrl, payload).pipe(
      map((response) => {
        const parsed = parsePostItem(response);
        if (!parsed) {
          throw new Error('Invalid post response.');
        }

        return parsed;
      }),
    );
  }

  updatePost(id: number, payload: UpdatePostPayload): Observable<PostItem> {
    return this.http.put<unknown>(`${this.postsUrl}/${id}`, payload).pipe(
      map((response) => {
        const parsed = parsePostItem(response);
        if (!parsed) {
          throw new Error('Invalid post response.');
        }

        return parsed;
      }),
    );
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.postsUrl}/${id}`);
  }
}
