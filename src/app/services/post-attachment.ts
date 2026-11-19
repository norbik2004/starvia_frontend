import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AddPostAttachmentsRequest = {
  postId: string;
  fileIds: string[];
};

export type UpdatePostAttachmentOrderRequest = {
  postId: string;
  postAttachmentId: string;
  order: number;
};

export type RemovePostAttachmentRequest = {
  postId: string;
  postAttachmentId: string;
};

@Injectable({ providedIn: 'root' })
export class PostAttachmentService {
  private readonly http = inject(HttpClient);
  private readonly attachmentsUrl = new URL('post-attachments/attachments', environment.backendUrl).toString();
  private readonly orderUrl = new URL('post-attachments/attachments/order', environment.backendUrl).toString();

  /** `POST /v1/post-attachments/attachments` — attaches uploaded files to a post. */
  create(payload: AddPostAttachmentsRequest): Observable<string> {
    return this.http.post(this.attachmentsUrl, payload, {
      responseType: 'text',
    });
  }

  /** `PUT /v1/post-attachments/attachments/order` — moves a single attachment to a new position. */
  updateOrder(payload: UpdatePostAttachmentOrderRequest): Observable<void> {
    return this.http.put<void>(this.orderUrl, payload);
  }

  /** `DELETE /v1/post-attachments/attachments` — removes an attachment from a post. */
  delete(payload: RemovePostAttachmentRequest): Observable<void> {
    return this.http.request<void>('DELETE', this.attachmentsUrl, { body: payload });
  }
}
