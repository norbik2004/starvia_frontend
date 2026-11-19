import { HttpClient } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

import {
  ConversationType,
  type AskGeminiRequest,
  type GeneratePostRequest,
  type GeneratedPost,
  type UserPromptConversationItem,
  type UserPromptRequest,
  parseGeneratedPost,
  parseGeneratedPostText,
} from '../models/gemini';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly http = inject(HttpClient);
  private readonly geminiUrl = new URL('Gemini', environment.backendUrl).toString();
  private readonly userPromptUrl = new URL('UserPrompt', environment.backendUrl).toString();
  private readonly generatePostUrl = new URL('ai/posts/generate', environment.backendUrl).toString();

  getConversation(postId: string): Observable<UserPromptConversationItem[]> {
    return this.http.get<UserPromptConversationItem[]>(
      `${this.userPromptUrl}/conversation/${encodeURIComponent(postId)}`,
    );
  }

  /** `POST /v1/ai/posts/generate`: every call starts a new generation chat and returns the written post. */
  generatePost(request: GeneratePostRequest): Observable<GeneratedPost> {
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      postId: request.postId,
    };

    if (request.brandProfileId) {
      body['brandProfileId'] = request.brandProfileId;
    }

    return this.http
      .post<unknown>(this.generatePostUrl, body)
      .pipe(map((response) => parseGeneratedPost(response)));
  }

  askGemini(request: AskGeminiRequest): Observable<string> {
    return this.send({
      prompt: request.prompt,
      postId: request.postId,
      conversationType: ConversationType.AskGemini,
      includePostText: request.includePostText,
    });
  }

  private send(request: UserPromptRequest): Observable<string> {
    const formData = new FormData();
    formData.append('Prompt', request.prompt);
    formData.append('PostId', String(request.postId));
    formData.append('ConversationType', request.conversationType);

    if (request.includePostText === true) {
      formData.append('IncludePostText', 'true');
    }

    return this.http
      .post(this.geminiUrl, formData, {
        responseType: 'text',
      })
      .pipe(map((response) => parseGeneratedPostText(response)));
  }
}
