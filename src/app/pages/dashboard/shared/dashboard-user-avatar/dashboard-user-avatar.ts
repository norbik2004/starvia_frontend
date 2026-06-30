import { Component, computed, effect, input, signal } from '@angular/core';
import { getUserInitials } from '../../../../models/user-account';

@Component({
  selector: 'app-dashboard-user-avatar',
  styleUrl: './dashboard-user-avatar.scss',
  template: `
    <span
      class="dashboard-user-avatar"
      [class.dashboard-user-avatar--md]="size() === 'md'"
      [class.dashboard-user-avatar--lg]="size() === 'lg'"
      [class.dashboard-user-avatar--xl]="size() === 'xl'"
      aria-hidden="true"
    >
      @if (showPhoto()) {
        <img
          class="dashboard-user-avatar__photo"
          [src]="profilePictureUrl()!"
          [alt]="userName() + ' profile photo'"
          (error)="onPhotoError()"
        />
      } @else {
        <span class="dashboard-user-avatar__initials">{{ initials() }}</span>
      }
    </span>
  `,
})
export class DashboardUserAvatar {
  readonly userName = input.required<string>();
  readonly profilePictureUrl = input<string | null>(null);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('sm');

  private readonly photoError = signal(false);

  protected readonly initials = computed(() => getUserInitials(this.userName()));

  protected readonly showPhoto = computed(() => {
    const url = this.profilePictureUrl();
    return !!url && !this.photoError();
  });

  constructor() {
    effect(() => {
      this.profilePictureUrl();
      this.photoError.set(false);
    });
  }

  protected onPhotoError(): void {
    this.photoError.set(true);
  }
}
