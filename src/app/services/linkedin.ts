import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  parsePublishPostToLinkedInResult,
  type PublishPostToLinkedInPayload,
  type PublishPostToLinkedInResult,
} from '../models/post-publication';

/** Session flag set before redirecting to LinkedIn OAuth; cleared on return. */
export const LINKEDIN_CONNECT_PENDING_KEY = 'starvia.linkedin.connectPending';

type LinkedInAuthorizeResponse = {
  url?: string | null;
  Url?: string | null;
};

@Injectable({ providedIn: 'root' })
export class LinkedInService {
  private readonly http = inject(HttpClient);
  /** `GET /v1/linkedin/authorize` — returns the LinkedIn OAuth URL. */
  private readonly authorizeUrl = new URL('linkedin/authorize', environment.backendUrl).toString();
  /** `POST /v1/linkedin/publish` */
  private readonly publishUrl = new URL('linkedin/publish', environment.backendUrl).toString();

  getAuthorizationUrl(): Observable<string> {
    return this.http.get<LinkedInAuthorizeResponse>(this.authorizeUrl).pipe(
      map((response) => {
        const url =
          typeof response?.url === 'string'
            ? response.url.trim()
            : typeof response?.Url === 'string'
              ? response.Url.trim()
              : '';

        if (!url) {
          throw new Error('Invalid LinkedIn authorization response.');
        }

        return url;
      }),
    );
  }

  /** Publishes a post to the connected LinkedIn account. */
  publishPost(payload: PublishPostToLinkedInPayload): Observable<PublishPostToLinkedInResult> {
    const body: Record<string, string> = {
      postId: payload.postId,
      userPlatformId: payload.userPlatformId,
    };

    const articleUrl = payload.articleUrl?.trim();
    if (articleUrl) {
      body['articleUrl'] = articleUrl;
    }

    const articleDescription = payload.articleDescription?.trim();
    if (articleDescription) {
      body['articleDescription'] = articleDescription;
    }

    return this.http.post<unknown>(this.publishUrl, body).pipe(
      map((response) => {
        const parsed = parsePublishPostToLinkedInResult(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (publikacja LinkedIn).');
        }

        return parsed;
      }),
    );
  }

  markConnectPending(): void {
    try {
      sessionStorage.setItem(LINKEDIN_CONNECT_PENDING_KEY, '1');
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  consumeConnectPending(): boolean {
    try {
      const pending = sessionStorage.getItem(LINKEDIN_CONNECT_PENDING_KEY) === '1';
      if (pending) {
        sessionStorage.removeItem(LINKEDIN_CONNECT_PENDING_KEY);
      }
      return pending;
    } catch {
      return false;
    }
  }
}
