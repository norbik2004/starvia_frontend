import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  parseBrandProfile,
  parseBrandProfileSummary,
  emptyCreateBrandBrief,
  parseCreatedBrandProfileId,
  parsePagedBrandProfilesResponse,
  type BrandProfile,
  type BrandProfilePlatformOption,
  type BrandProfileSummary,
  type BrandProfileUserPlatformLink,
  type CreateBrandProfilePayload,
  type PagedBrandProfilesResponse,
  type UpdateBrandProfilePayload,
} from '../models/brand-profile';
import { getPlatformTypeLabel } from '../models/platform';
import { UserPlatformService } from './user-platform';

@Injectable({ providedIn: 'root' })
export class BrandProfileService {
  private readonly http = inject(HttpClient);
  private readonly userPlatformService = inject(UserPlatformService);
  private readonly brandProfilesUrl = new URL('brand-profiles', environment.backendUrl).toString();

  private brandProfileUrl(id: string): string {
    return new URL(`brand-profiles/${id}`, environment.backendUrl).toString();
  }

  browse(page: number, pageSize: number, userPlatformId?: string | null): Observable<PagedBrandProfilesResponse> {
    let params = new HttpParams()
      .set('Page', String(page))
      .set('PageSize', String(pageSize));

    if (userPlatformId) {
      params = params.set('UserPlatformId', userPlatformId);
    }

    return this.http.get<unknown>(this.brandProfilesUrl, { params }).pipe(
      map((response) => {
        const parsed = parsePagedBrandProfilesResponse(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (profile marek).');
        }

        return parsed;
      }),
    );
  }

  getById(brandProfileId: string): Observable<BrandProfile> {
    return this.http.get<unknown>(this.brandProfileUrl(brandProfileId)).pipe(
      map((response) => {
        const parsed = parseBrandProfile(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (profil marki).');
        }

        return parsed;
      }),
    );
  }

  listByUserPlatform(userPlatformId: string): Observable<BrandProfileSummary[]> {
    const url = new URL(
      `brand-profiles/by-user-platform/${userPlatformId}`,
      environment.backendUrl,
    ).toString();

    return this.http.get<unknown>(url).pipe(
      map((response) => {
        if (!Array.isArray(response)) {
          throw new Error('Nieprawidłowa odpowiedź serwera (profile marek).');
        }

        return response
          .map(parseBrandProfileSummary)
          .filter((item): item is BrandProfileSummary => item !== null);
      }),
    );
  }

  create(payload: CreateBrandProfilePayload): Observable<string> {
    // Backend validates `Brief` as required; an empty object is enough for name-only create.
    // `Platforms` must be a non-empty unique list of PlatformType ints.
    const body = {
      name: payload.name,
      brief: payload.brief ?? emptyCreateBrandBrief(),
      platforms: [...payload.platforms],
      ...(payload.generationDefaults != null
        ? { generationDefaults: payload.generationDefaults }
        : {}),
    };

    return this.http.post<unknown>(this.brandProfilesUrl, body).pipe(
      map((response) => {
        const id = parseCreatedBrandProfileId(response);
        if (!id) {
          throw new Error('Nieprawidłowa odpowiedź serwera (utworzenie profilu marki).');
        }

        return id;
      }),
    );
  }

  update(brandProfileId: string, payload: UpdateBrandProfilePayload): Observable<void> {
    return this.http
      .put<unknown>(this.brandProfileUrl(brandProfileId), payload)
      .pipe(map(() => undefined));
  }

  delete(brandProfileId: string): Observable<void> {
    return this.http.delete<void>(this.brandProfileUrl(brandProfileId));
  }

  setUserPlatforms(
    brandProfileId: string,
    userPlatforms: readonly BrandProfileUserPlatformLink[],
  ): Observable<void> {
    return this.http
      .put<unknown>(`${this.brandProfileUrl(brandProfileId)}/user-platforms`, {
        userPlatforms,
      })
      .pipe(map(() => undefined));
  }

  /**
   * Connected accounts for the link picker. Delegates to UserPlatforms browse
   * (UUID ids), which matches BrandProfiles link payloads.
   */
  listPlatformOptions(): Observable<BrandProfilePlatformOption[]> {
    return this.userPlatformService.listAll().pipe(
      map((platforms) =>
        platforms.map((platform) => {
          const platformLabel = getPlatformTypeLabel(platform.platformType);
          return {
            id: platform.id,
            accountUsername: platform.accountUsername ?? 'Konto',
            platformLabel,
            platformType: platformLabel.toLowerCase(),
          };
        }),
      ),
    );
  }
}
