import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

type LinkedInAuthorizeResponse = {
  url: string;
};

@Injectable({ providedIn: 'root' })
export class LinkedInService {
  private readonly http = inject(HttpClient);
  private readonly authorizeUrl = new URL('LinkedIn/authorize', environment.backendUrl).toString();

  getAuthorizationUrl(): Observable<string> {
    return this.http.get<LinkedInAuthorizeResponse>(this.authorizeUrl).pipe(
      map((response) => {
        const url = typeof response?.url === 'string' ? response.url.trim() : '';
        if (!url) {
          throw new Error('Invalid LinkedIn authorization response.');
        }

        return url;
      }),
    );
  }
}
