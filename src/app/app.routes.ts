import { Routes } from '@angular/router';
import { sessionGuard } from './guards/session.guard';
import { DashboardAccount } from './pages/dashboard/dashboard-account/dashboard-account';
import { DashboardOverview } from './pages/dashboard/dashboard-overview/dashboard-overview';
import { DashboardPostCreate } from './pages/dashboard/dashboard-post-create/dashboard-post-create';
import { DashboardPostDetail } from './pages/dashboard/dashboard-post-detail/dashboard-post-detail';
import { DashboardMedia } from './pages/dashboard/dashboard-media/dashboard-media';
import { DashboardPosts } from './pages/dashboard/dashboard-posts/dashboard-posts';
import { DashboardPage } from './pages/dashboard/dashboard';
import { HomePage } from './pages/home/home';
import { LoginPage } from './pages/login/login';
import { NotFoundPage } from './pages/not-found/not-found';
import { RegisterPage } from './pages/register/register';

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
    path: 'register',
    component: RegisterPage,
    canActivate: [sessionGuard],
    data: { session: { mode: 'guest' } },
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
        path: 'media',
        component: DashboardMedia,
      },
      {
        path: 'posts/new',
        component: DashboardPostCreate,
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
