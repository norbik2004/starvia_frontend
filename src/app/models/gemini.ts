export const GEMINI_MODELS = [
  { value: 'Gemini3Point1FlashLitePreview', label: 'Gemini 3.1 Flash Lite (Preview)' },
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number]['value'];

export const GEMINI_DEFAULT_MODEL: GeminiModel = 'Gemini3Point1FlashLitePreview';

export type GeneratePostRequest = {
  prompt: string;
  postId: number;
  model: GeminiModel;
};

export function parseGeneratedPostText(response: unknown): string {
  if (typeof response === 'string') {
    const trimmed = response.trim();
    if (!trimmed) {
      throw new Error('Invalid generation response.');
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        return parseGeneratedPostText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;

    for (const key of ['text', 'generatedText', 'content', 'body', 'result', 'message', 'output']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  throw new Error('Invalid generation response.');
}
