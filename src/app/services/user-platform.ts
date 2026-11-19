import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  USER_PLATFORM_DEFAULT_PAGE_SIZE,
  parseCreatedUserPlatformId,
  parsePagedUserPlatformsResponse,
  parseUserPlatform,
  type AddUserPlatformPayload,
  type BrowseUserPlatformsQuery,
  type PagedUserPlatformsResponse,
  type UserPlatform,
} from '../models/user-platform';

@Injectable({ providedIn: 'root' })
export class UserPlatformService {
  private readonly http = inject(HttpClient);
  private readonly userPlatformsUrl = new URL('user-platforms', environment.backendUrl).toString();

  private userPlatformUrl(userPlatformId: string): string {
    return new URL(`user-platforms/${userPlatformId}`, environment.backendUrl).toString();
  }

  browse(query: BrowseUserPlatformsQuery = {}): Observable<PagedUserPlatformsResponse> {
    let params = new HttpParams();

    if (query.platformType != null) {
      params = params.set('PlatformType', String(query.platformType));
    }
    if (query.ownerId) {
      params = params.set('OwnerId', query.ownerId);
    }
    if (query.sortBy != null) {
      params = params.set('SortBy', String(query.sortBy));
    }
    if (query.descending != null) {
      params = params.set('Descending', String(query.descending));
    }
    if (query.page != null) {
      params = params.set('Page', String(query.page));
    }
    if (query.pageSize != null) {
      params = params.set('PageSize', String(query.pageSize));
    }
    if (query.search) {
      params = params.set('Search', query.search);
    }

    return this.http.get<unknown>(this.userPlatformsUrl, { params }).pipe(
      map((response) => {
        const parsed = parsePagedUserPlatformsResponse(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (połączone konta).');
        }

        return parsed;
      }),
    );
  }

  getById(userPlatformId: string): Observable<UserPlatform> {
    return this.http.get<unknown>(this.userPlatformUrl(userPlatformId)).pipe(
      map((response) => {
        const platform = parseUserPlatform(response);
        if (!platform) {
          throw new Error('Nieprawidłowa odpowiedź serwera (połączone konto).');
        }

        return platform;
      }),
    );
  }

  /** @deprecated Prefer `getById`. */
  getUserPlatform(userPlatformId: string): Observable<UserPlatform> {
    return this.getById(userPlatformId);
  }

  add(payload: AddUserPlatformPayload): Observable<string> {
    const body = new FormData();
    body.append('PlatformId', payload.platformId);
    body.append('AccountUserName', payload.accountUserName);
    if (payload.accountComment != null && payload.accountComment !== '') {
      body.append('AccountComment', payload.accountComment);
    }

    return this.http.post<unknown>(this.userPlatformsUrl, body).pipe(
      map((response) => {
        const id = parseCreatedUserPlatformId(response);
        if (!id) {
          throw new Error('Nieprawidłowa odpowiedź serwera (dodanie konta).');
        }

        return id;
      }),
    );
  }

  /**
   * Convenience list for pickers / legacy callers.
   * Uses browse with a large page size.
   */
  listAll(pageSize = 100): Observable<UserPlatform[]> {
    return this.browse({
      page: 1,
      pageSize: Math.max(pageSize, USER_PLATFORM_DEFAULT_PAGE_SIZE),
    }).pipe(map((result) => result.items));
  }

  /** @deprecated Prefer `listAll` or `browse`. */
  getUserPlatforms(): Observable<UserPlatform[]> {
    return this.listAll();
  }
}
