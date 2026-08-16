import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { parsePlatformsResponse, type Platform } from '../models/platform';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly platformsUrl = new URL('Platform/platforms', environment.backendUrl).toString();

  getPlatforms(): Observable<Platform[]> {
    return this.http
      .get(this.platformsUrl, {
        responseType: 'text',
      })
      .pipe(map((response) => parsePlatformsResponse(response)));
  }
}
