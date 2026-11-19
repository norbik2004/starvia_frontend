/**
 * AI chats module (`/v1/ai/chats`, `/v1/ai/agent/ask`).
 *
 * Enums mirror `StarviaBackend.Modules.Ai.Core.Chats.Enums`.
 */

export enum ChatType {
  AskAgent = 1,
  PostContentGeneration = 2,
}

export enum ChatStatus {
  Active = 1,
  Archived = 2,
}

export enum ChatMessageRole {
  System = 1,
  User = 2,
  Assistant = 3,
}

/** `BrowseChats.ChatSortBy` — numeric values match the API. */
export enum ChatSortBy {
  LastActivity = 0,
  CreatedAt = 1,
  Title = 2,
}

export const AI_CHAT_TITLE_MAX_LENGTH = 150;
export const AI_CHAT_SEARCH_MAX_LENGTH = 100;
export const AI_CHAT_DEFAULT_PAGE_SIZE = 50;
export const ASK_AGENT_PROMPT_MAX_LENGTH = 8000;
export const ASK_AGENT_DEFAULT_CHAT_TITLE = 'Asystent social media';

export type AiChatSummary = {
  id: string;
  type: ChatType;
  title: string;
  status: ChatStatus;
  postId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  ownerId: string;
};

export type AiChatMessage = {
  id: string;
  sequence: number;
  role: ChatMessageRole;
  content: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
};

export type AiChatDetail = AiChatSummary & {
  messages: AiChatMessage[];
};

export type PagedAiChatsResponse = {
  items: AiChatSummary[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type BrowseAiChatsQuery = {
  page?: number;
  pageSize?: number;
  type?: ChatType | null;
  status?: ChatStatus | null;
  search?: string | null;
  postId?: string | null;
  ownerId?: string | null;
  sortBy?: ChatSortBy;
  descending?: boolean;
};

export type AddAiChatRequest = {
  type: ChatType;
  title: string;
};

export type UpdateAiChatRequest = {
  title: string;
  status: ChatStatus;
};

export type AskAgentRequest = {
  prompt: string;
  chatId?: string | null;
  title?: string | null;
  brandProfileId?: string | null;
};

export type AskAgentResult = {
  chatId: string;
  messageId: string;
  answer: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export function displayAiChatTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : ASK_AGENT_DEFAULT_CHAT_TITLE;
}

/** Visible turns for the chat UI (hides system instructions). */
export function visibleAiChatMessages(
  messages: readonly AiChatMessage[],
): AiChatMessage[] {
  return messages.filter((message) => message.role !== ChatMessageRole.System);
}

export function aiChatMessageRoleLabel(role: ChatMessageRole): string {
  switch (role) {
    case ChatMessageRole.User:
      return 'Ty';
    case ChatMessageRole.Assistant:
      return 'Starvia AI';
    case ChatMessageRole.System:
      return 'System';
    default:
      return 'Wiadomość';
  }
}

export function parseAiChatSummary(value: unknown): AiChatSummary | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = asUuid(record['id'] ?? record['Id']);
  const type = asChatType(record['type'] ?? record['Type']);
  const status = asChatStatus(record['status'] ?? record['Status']);
  const createdAt = asDateString(record['createdAt'] ?? record['CreatedAt']);
  const ownerId = asUuid(record['ownerId'] ?? record['OwnerId']);

  if (!id || type === null || status === null || !createdAt || !ownerId) {
    return null;
  }

  const titleRaw = record['title'] ?? record['Title'];
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';

  return {
    id,
    type,
    title,
    status,
    postId: asUuid(record['postId'] ?? record['PostId']),
    lastMessageAt: asDateString(record['lastMessageAt'] ?? record['LastMessageAt']),
    createdAt,
    ownerId,
  };
}

export function parseAiChatMessage(value: unknown): AiChatMessage | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = asUuid(record['id'] ?? record['Id']);
  const sequence = asInt(record['sequence'] ?? record['Sequence']);
  const role = asChatMessageRole(record['role'] ?? record['Role']);
  const createdAt = asDateString(record['createdAt'] ?? record['CreatedAt']);

  if (!id || sequence === null || role === null || !createdAt) {
    return null;
  }

  const contentRaw = record['content'] ?? record['Content'];
  const modelRaw = record['model'] ?? record['Model'];

  return {
    id,
    sequence,
    role,
    content: typeof contentRaw === 'string' ? contentRaw : '',
    model: typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw.trim() : null,
    inputTokens: asInt(record['inputTokens'] ?? record['InputTokens']),
    outputTokens: asInt(record['outputTokens'] ?? record['OutputTokens']),
    createdAt,
  };
}

