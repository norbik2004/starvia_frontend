import { HttpClient } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

import {
  ConversationType,
  type AskGeminiRequest,
  type GeneratePostRequest,
  type UserPromptConversationItem,
  type UserPromptRequest,
  parseGeneratedPostText,
} from '../models/gemini';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly http = inject(HttpClient);
  private readonly geminiUrl = new URL('Gemini', environment.backendUrl).toString();
  private readonly userPromptUrl = new URL('UserPrompt', environment.backendUrl).toString();

  getConversation(postId: number): Observable<UserPromptConversationItem[]> {
    return this.http.get<UserPromptConversationItem[]>(
      `${this.userPromptUrl}/conversation/${postId}`,
      { withCredentials: true }
    );
  }

  generatePost(request: GeneratePostRequest): Observable<string> {
    return this.send({
      prompt: request.prompt,
      postId: request.postId,
      conversationType: ConversationType.GeneratePost,
      includePostText: request.includePostText,
    });
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
        withCredentials: true,
        responseType: 'text',
      })
      .pipe(map((response) => parseGeneratedPostText(response)));
  }

}


