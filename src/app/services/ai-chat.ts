import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AI_CHAT_DEFAULT_PAGE_SIZE,
  AI_CHAT_SEARCH_MAX_LENGTH,
  AI_CHAT_TITLE_MAX_LENGTH,
  ChatSortBy,
  type AddAiChatRequest,
  type AiChatDetail,
  type BrowseAiChatsQuery,
  type PagedAiChatsResponse,
  type UpdateAiChatRequest,
  parseAddAiChatResult,
  parseAiChatDetail,
  parsePagedAiChatsResponse,
} from '../models/ai-chat';

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly http = inject(HttpClient);
  private readonly chatsUrl = new URL('ai/chats', environment.backendUrl).toString();

  private chatUrl(chatId: string): string {
    return new URL(`ai/chats/${encodeURIComponent(chatId)}`, environment.backendUrl).toString();
  }

  /** `GET /v1/ai/chats` — browse the caller's chat history. */
  browse(query: BrowseAiChatsQuery = {}): Observable<PagedAiChatsResponse> {
    let params = new HttpParams()
      .set('Page', String(query.page && query.page > 0 ? query.page : 1))
      .set(
        'PageSize',
        String(
          query.pageSize && query.pageSize > 0 ? query.pageSize : AI_CHAT_DEFAULT_PAGE_SIZE,
        ),
      )
      .set('SortBy', String(query.sortBy ?? ChatSortBy.LastActivity))
      .set('Descending', String(query.descending ?? true));

    if (query.type != null) {
      params = params.set('Type', String(query.type));
    }

    if (query.status != null) {
      params = params.set('Status', String(query.status));
    }

    if (query.postId) {
      params = params.set('PostId', query.postId);
    }

    if (query.ownerId) {
      params = params.set('OwnerId', query.ownerId);
    }

    const search = query.search?.trim().slice(0, AI_CHAT_SEARCH_MAX_LENGTH);
    if (search) {
      params = params.set('Search', search);
    }

    return this.http.get<unknown>(this.chatsUrl, { params }).pipe(
      map((response) => {
        const parsed = parsePagedAiChatsResponse(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (lista czatów AI).');
        }

        return parsed;
      }),
    );
  }

  /** `GET /v1/ai/chats/{chatId}` — chat with message history. */
  getById(chatId: string): Observable<AiChatDetail> {
    return this.http.get<unknown>(this.chatUrl(chatId)).pipe(
      map((response) => {
        const parsed = parseAiChatDetail(response);
        if (!parsed) {
          throw new Error('Nieprawidłowa odpowiedź serwera (szczegóły czatu AI).');
        }

        return parsed;
      }),
    );
  }

  /** `POST /v1/ai/chats` — create an empty chat shell. */
  add(request: AddAiChatRequest): Observable<string> {
    const body = {
      type: request.type,
      title: request.title.trim().slice(0, AI_CHAT_TITLE_MAX_LENGTH),
    };

    return this.http.post<unknown>(this.chatsUrl, body).pipe(
      map((response) => {
        const chatId = parseAddAiChatResult(response);
        if (!chatId) {
          throw new Error('Nieprawidłowa odpowiedź serwera (utworzenie czatu AI).');
        }

        return chatId;
      }),
    );
  }

  /** `PUT /v1/ai/chats/{chatId}` — rename / archive / restore. */
  update(chatId: string, request: UpdateAiChatRequest): Observable<void> {
    const body = {
      title: request.title.trim().slice(0, AI_CHAT_TITLE_MAX_LENGTH),
      status: request.status,
    };

    return this.http.put<unknown>(this.chatUrl(chatId), body).pipe(map(() => undefined));
  }

  /** `DELETE /v1/ai/chats/{chatId}` — remove chat and its history. */
  remove(chatId: string): Observable<void> {
    return this.http.delete<void>(this.chatUrl(chatId));
  }
}