export function parseAiChatDetail(value: unknown): AiChatDetail | null {
  const summary = parseAiChatSummary(value);
  if (!summary || !value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const messagesRaw = record['messages'] ?? record['Messages'];
  const messages = Array.isArray(messagesRaw)
    ? messagesRaw
        .map(parseAiChatMessage)
        .filter((item): item is AiChatMessage => item !== null)
        .sort((left, right) => left.sequence - right.sequence)
    : [];

  return { ...summary, messages };
}

export function parsePagedAiChatsResponse(value: unknown): PagedAiChatsResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemsRaw = record['items'] ?? record['Items'];
  const pageIndex = asInt(record['page'] ?? record['Page']);
  const pageSize = asInt(record['pageSize'] ?? record['PageSize']);
  const totalCount = asInt(record['totalCount'] ?? record['TotalCount']);
  const totalPages = asInt(record['totalPages'] ?? record['TotalPages']);

  if (!Array.isArray(itemsRaw) || pageIndex === null || pageSize === null || totalPages === null) {
    return null;
  }

  const items = itemsRaw
    .map(parseAiChatSummary)
    .filter((item): item is AiChatSummary => item !== null);

  const resolvedTotalCount = totalCount ?? items.length;

  return {
    items,
    pageIndex,
    pageSize,
    totalCount: resolvedTotalCount,
    totalPages,
    hasPreviousPage: pageIndex > 1,
    hasNextPage: pageIndex < totalPages,
  };
}

export function parseAddAiChatResult(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return asUuid(record['chatId'] ?? record['ChatId']);
}

export function parseAskAgentResult(value: unknown): AskAgentResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Nieprawidłowa odpowiedź asystenta AI.');
  }

  const record = value as Record<string, unknown>;
  const chatId = asUuid(record['chatId'] ?? record['ChatId']);
  const messageId = asUuid(record['messageId'] ?? record['MessageId']);
  const answerRaw = record['answer'] ?? record['Answer'];

  if (!chatId || !messageId || typeof answerRaw !== 'string') {
    throw new Error('Nieprawidłowa odpowiedź asystenta AI.');
  }

  const modelRaw = record['model'] ?? record['Model'];

  return {
    chatId,
    messageId,
    answer: answerRaw,
    model: typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw.trim() : null,
    inputTokens: asInt(record['inputTokens'] ?? record['InputTokens']),
    outputTokens: asInt(record['outputTokens'] ?? record['OutputTokens']),
  };
}

export function titleFromAskPrompt(prompt: string, maxLength = AI_CHAT_TITLE_MAX_LENGTH): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return ASK_AGENT_DEFAULT_CHAT_TITLE;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asDateString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asChatType(value: unknown): ChatType | null {
  if (value === ChatType.AskAgent || value === ChatType.PostContentGeneration) {
    return value;
  }

  if (value === 'AskAgent') {
    return ChatType.AskAgent;
  }

  if (value === 'PostContentGeneration') {
    return ChatType.PostContentGeneration;
  }

  return null;
}

function asChatStatus(value: unknown): ChatStatus | null {
  if (value === ChatStatus.Active || value === ChatStatus.Archived) {
    return value;
  }

  if (value === 'Active') {
    return ChatStatus.Active;
  }

  if (value === 'Archived') {
    return ChatStatus.Archived;
  }

  return null;
}

function asChatMessageRole(value: unknown): ChatMessageRole | null {
  if (
    value === ChatMessageRole.System ||
    value === ChatMessageRole.User ||
    value === ChatMessageRole.Assistant
  ) {
    return value;
  }

  if (value === 'System') {
    return ChatMessageRole.System;
  }

  if (value === 'User') {
    return ChatMessageRole.User;
  }

  if (value === 'Assistant') {
    return ChatMessageRole.Assistant;
  }

  return null;
}
