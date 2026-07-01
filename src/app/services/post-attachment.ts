import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type PostAttachmentsRequest = {
  postId: number;
  attachments: Array<{
    userUploadedFileId: string;
    order: number;
  }>;
};

@Injectable({ providedIn: 'root' })
export class PostAttachmentService {
  private readonly http = inject(HttpClient);
  private readonly url = new URL('PostAttachment', environment.backendUrl).toString();

  create(payload: PostAttachmentsRequest): Observable<string> {
    return this.http.post(this.url, payload, {
      withCredentials: true,
      responseType: 'text',
    });
  }

  update(payload: PostAttachmentsRequest): Observable<string> {
    return this.http.put(this.url, payload, {
      withCredentials: true,
      responseType: 'text',
    });
  }

  delete(postAttachmentId: number): Observable<void> {
    return this.http.delete<void>(this.url, {
      params: { postAttachmentId },
      withCredentials: true,
    });
  }
}

