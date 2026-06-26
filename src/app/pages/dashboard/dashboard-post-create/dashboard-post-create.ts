import { AfterViewInit, Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toApplicationError } from '../../../models/application-error';
import { normalizePostTitle, POST_TITLE_MAX_LENGTH } from '../../../models/post';
import { PostService } from '../../../services/post';
import {
  DEFAULT_POSTS_LIST_QUERY,
  postsListQueryToParams,
  readPostsListQueryFromHistory,
} from '../dashboard-posts/posts-list-query';
import { PageRevealDirective } from '../../../directives/page-reveal';

type CreatePostForm = FormGroup<{
  title: FormControl<string>;
}>;

@Component({
  selector: 'app-dashboard-post-create',
  imports: [RouterLink, ReactiveFormsModule, PageRevealDirective],
  styleUrl: '../dashboard-post-detail/dashboard-post-detail.scss',
  template: `
    <section class="dashboard-content-page post-detail" aria-labelledby="post-create-title" appPageReveal>
      <header class="post-detail__header">
        <div class="post-detail__top">
          <div class="post-detail__nav">
            <a
              [routerLink]="['/dashboard/posts']"
              [queryParams]="postsReturnQueryParams()"
              class="section-eyebrow post-detail__eyebrow"
            >
              ← Back to posts
            </a>
          </div>
        </div>

        <h1 id="post-create-title" class="post-detail__title post-detail__title--static">New post</h1>
      </header>

      @if (errorMessage()) {
        <p class="posts-status posts-status--error" role="alert">{{ errorMessage() }}</p>
      }

      <form class="post-detail__sections" [formGroup]="form" (ngSubmit)="submit()">
        <section class="post-detail__content" aria-labelledby="post-create-title-label">
          <p id="post-create-title-label" class="section-eyebrow post-detail__content-label">Title</p>
          <div class="dashboard-edit-panel post-detail__three-quarters">
            <textarea
              #titleInput
              id="create-post-title"
              class="field__input field__input--title"
              formControlName="title"
              rows="2"
              maxlength="{{ titleMaxLength }}"
              autocomplete="off"
              aria-describedby="create-post-title-hint create-post-title-error"
              (input)="onTitleInput()"
            ></textarea>
            <div class="dashboard-edit-foot">
              <p id="create-post-title-hint" class="dashboard-edit-hint">
                {{ form.controls.title.value.length }}/{{ titleMaxLength }}
              </p>
              @if (form.controls.title.touched && form.controls.title.hasError('required')) {
                <p id="create-post-title-error" class="field__error" role="alert">Title is required.</p>
              }
              @if (form.controls.title.touched && form.controls.title.hasError('maxlength')) {
                <p id="create-post-title-error" class="field__error" role="alert">
                  Title cannot exceed {{ titleMaxLength }} characters.
                </p>
              }
              <div class="dashboard-inline-actions">
                <button type="submit" class="btn btn--raised-primary btn--compact" [disabled]="isCreating() || form.invalid">
                  {{ isCreating() ? 'Creating…' : 'Create post' }}
                </button>
                <button
                  type="button"
                  class="btn btn--raised-secondary btn--compact"
                  [disabled]="isCreating()"
                  (click)="cancel()"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </section>
      </form>
    </section>
  `,
})
export class DashboardPostCreate implements AfterViewInit {
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);
  private readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');

  protected readonly titleMaxLength = POST_TITLE_MAX_LENGTH;
  protected readonly postsReturnQueryParams = signal(
    postsListQueryToParams(readPostsListQueryFromHistory() ?? DEFAULT_POSTS_LIST_QUERY)
  );

  protected readonly form: CreatePostForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(POST_TITLE_MAX_LENGTH)],
    }),
  });

  protected readonly isCreating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngAfterViewInit(): void {
    queueMicrotask(() => this.titleInput()?.nativeElement?.focus());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (!this.isCreating()) {
      this.cancel();
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
    void this.router.navigate(['/dashboard/posts'], {
      queryParams: this.postsReturnQueryParams(),
    });
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
}
