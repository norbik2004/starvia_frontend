import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type CreatePostAttachmentsRequest = {
  postId: number;
  /**
   * NOTE: backend payload uses the misspelled key `attachemnts` (per API example).
   */
  attachemnts: Array<{
    uploadedFileId: string;
    order: number;
  }>;
};

@Injectable({ providedIn: 'root' })
export class PostAttachmentService {
  private readonly http = inject(HttpClient);
  private readonly url = new URL('PostAttachment', environment.backendUrl).toString();

  create(payload: CreatePostAttachmentsRequest): Observable<string> {
    return this.http.post(this.url, payload, {
      withCredentials: true,
      responseType: 'text',
    });
  }
}

