import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  parseUserPlatform,
  parseUserPlatformsResponse,
  type UpdateUserPlatformRequest,
  type UserPlatform,
} from '../models/user-platform';

@Injectable({ providedIn: 'root' })
export class UserPlatformService {
  private readonly http = inject(HttpClient);
  private readonly userPlatformsUrl = new URL(
    'UserPlatform/user-platforms',
    environment.backendUrl,
  ).toString();

  private userPlatformUrl(id: number): string {
    return new URL(`UserPlatform/${id}`, environment.backendUrl).toString();
  }

  getUserPlatforms(): Observable<UserPlatform[]> {
    return this.http
      .get(this.userPlatformsUrl, {
        responseType: 'text',
      })
      .pipe(map((response) => parseUserPlatformsResponse(response)));
  }

  getUserPlatform(id: number): Observable<UserPlatform> {
    return this.http
      .get(this.userPlatformUrl(id), {
        responseType: 'text',
      })
      .pipe(
        map((response) => this.parseUserPlatformResponse(response)),
        catchError(() =>
          this.getUserPlatforms().pipe(
            map((platforms) => {
              const match = platforms.find((platform) => platform.id === id);
              if (!match) {
                throw new Error('User platform not found.');
              }
              return match;
            }),
          ),
        ),
      );
  }

  updateUserPlatform(id: number, request: UpdateUserPlatformRequest): Observable<string> {
    return this.http.put(this.userPlatformUrl(id), request, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
    });
  }

  deleteUserPlatform(id: number): Observable<void> {
    return this.http.delete<void>(this.userPlatformUrl(id));
  }

  private parseUserPlatformResponse(response: unknown): UserPlatform {
    const normalized =
      typeof response === 'string' && response.trim()
        ? (() => {
            try {
              return JSON.parse(response);
            } catch {
              return response;
            }
          })()
        : response;
    const platform = parseUserPlatform(normalized);

    if (!platform) {
      throw new Error('Invalid user platform response.');
    }

    return platform;
  }
}
