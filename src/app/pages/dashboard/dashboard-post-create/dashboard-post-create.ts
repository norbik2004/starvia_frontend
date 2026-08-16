import { Component, ElementRef, HostListener, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import { normalizePostTitle, POST_TITLE_MAX_LENGTH } from '../../../models/post';
import { PostService } from '../../../services/post';
import { DrawerMotionDirective } from '../../../layout/shared/drawer-motion';

type CreatePostForm = FormGroup<{
  title: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-create',
  imports: [ReactiveFormsModule, DrawerMotionDirective],
  styleUrl: './dashboard-post-create.scss',
  template: `
    <button
      type="button"
      class="post-create-drawer__backdrop"
      appDrawerMotion="backdrop"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      aria-label="Close new post panel"
      (click)="cancel()"
    ></button>

    <aside
      #drawer
      class="post-create-drawer"
      appDrawerMotion="panel"
      [drawerMotionState]="open() ? 'open' : closing() ? 'closing' : 'closed'"
      [attr.aria-hidden]="!open()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-create-title"
      aria-describedby="post-create-description"
    >
      <header class="post-create-drawer__head">
        <div>
          <p class="post-create-drawer__eyebrow">New content</p>
          <h1 id="post-create-title" class="post-create-drawer__title">Create a post</h1>
        </div>
        <button
          type="button"
          class="post-create-drawer__close"
          aria-label="Close new post panel"
          [disabled]="isCreating()"
          (click)="cancel()"
        >
          <span class="post-create-drawer__close-icon" aria-hidden="true"></span>
        </button>
      </header>

      <form class="post-create-drawer__form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="post-create-drawer__body">
          <p id="post-create-description" class="post-create-drawer__description">
            Start with a clear title. You can add the content, media and publication details in the next step.
          </p>

          @if (errorMessage()) {
            <p class="post-create-drawer__status" role="alert">{{ errorMessage() }}</p>
          }

          <div class="field">
            <label class="field__label" for="create-post-title">Post title</label>
            <textarea
              #titleInput
              id="create-post-title"
              class="field__input"
              formControlName="title"
              rows="5"
              maxlength="{{ titleMaxLength }}"
              autocomplete="off"
              placeholder="What do you want to write about?"
              aria-describedby="create-post-title-hint create-post-title-error"
              (input)="onTitleInput()"
            ></textarea>
            <div class="field__meta">
              <div aria-live="polite">
                @if (form.controls.title.touched && form.controls.title.hasError('required')) {
                  <p id="create-post-title-error" class="field__error" role="alert">Title is required.</p>
                } @else if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
                  <p id="create-post-title-error" class="field__error" role="alert">
                    Title cannot exceed {{ titleMaxLength }} characters.
                  </p>
                }
              </div>
              <span id="create-post-title-hint" class="field__counter">
                {{ form.controls.title.value.length }}/{{ titleMaxLength }}
              </span>
            </div>
          </div>
        </div>

        <footer class="post-create-drawer__actions">
          <button
            type="button"
            class="btn btn--secondary"
            [disabled]="isCreating()"
            (click)="cancel()"
          >
            Cancel
          </button>
          <button type="submit" class="btn btn--primary" [disabled]="isCreating() || form.invalid">
            <span class="material-icons" aria-hidden="true">add</span>
            {{ isCreating() ? 'Creating…' : 'Create post' }}
          </button>
        </footer>
      </form>
    </aside>
  `,
})
export class DashboardPostCreate {
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  private readonly drawer = viewChild<ElementRef<HTMLElement>>('drawer');

  readonly closed = output<void>();
  readonly open = input(false);
  readonly closing = input(false);

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;

  protected readonly form: CreatePostForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(POST_TITLE_MAX_LENGTH)],
    }),
  });

  protected readonly isCreating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly focusWhenOpened = effect((onCleanup) => {
    if (!this.open()) {
      return;
    }

    this.form.reset({ title: '' });
    this.errorMessage.set(null);
    const frame = requestAnimationFrame(() => this.titleInput()?.nativeElement.focus());
    onCleanup(() => cancelAnimationFrame(frame));
  });

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    if (event.key === 'Escape') {
      this.cancel();
      return;
    }

    if (event.key === 'Tab') {
      this.keepFocusInDrawer(event);
    }
  }

  protected onTitleInput(): void {
    this.applyClampedInput(this.form.controls.title, this.clampTitle.bind(this), this.titleInput()?.nativeElement);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const title = this.clampTitle(this.form.controls.title.value.trim());

    this.isCreating.set(true);
    this.errorMessage.set(null);

    this.postService
      .createPost({ title })
      .pipe(finalize(() => this.isCreating.set(false)))
      .subscribe({
        next: (created) => {
          void this.router.navigate(['/dashboard/posts', created.id]);
        },
        error: (error) => {
          this.errorMessage.set(toApplicationError(error, 'Could not create post.').description);
        },
      });
  }

  protected cancel(): void {
    if (this.open() && !this.isCreating() && !this.closing()) {
      this.closed.emit();
    }
  }

  private applyClampedInput(
    control: FormControl<string>,
    clamp: (value: string) => string,
    textarea?: HTMLTextAreaElement
  ): void {
    const next = clamp(control.value);
    if (next === control.value) {
      return;
    }

    const cursor = textarea?.selectionStart ?? next.length;
    control.setValue(next, { emitEvent: false });

    queueMicrotask(() => {
      if (!textarea) {
        return;
      }

      textarea.setSelectionRange(Math.min(cursor, next.length), Math.min(cursor, next.length));
    });
  }

  private clampTitle(value: string): string {
    return normalizePostTitle(value).slice(0, POST_TITLE_MAX_LENGTH);
  }

  private keepFocusInDrawer(event: KeyboardEvent): void {
    const focusable = Array.from(
      this.drawer()?.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
