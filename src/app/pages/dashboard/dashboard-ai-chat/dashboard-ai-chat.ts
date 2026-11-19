import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import { AutoExpandTextarea } from '../../../components/auto-expand-textarea/auto-expand-textarea';
import { PageLoading } from '../../../components/page-loading/page-loading';
import { PageRevealDirective } from '../../../directives/page-reveal';
import { toApplicationError } from '../../../models/application-error';
import {
  AI_CHAT_SEARCH_MAX_LENGTH,
  AI_CHAT_TITLE_MAX_LENGTH,
  ASK_AGENT_DEFAULT_CHAT_TITLE,
  ASK_AGENT_PROMPT_MAX_LENGTH,
  ChatMessageRole,
  ChatStatus,
  ChatType,
  aiChatMessageRoleLabel,
  displayAiChatTitle,
  titleFromAskPrompt,
  visibleAiChatMessages,
  type AiChatDetail,
  type AiChatMessage,
  type AiChatSummary,
} from '../../../models/ai-chat';
import {
  displayBrandProfileName,
  type BrandProfileSummary,
} from '../../../models/brand-profile';
import { DisplayDatetimePipe } from '../../../pipes/display-datetime';
import { AiAgentService } from '../../../services/ai-agent';
import { AiChatService } from '../../../services/ai-chat';
import { BrandProfileService } from '../../../services/brand-profile';
import { DashboardAlert } from '../shared/dashboard-alert/dashboard-alert';
import { DashboardDeleteButton } from '../shared/dashboard-delete-button/dashboard-delete-button';
import { DashboardDeleteConfirmService } from '../shared/dashboard-delete-confirm-sheet/dashboard-delete-confirm.service';
import { DashboardPageHeader } from '../shared/dashboard-page-header/dashboard-page-header';

