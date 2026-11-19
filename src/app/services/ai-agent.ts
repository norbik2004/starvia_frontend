import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AI_CHAT_TITLE_MAX_LENGTH,
  ASK_AGENT_PROMPT_MAX_LENGTH,
  type AskAgentRequest,
  type AskAgentResult,
  parseAskAgentResult,
} from '../models/ai-chat';

@Injectable({ providedIn: 'root' })
export class AiAgentService {
  private readonly http = inject(HttpClient);
  private readonly askUrl = new URL('ai/agent/ask', environment.backendUrl).toString();

  /**
   * `POST /v1/ai/agent/ask` — prompt the social-media helper.
   * Omit `chatId` to start a new AskAgent chat; reuse the returned id to continue.
   */
  ask(request: AskAgentRequest): Observable<AskAgentResult> {
    const body: Record<string, unknown> = {
      prompt: request.prompt.trim().slice(0, ASK_AGENT_PROMPT_MAX_LENGTH),
    };

    if (request.chatId) {
      body['chatId'] = request.chatId;
    }

    const title = request.title?.trim().slice(0, AI_CHAT_TITLE_MAX_LENGTH);
    if (title) {
      body['title'] = title;
    }

    if (request.brandProfileId) {
      body['brandProfileId'] = request.brandProfileId;
    }

    return this.http
      .post<unknown>(this.askUrl, body)
      .pipe(map((response) => parseAskAgentResult(response)));
  }
}
