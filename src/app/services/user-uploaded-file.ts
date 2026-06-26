import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  PagedUserUploadedFilesResponse,
  UserUploadedFileItem,
  UserUploadedFileUpdateRequest,
  UserUploadedFilesFilterParams,
} from '../models/user-uploaded-file';

@Injectable({ providedIn: 'root' })
export class UserUploadedFileService {
  private readonly http = inject(HttpClient);
  private readonly filesUrl = new URL('UserUploadedFile', environment.backendUrl).toString();

  getFiles(
    pageNumber: number,
    pageSize: number,
    filters: UserUploadedFilesFilterParams = {}
  ): Observable<PagedUserUploadedFilesResponse> {
    let params = new HttpParams()
      .set('PageNumber', String(pageNumber))
      .set('PageSize', String(pageSize));

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

    return this.http.get<PagedUserUploadedFilesResponse>(this.filesUrl, {
      params,
      withCredentials: true,
    });
  }

  uploadFiles(files: File[]): Observable<UserUploadedFileItem[]> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('Files', file);
    }

    return this.http.post<UserUploadedFileItem[]>(this.filesUrl, formData, {
      withCredentials: true,
    });
  }

  downloadFile(fileId: string): Observable<Blob> {
    return this.http.get(`${this.filesUrl}/download/${fileId}`, {
      withCredentials: true,
      responseType: 'blob',
    });
  }

  updateFile(payload: UserUploadedFileUpdateRequest): Observable<UserUploadedFileItem> {
    return this.http.put<UserUploadedFileItem>(this.filesUrl, payload, {
      withCredentials: true,
    });
  }

  deleteFile(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.filesUrl}/${fileId}`, {
      withCredentials: true,
    });
  }
}
