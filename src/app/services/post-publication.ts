import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  parsePostPublication,
  parsePostPublicationsResponse,
  type BrowsePostPublicationsQuery,
  type PostPublication,
} from '../models/post-publication';

@Injectable({ providedIn: 'root' })
export class PostPublicationService {
  private readonly http = inject(HttpClient);
  private readonly publicationsUrl = new URL('post-publications', environment.backendUrl).toString();

  private publicationUrl(postPublicationId: string): string {
    return new URL(`post-publications/${postPublicationId}`, environment.backendUrl).toString();
  }

  /** `GET /v1/post-publications` */
  browse(query: BrowsePostPublicationsQuery = {}): Observable<PostPublication[]> {
    let params = new HttpParams();

    if (query.postId) {
      params = params.set('PostId', query.postId);
    }
    if (query.status != null) {
      params = params.set('Status', String(query.status));
    }
    if (query.userPlatformId) {
      params = params.set('UserPlatformId', query.userPlatformId);
    }

    return this.http.get<unknown>(this.publicationsUrl, { params }).pipe(
      map((response) => parsePostPublicationsResponse(response)),
    );
  }

  /** `GET /v1/post-publications/{postPublicationId}` */
  getById(postPublicationId: string): Observable<PostPublication> {
    return this.http.get<unknown>(this.publicationUrl(postPublicationId)).pipe(
      map((response) => {
        const parsed = parsePostPublication(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (publikacja).');
        }

        return parsed;
      }),
    );
  }
}
