import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { parsePlatformsResponse, type Platform, type PlatformType } from '../models/platform';

export type BrowsePlatformsQuery = {
  platformType?: PlatformType | null;
  isOnline?: boolean | null;
  page?: number;
  pageSize?: number;
};

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly platformsUrl = new URL('platforms', environment.backendUrl).toString();

  browse(query: BrowsePlatformsQuery = {}): Observable<Platform[]> {
    let params = new HttpParams();

    if (query.platformType != null) {
      params = params.set('PlatformType', String(query.platformType));
    }
    if (query.isOnline != null) {
      params = params.set('IsOnline', String(query.isOnline));
    }
    if (query.page != null) {
      params = params.set('Page', String(query.page));
    }
    if (query.pageSize != null) {
      params = params.set('PageSize', String(query.pageSize));
    }

    return this.http.get<unknown>(this.platformsUrl, { params }).pipe(
      map((response) => parsePlatformsResponse(response)),
    );
  }

  /** Catalogue list for the social-accounts connect UI. */
  getPlatforms(): Observable<Platform[]> {
    return this.browse({ page: 1, pageSize: 100 });
  }
}
