export const GEMINI_PROMPT_MAX_LENGTH = 300;
export const GEMINI_CHAT_PROMPT_MAX_LENGTH = GEMINI_PROMPT_MAX_LENGTH;

export enum ConversationType {
  GeneratePost = 'GeneratePost',
  AskGemini = 'AskGemini',
}

export type UserPromptRequest = {
  prompt: string;
  postId: number;
  conversationType: ConversationType;
  includePostText?: boolean;
};

export type GeneratePostRequest = {
  prompt: string;
  postId: number;
  includePostText?: boolean;
};

export type AskGeminiRequest = {
  prompt: string;
  postId: number;
  includePostText?: boolean;
};

export type GeminiChatRole = 'user' | 'assistant';

export type GeminiChatMessage = {
  id: number;
  role: GeminiChatRole;
  text: string;
  attachedPostText?: boolean;
  isTyping?: boolean;
};

export type UserPromptConversationItem = {
  id: number;
  prompt: string;
  response: string;
  postId: number;
  createdAt: string;
};

export function mapConversationToChatMessages(
  items: readonly UserPromptConversationItem[]
): GeminiChatMessage[] {
  const sorted = [...items].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
  const messages: GeminiChatMessage[] = [];
  let messageId = 0;

  for (const item of sorted) {
    const prompt = item.prompt?.trim();
    if (prompt) {
      messages.push({
        id: ++messageId,
        role: 'user',
        text: prompt,
      });
    }

    const response = item.response?.trim();
    if (response) {
      messages.push({
        id: ++messageId,
        role: 'assistant',
        text: response,
      });
    }
  }

  return messages;
}

export type ChatTextSegment = {
  text: string;
  bold: boolean;
};

export type ChatOrderedListItem = {
  title: ChatTextSegment[];
  body: ChatTextSegment[];
  bullets: ChatTextSegment[][];
};

export type ChatMessageBlock =
  | { type: 'heading'; segments: ChatTextSegment[] }
  | { type: 'paragraph'; segments: ChatTextSegment[] }
  | { type: 'list'; items: ChatTextSegment[][] }
  | { type: 'ordered-list'; items: ChatOrderedListItem[] };

export function parseChatTextSegments(text: string): ChatTextSegment[] {
  if (!text) {
    return [];
  }

  const parts = text.split('**');
  const segments: ChatTextSegment[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) {
      continue;
    }

    segments.push({ text: parts[i], bold: i % 2 === 1 });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

function isChatHeadingLine(line: string): boolean {
  return line.startsWith('###');
}

function stripChatHeading(line: string): string {
  return line.replace(/^###\s?/, '');
}

function isChatBulletLine(line: string): boolean {
  return /^\s*\*(?!\*)\s?/.test(line);
}

function stripChatBullet(line: string): string {
  return line.replace(/^\s*\*(?!\*)\s?/, '');
}

function isChatNumberedLine(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function stripChatNumbered(line: string): string {
  return line.replace(/^\s*\d+[.)]\s+/, '');
}

function isChatContinuationLine(line: string): boolean {
  return /^\s{2,}\S/.test(line);
}

export function parseChatMessageBlocks(text: string): ChatMessageBlock[] {
  if (!text) {
    return [];
  }

  const lines = text.split('\n');
  const blocks: ChatMessageBlock[] = [];
  let listItems: ChatTextSegment[][] = [];
  let paragraphLines: string[] = [];
  let orderedItems: ChatOrderedListItem[] = [];
  let currentOrdered: ChatOrderedListItem | null = null;
  let orderedBodyLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: 'paragraph',
      segments: parseChatTextSegments(paragraphLines.join('\n')),
    });
    paragraphLines = [];
  };

  const flushList = (): void => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  };

  const flushOrderedBody = (): void => {
    if (!currentOrdered || orderedBodyLines.length === 0) {
      return;
    }

    currentOrdered.body = parseChatTextSegments(orderedBodyLines.join('\n'));
    orderedBodyLines = [];
  };

  const flushCurrentOrdered = (): void => {
    flushOrderedBody();
    if (!currentOrdered) {
      return;
    }

    orderedItems.push(currentOrdered);
    currentOrdered = null;
  };

  const flushOrderedList = (): void => {
    flushCurrentOrdered();
    if (orderedItems.length === 0) {
      return;
    }

    blocks.push({ type: 'ordered-list', items: orderedItems });
    orderedItems = [];
  };

  for (const line of lines) {
    if (isChatHeadingLine(line)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      blocks.push({
        type: 'heading',
        segments: parseChatTextSegments(stripChatHeading(line)),
      });
      continue;
    }

    if (isChatNumberedLine(line)) {
      flushParagraph();
      flushList();
      flushCurrentOrdered();
      currentOrdered = {
        title: parseChatTextSegments(stripChatNumbered(line)),
        body: [],
        bullets: [],
      };
      continue;
    }

    if (isChatBulletLine(line)) {
      flushParagraph();
      const bulletSegments = parseChatTextSegments(stripChatBullet(line));

      if (currentOrdered) {
        flushOrderedBody();
        currentOrdered.bullets.push(bulletSegments);
      } else {
        flushOrderedList();
        listItems.push(bulletSegments);
      }
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      flushCurrentOrdered();
      continue;
    }

    if (currentOrdered) {
      if (isChatContinuationLine(line)) {
        orderedBodyLines.push(line.trim());
      } else {
        orderedBodyLines.push(line.trim());
      }
      continue;
    }

    flushList();
    flushOrderedList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  flushOrderedList();

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', segments: parseChatTextSegments(text) }];
}

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
