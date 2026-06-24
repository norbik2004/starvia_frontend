import { HttpClient } from '@angular/common/http';

import { Injectable, inject } from '@angular/core';

import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

import {

  ConversationType,

  type AskGeminiRequest,

  type GeneratePostRequest,

  type UserPromptConversationItem,

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

    const formData = new FormData();

    formData.append('Prompt', request.prompt);

    formData.append('PostId', String(request.postId));

    formData.append('ConversationType', ConversationType.GeneratePost);



    return this.send(formData);

  }



  askGemini(request: AskGeminiRequest): Observable<string> {

    const formData = new FormData();

    formData.append('Prompt', request.prompt);

    formData.append('PostId', String(request.postId));

    formData.append('ConversationType', ConversationType.AskGemini);

    formData.append('IncludePostContent', String(request.includePostContent));



    const postContent = request.postContent?.trim();

    if (request.includePostContent && postContent) {

      formData.append('PostContent', postContent);

    }



    return this.send(formData);

  }



  private send(formData: FormData): Observable<string> {

    return this.http

      .post(this.geminiUrl, formData, {

        withCredentials: true,

        responseType: 'text',

      })

      .pipe(map((response) => parseGeneratedPostText(response)));

  }

}