const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-dashboard-ai-chat',
  imports: [
    FormsModule,
    AutoExpandTextarea,
    PageLoading,
    PageRevealDirective,
    DisplayDatetimePipe,
    DashboardAlert,
    DashboardDeleteButton,
    DashboardPageHeader,
  ],
  styleUrl: './dashboard-ai-chat.scss',
  template: `
    <section class="dashboard-content-page dashboard-ai-chat" aria-labelledby="dashboard-ai-chat-title">
      <div appPageReveal class="dashboard-ai-chat__top">
        <app-dashboard-page-header
          titleId="dashboard-ai-chat-title"
          eyebrow="Starvia AI"
          title="Czat AI"
          titleMark="promptuj swobodnie"
          intro="Rozmawiaj z asystentem o strategii, pomysłach i tonie marki. Wątki zapisują się na koncie."
          scribble="Pytaj. Iteruj. Publikuj."
        >
          <button
            type="button"
            class="dashboard-ai-chat__new-btn"
            [disabled]="isSending()"
            (click)="createChat()"
          >
            <span class="material-icons" aria-hidden="true">add</span>
            Nowy czat
          </button>
        </app-dashboard-page-header>

        <app-dashboard-alert [message]="listError()" [retryable]="true" (retry)="reloadChats()" />
        <app-dashboard-alert
          [message]="actionError()"
          [tone]="'error'"
          [dismissible]="true"
          (dismissed)="actionError.set(null)"
        />
      </div>

      <div
        class="dashboard-ai-chat__workspace"
        [class.dashboard-ai-chat__workspace--thread]="mobileThreadOpen()"
        appPageReveal
      >
        <aside class="dashboard-ai-chat__sidebar" aria-label="Lista czatów">
          <div class="dashboard-ai-chat__sidebar-head">
            <div class="dashboard-ai-chat__search">
              <span class="material-icons dashboard-ai-chat__search-icon" aria-hidden="true">search</span>
              <input
                type="search"
                class="dashboard-ai-chat__search-input"
                placeholder="Szukaj czatów…"
                aria-label="Szukaj czatów"
                [attr.maxlength]="searchMaxLength"
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchInput($event)"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  class="dashboard-ai-chat__search-clear"
                  aria-label="Wyczyść wyszukiwanie"
                  (click)="clearSearch()"
                >
                  <span class="material-icons" aria-hidden="true">close</span>
                </button>
              }
            </div>
          </div>

          @if (isListLoading() && chats().length === 0) {
            <app-page-loading label="Ładowanie czatów…" />
          } @else if (chats().length === 0) {
            <div class="dashboard-ai-chat__sidebar-empty">
              <span class="material-icons" aria-hidden="true">forum</span>
              <p>
                @if (searchQuery().trim()) {
                  Brak czatów dla „{{ searchQuery().trim() }}”.
                } @else {
                  Nie masz jeszcze rozmów. Zacznij od nowego czatu.
                }
              </p>
              @if (!searchQuery().trim()) {
                <button type="button" class="btn btn--primary" (click)="createChat()">
                  <span class="material-icons" aria-hidden="true">add</span>
                  Nowy czat
                </button>
              }
            </div>
          } @else {
            <ul
              class="dashboard-ai-chat__chat-list"
              role="list"
              [class.is-loading]="isListLoading()"
            >
              @for (chat of chats(); track chat.id) {
                <li>
                  <button
                    type="button"
                    class="dashboard-ai-chat__chat-item"
                    [class.is-active]="!isComposingNew() && chat.id === activeChatId()"
                    [disabled]="isSending()"
                    (click)="selectChat(chat.id)"
                  >
                    <span class="dashboard-ai-chat__chat-item-icon material-icons" aria-hidden="true">
                      chat_bubble_outline
                    </span>
                    <span class="dashboard-ai-chat__chat-item-body">
                      <span class="dashboard-ai-chat__chat-item-title">{{ chatTitle(chat) }}</span>
                      <span class="dashboard-ai-chat__chat-item-preview">
                        {{ chat.lastMessageAt ? 'Ostatnia aktywność' : 'Bez wiadomości' }}
                      </span>
                      <span class="dashboard-ai-chat__chat-item-meta">
                        {{ (chat.lastMessageAt ?? chat.createdAt) | displayDatetime }}
                      </span>
                    </span>
                  </button>
                </li>
              }
            </ul>
          }
        </aside>

        <div class="dashboard-ai-chat__thread" aria-live="polite">
          @if (isComposingNew() || activeChat()) {
            <header class="dashboard-ai-chat__thread-head">
              <button
                type="button"
                class="dashboard-ai-chat__back"
                aria-label="Wróć do listy czatów"
                [disabled]="isSending()"
                (click)="closeMobileThread()"
              >
                <span class="material-icons" aria-hidden="true">arrow_back</span>
              </button>

              @if (renaming()) {
                <input
                  #renameInput
                  class="dashboard-ai-chat__rename-input"
                  type="text"
                  [attr.maxlength]="titleMaxLength"
                  aria-label="Nazwa czatu"
                  [ngModel]="renameDraft()"
                  (ngModelChange)="renameDraft.set($event)"
                  (keydown.enter)="commitRename()"
                  (keydown.escape)="cancelRename()"
                  (blur)="commitRename()"
                />
              } @else {
                <div class="dashboard-ai-chat__thread-titles">
                  <h2 class="dashboard-ai-chat__thread-title">
                    {{ isComposingNew() ? 'Nowy czat' : chatTitle(activeChat()) }}
                  </h2>
                  <p class="dashboard-ai-chat__thread-hint">
                    @if (isComposingNew()) {
                      Pierwsza wiadomość utworzy wątek AskAgent
                    } @else {
                      Asystent social media
                    }
                  </p>
                </div>
              }

              <div class="dashboard-ai-chat__thread-actions">
                @if (!isComposingNew()) {
                  <button
                    type="button"
                    class="dashboard-ai-chat__icon-btn"
                    aria-label="Zmień nazwę czatu"
                    title="Zmień nazwę"
                    [disabled]="renaming() || isSending() || isThreadLoading()"
                    (click)="startRename()"
                  >
                    <span class="material-icons" aria-hidden="true">edit</span>
                  </button>
                  <app-dashboard-delete-button
                    size="sm"
                    ariaLabel="Usuń czat"
                    tooltip="Usuń czat"
                    [disabled]="isSending() || isThreadLoading()"
                    (clicked)="confirmDeleteChat($event)"
                  />
                }
              </div>
            </header>

            @if (isThreadLoading() && !activeChat()) {
              <app-page-loading label="Ładowanie rozmowy…" />
            } @else {
              <div class="dashboard-ai-chat__messages" #messagesPane>
                @if (threadMessages().length === 0 && !isSending()) {
                  <div class="dashboard-ai-chat__empty-thread">
                    <span class="material-icons dashboard-ai-chat__empty-icon" aria-hidden="true">
                      auto_awesome
                    </span>
                    <h3>Zacznij rozmowę</h3>
                    <p>
                      Opisz pomysł na post, brief marki albo ton komunikacji. Asystent doradza —
                      gotowe treści wrzucaj przez generowanie posta.
                    </p>
                    <ul class="dashboard-ai-chat__suggestions">
                      @for (suggestion of suggestions; track suggestion) {
                        <li>
                          <button type="button" [disabled]="isSending()" (click)="useSuggestion(suggestion)">
                            {{ suggestion }}
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                } @else {
                  @for (message of threadMessages(); track message.id) {
                    <article
                      class="dashboard-ai-chat__bubble"
                      [class.dashboard-ai-chat__bubble--user]="message.role === userRole"
                      [class.dashboard-ai-chat__bubble--assistant]="message.role === assistantRole"
                    >
                      <div class="dashboard-ai-chat__bubble-meta">
                        <span class="dashboard-ai-chat__bubble-role">
                          {{ roleLabel(message.role) }}
                        </span>
                        <time [attr.datetime]="message.createdAt">
                          {{ message.createdAt | displayDatetime }}
                        </time>
                      </div>
                      <p class="dashboard-ai-chat__bubble-text">{{ message.content }}</p>
                    </article>
                  }

                  @if (isSending()) {
                    <div class="dashboard-ai-chat__typing" aria-label="AI pisze odpowiedź">
                      <span></span><span></span><span></span>
                    </div>
                  }
                }
              </div>

              <form class="dashboard-ai-chat__composer" (ngSubmit)="sendMessage()">
                @if (brandProfiles().length > 0) {
                  <label class="dashboard-ai-chat__brand">
                    <span class="dashboard-ai-chat__brand-label">Profil marki</span>
                    <select
                      class="dashboard-ai-chat__brand-select"
                      [ngModel]="brandProfileId()"
                      (ngModelChange)="brandProfileId.set($event)"
                      [ngModelOptions]="{ standalone: true }"
                      [disabled]="isSending()"
                      aria-label="Profil marki dla kontekstu AI"
                    >
                      <option value="">Bez profilu marki</option>
                      @for (profile of brandProfiles(); track profile.id) {
                        <option [value]="profile.id">{{ brandName(profile) }}</option>
                      }
                    </select>
                  </label>
                }

                <div class="dashboard-ai-chat__composer-box">
                  <app-auto-expand-textarea
                    variant="gemini-panel"
                    ariaLabel="Wiadomość do AI"
                    placeholder="Napisz prompt…"
                    [maxLength]="promptMaxLength"
                    [enterSubmits]="true"
                    [disabled]="isSending()"
                    [value]="draft()"
                    (valueChange)="draft.set($event)"
                    (enter)="sendMessage()"
                  />
                  <div class="dashboard-ai-chat__composer-bar">
                    <span class="dashboard-ai-chat__counter">
                      {{ draft().length }}/{{ promptMaxLength }}
                    </span>
                    <button
                      type="submit"
                      class="dashboard-ai-chat__send"
                      [disabled]="!canSend()"
                      [attr.aria-label]="isSending() ? 'Wysyłanie…' : 'Wyślij wiadomość'"
                    >
                      <span class="material-icons" aria-hidden="true">send</span>
                      Wyślij
                    </button>
                  </div>
                </div>
              </form>
            }
          } @else if (isThreadLoading()) {
            <app-page-loading label="Ładowanie rozmowy…" />
          } @else {
            <div class="dashboard-ai-chat__no-selection">
              <span class="material-icons" aria-hidden="true">forum</span>
              <h2>Wybierz lub utwórz czat</h2>
              <p>Lista po lewej trzyma Twoje wątki AskAgent. Nowy czat otwiera czystą rozmowę.</p>
              <button type="button" class="btn btn--primary" (click)="createChat()">
                <span class="material-icons" aria-hidden="true">add</span>
                Nowy czat
              </button>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class DashboardAiChat {
  private readonly aiChatService = inject(AiChatService);
  private readonly aiAgentService = inject(AiAgentService);
  private readonly brandProfileService = inject(BrandProfileService);
  private readonly deleteConfirm = inject(DashboardDeleteConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly messagesPane = viewChild<ElementRef<HTMLElement>>('messagesPane');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly searchInput$ = new Subject<string>();

  protected readonly promptMaxLength = ASK_AGENT_PROMPT_MAX_LENGTH;
  protected readonly searchMaxLength = AI_CHAT_SEARCH_MAX_LENGTH;
  protected readonly titleMaxLength = AI_CHAT_TITLE_MAX_LENGTH;
  protected readonly userRole = ChatMessageRole.User;
  protected readonly assistantRole = ChatMessageRole.Assistant;
  protected readonly suggestions = [
    'Napisz 5 pomysłów na posty LinkedIn o naszym produkcie',
    'Ułóż brief tonu komunikacji dla marki premium',
    'Skróć ten opis oferty do 120 znaków',
  ] as const;

  protected readonly chats = signal<AiChatSummary[]>([]);
  protected readonly activeChatId = signal<string | null>(null);
  protected readonly activeChat = signal<AiChatDetail | null>(null);
  protected readonly isComposingNew = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly draft = signal('');
  protected readonly brandProfileId = signal('');
  protected readonly brandProfiles = signal<BrandProfileSummary[]>([]);
  protected readonly isListLoading = signal(false);
  protected readonly isThreadLoading = signal(false);
  protected readonly isSending = signal(false);
  protected readonly renaming = signal(false);
  protected readonly renameDraft = signal('');
  protected readonly mobileThreadOpen = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly pendingMessages = signal<AiChatMessage[]>([]);

  protected readonly threadMessages = computed(() => {
    const fromServer = visibleAiChatMessages(this.activeChat()?.messages ?? []);
    const pending = this.pendingMessages();
    if (pending.length === 0) {
      return fromServer;
    }

    const knownIds = new Set(fromServer.map((message) => message.id));
    return [...fromServer, ...pending.filter((message) => !knownIds.has(message.id))];
  });

  constructor() {
    this.searchInput$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((search) => {
          this.isListLoading.set(true);
          this.listError.set(null);
          return this.aiChatService
            .browse({
              type: ChatType.AskAgent,
              status: ChatStatus.Active,
              search,
            })
            .pipe(
              catchError((error) => {
                this.listError.set(
                  toApplicationError(error, 'Nie udało się wczytać listy czatów.').description,
                );
                return of(null);
              }),
              finalize(() => this.isListLoading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        if (!page) {
          return;
        }

        this.chats.set(page.items);

        const activeId = this.activeChatId();
        if (activeId && !page.items.some((chat) => chat.id === activeId) && !this.isComposingNew()) {
          this.activeChatId.set(null);
          this.activeChat.set(null);
          this.pendingMessages.set([]);
        }
      });

    effect(() => {
      this.threadMessages();
      this.isSending();
      queueMicrotask(() => this.scrollMessagesToBottom());
    });

    effect(() => {
      if (!this.renaming()) {
        return;
      }
      queueMicrotask(() => {
        const input = this.renameInput()?.nativeElement;
        if (!input) {
          return;
        }
        input.focus();
        input.select();
      });
    });

    this.reloadChats();
    this.loadBrandProfiles();
  }

  protected canSend(): boolean {
    return (
      (this.isComposingNew() || !!this.activeChatId()) &&
      !!this.draft().trim() &&
      !this.isSending() &&
      !this.renaming() &&
      !this.isThreadLoading()
    );
  }

  protected chatTitle(chat: AiChatSummary | AiChatDetail | null | undefined): string {
    return displayAiChatTitle(chat?.title);
  }

  protected roleLabel(role: ChatMessageRole): string {
    return aiChatMessageRoleLabel(role);
  }

  protected brandName(profile: BrandProfileSummary): string {
    return displayBrandProfileName(profile.name);
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchInput$.next(value.trim().slice(0, AI_CHAT_SEARCH_MAX_LENGTH));
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.searchInput$.next('');
  }

  protected reloadChats(): void {
    this.searchInput$.next(this.searchQuery().trim().slice(0, AI_CHAT_SEARCH_MAX_LENGTH));
  }

  protected createChat(): void {
    if (this.isSending()) {
      return;
    }

    this.actionError.set(null);
    this.renaming.set(false);
    this.isComposingNew.set(true);
    this.activeChatId.set(null);
    this.activeChat.set(null);
    this.pendingMessages.set([]);
    this.draft.set('');
    this.mobileThreadOpen.set(true);
  }

  protected selectChat(chatId: string): void {
    if (this.isSending()) {
      return;
    }

    if (chatId === this.activeChatId() && !this.isComposingNew()) {
      this.mobileThreadOpen.set(true);
      return;
    }

    this.actionError.set(null);
    this.renaming.set(false);
    this.isComposingNew.set(false);
    this.draft.set('');
    this.pendingMessages.set([]);
    this.activeChatId.set(chatId);
    this.mobileThreadOpen.set(true);
    this.loadChat(chatId);
  }

  protected closeMobileThread(): void {
    this.mobileThreadOpen.set(false);
  }

  protected useSuggestion(text: string): void {
    if (this.isSending()) {
      return;
    }
    this.draft.set(text);
  }

  protected sendMessage(): void {
    if (!this.canSend()) {
      return;
    }

    const prompt = this.draft().trim().slice(0, ASK_AGENT_PROMPT_MAX_LENGTH);
    if (!prompt) {
      return;
    }

    const chatId = this.isComposingNew() ? null : this.activeChatId();
    const now = new Date().toISOString();
    const optimisticUser: AiChatMessage = {
      id: `local-user-${Date.now()}`,
      sequence: Number.MAX_SAFE_INTEGER - 1,
      role: ChatMessageRole.User,
      content: prompt,
      model: null,
      inputTokens: null,
      outputTokens: null,
      createdAt: now,
    };

    this.draft.set('');
    this.actionError.set(null);
    this.pendingMessages.update((messages) => [...messages, optimisticUser]);
    this.isSending.set(true);

    this.aiAgentService
      .ask({
        prompt,
        chatId,
        title: chatId ? null : titleFromAskPrompt(prompt),
        brandProfileId: this.brandProfileId() || null,
      })
      .pipe(
        finalize(() => this.isSending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          const assistant: AiChatMessage = {
            id: result.messageId,
            sequence: Number.MAX_SAFE_INTEGER,
            role: ChatMessageRole.Assistant,
            content: result.answer,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            createdAt: new Date().toISOString(),
          };

          this.pendingMessages.update((messages) => [...messages, assistant]);
          this.isComposingNew.set(false);
          this.activeChatId.set(result.chatId);
          this.reloadChats();
          this.loadChat(result.chatId, { keepPendingUntilLoaded: true });
        },
        error: (error) => {
          this.pendingMessages.update((messages) =>
            messages.filter((message) => message.id !== optimisticUser.id),
          );
          this.draft.set(prompt);
          this.actionError.set(
            toApplicationError(error, 'Nie udało się wysłać wiadomości do asystenta.').description,
          );
        },
      });
  }

  protected startRename(): void {
    const chat = this.activeChat();
    if (!chat || this.isSending()) {
      return;
    }
    this.renameDraft.set(displayAiChatTitle(chat.title));
    this.renaming.set(true);
  }

  protected cancelRename(): void {
    this.renaming.set(false);
    this.renameDraft.set('');
  }

  protected commitRename(): void {
    if (!this.renaming()) {
      return;
    }

    const chat = this.activeChat();
    const chatId = this.activeChatId();
    const nextTitle =
      this.renameDraft().trim().slice(0, AI_CHAT_TITLE_MAX_LENGTH) || ASK_AGENT_DEFAULT_CHAT_TITLE;

    this.renaming.set(false);
    this.renameDraft.set('');

    if (!chat || !chatId || nextTitle === displayAiChatTitle(chat.title)) {
      return;
    }

    this.aiChatService
      .update(chatId, { title: nextTitle, status: chat.status })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activeChat.update((current) =>
            current ? { ...current, title: nextTitle } : current,
          );
          this.chats.update((list) =>
            list.map((item) => (item.id === chatId ? { ...item, title: nextTitle } : item)),
          );
        },
        error: (error) => {
          this.actionError.set(
            toApplicationError(error, 'Nie udało się zmienić nazwy czatu.').description,
          );
        },
      });
  }

  protected confirmDeleteChat(event: MouseEvent): void {
    event.stopPropagation();
    const chat = this.activeChat();
    if (!chat || this.isSending()) {
      return;
    }

    this.deleteConfirm
      .open({
        eyebrow: 'Usuwanie czatu',
        title: `Usunąć „${displayAiChatTitle(chat.title)}”?`,
        description: 'Rozmowa i historia znikną trwale z Twojego konta.',
        keepLabel: 'Zostaw',
        deleteLabel: 'Usuń',
        deletingLabel: 'Usuwanie…',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteChat(chat.id);
        }
      });
  }

  private deleteChat(chatId: string): void {
    this.aiChatService
      .remove(chatId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.chats.update((list) => list.filter((chat) => chat.id !== chatId));
          if (this.activeChatId() === chatId) {
            this.activeChatId.set(null);
            this.activeChat.set(null);
            this.pendingMessages.set([]);
            this.isComposingNew.set(false);
            this.mobileThreadOpen.set(false);
          }
        },
        error: (error) => {
          this.actionError.set(
            toApplicationError(error, 'Nie udało się usunąć czatu.').description,
          );
        },
      });
  }

  private loadChat(
    chatId: string,
    options: { keepPendingUntilLoaded?: boolean } = {},
  ): void {
    this.isThreadLoading.set(true);
    if (!options.keepPendingUntilLoaded) {
      this.pendingMessages.set([]);
    }

    this.aiChatService
      .getById(chatId)
      .pipe(
        finalize(() => this.isThreadLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (chat) => {
          if (this.activeChatId() !== chatId) {
            return;
          }

          this.activeChat.set(chat);
          this.pendingMessages.set([]);
        },
        error: (error) => {
          if (this.activeChatId() !== chatId) {
            return;
          }

          this.actionError.set(
            toApplicationError(error, 'Nie udało się wczytać rozmowy.').description,
          );
          if (!options.keepPendingUntilLoaded) {
            this.activeChat.set(null);
          }
        },
      });
  }

  private loadBrandProfiles(): void {
    this.brandProfileService
      .browse(1, 48)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        if (page) {
          this.brandProfiles.set(page.items);
        }
      });
  }

  private scrollMessagesToBottom(): void {
    const pane = this.messagesPane()?.nativeElement;
    if (!pane) {
      return;
    }
    pane.scrollTop = pane.scrollHeight;
  }
}
