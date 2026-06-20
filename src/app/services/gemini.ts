import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  type GeneratePostRequest,
  parseGeneratedPostText,
} from '../models/gemini';

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly http = inject(HttpClient);
  private readonly generatePostUrl = new URL('Gemini/generate-post', environment.backendUrl).toString();

  generatePost(request: GeneratePostRequest): Observable<string> {
    const formData = new FormData();
    formData.append('UserPrompt.Prompt', request.prompt);
    formData.append('UserPrompt.PostId', String(request.postId));
    formData.append('Model', request.model);

    return this.http
      .post(this.generatePostUrl, formData, {
        withCredentials: true,
        responseType: 'text',
      })
      .pipe(map((response) => parseGeneratedPostText(response)));
  }
}
