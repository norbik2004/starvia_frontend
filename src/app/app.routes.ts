import { Routes } from '@angular/router';
import { sessionGuard } from './guards/session.guard';
import { emailConfirmedAccessGuard } from './guards/email-confirmed-access.guard';
import { confirmEmailAccessGuard } from './guards/confirm-email-access.guard';
import { DashboardSocialAccounts } from './pages/dashboard/dashboard-social-accounts/dashboard-social-accounts';
import { DashboardSocialAccountDetail } from './pages/dashboard/dashboard-social-account-detail/dashboard-social-account-detail';
import { DashboardAccount } from './pages/dashboard/dashboard-account/dashboard-account';
import { DashboardOverview } from './pages/dashboard/dashboard-overview/dashboard-overview';
import { DashboardPostDetail } from './pages/dashboard/dashboard-post-detail/dashboard-post-detail';
import { DashboardMedia } from './pages/dashboard/dashboard-media/dashboard-media';
import { DashboardMediaGenerate } from './pages/dashboard/dashboard-media-generate/dashboard-media-generate';
import { DashboardPosts } from './pages/dashboard/dashboard-posts/dashboard-posts';
import { DashboardPage } from './pages/dashboard/dashboard';
import { HomePage } from './pages/home/home';
import { LoginPage } from './pages/login/login';
import { NotFoundPage } from './pages/not-found/not-found';
import { RegisterPage } from './pages/register/register';
import { ConfirmEmailPage } from './pages/confirm-email/confirm-email';
import { EmailConfirmedPage } from './pages/email-confirmed/email-confirmed';
import { ForgotPasswordPage } from './pages/forgot-password/forgot-password';
import { ResetPasswordPage } from './pages/reset-password/reset-password';

export const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
  {
    path: 'login',
    component: LoginPage,
    canActivate: [sessionGuard],
    data: { session: { mode: 'guest' } },
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordPage,
    canActivate: [sessionGuard],
    data: { session: { mode: 'guest' } },
  },
  {
    path: 'register',
    component: RegisterPage,
    canActivate: [sessionGuard],
    data: { session: { mode: 'guest' } },
  },
  {
    path: 'confirm-email',
    component: ConfirmEmailPage,
    canActivate: [sessionGuard, confirmEmailAccessGuard],
    data: { session: { mode: 'guest' } },
  },
  {
    path: 'email-confirmed',
    component: EmailConfirmedPage,
    canActivate: [emailConfirmedAccessGuard],
  },
  {
    path: 'reset-password',
    component: ResetPasswordPage,
  },
  {
    path: 'dashboard',
    component: DashboardPage,
    canActivate: [sessionGuard],
    data: { session: { mode: 'auth' } },
    children: [
      {
        path: '',
        component: DashboardOverview,
      },
      {
        path: 'posts',
        component: DashboardPosts,
      },
      {
        path: 'media/generate',
        component: DashboardMediaGenerate,
      },
      {
        path: 'media',
        component: DashboardMedia,
      },
      {
        path: 'posts/new',
        redirectTo: 'posts',
      },
      {
        path: 'posts/:id',
        component: DashboardPostDetail,
      },
      {
        path: 'account',
        component: DashboardAccount,
      },
      {
        path: 'social-accounts/:id',
        component: DashboardSocialAccountDetail,
      },
      {
        path: 'social-accounts',
        component: DashboardSocialAccounts,
      },
      {
        path: '**',
        redirectTo: '/404',
      },
    ],
  },
  {
    path: '404',
    component: NotFoundPage,
  },
  {
    path: '**',
    component: NotFoundPage,
  },
];
