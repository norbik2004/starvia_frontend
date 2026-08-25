import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { parseSignInResponse } from '../models/auth-session';
import { parseUserAccount, type UserAccount } from '../models/user-account';
import { SessionService } from './session';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
};

export type RegisterResponse = {
  userId: string;
};

export type ConfirmEmailRequest = {
  userId: string;
  code: string;
};

export type ResetPasswordRequest = {
  userId: string;
  code: string;
  password: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly loginUrl = new URL('accounts/sign-in', environment.backendUrl).toString();
  private readonly registerUrl = new URL('accounts/register', environment.backendUrl).toString();
  private readonly confirmEmailUrl = new URL(
    'accounts/confirm-email',
    environment.backendUrl,
  ).toString();
  private readonly resendConfirmationEmailUrl = new URL(
    'Account/resend-confirmation-email',
    environment.backendUrl,
  ).toString();
  private readonly forgotPasswordUrl = new URL(
    'accounts/forgot-password',
    environment.backendUrl,
  ).toString();
  private readonly resetPasswordUrl = new URL(
    'accounts/reset-password',
    environment.backendUrl,
  ).toString();
  private readonly accountMeUrl = new URL('accounts/me', environment.backendUrl).toString();
  private readonly accountUrl = new URL('Account', environment.backendUrl).toString();
  private readonly accountChangeSubject = new Subject<UserAccount>();

  /** Emits when account profile fields change (e.g. username update). */
  readonly accountChanges$ = this.accountChangeSubject.asObservable();

  login(request: LoginRequest): Observable<void> {
    return this.http.post<unknown>(this.loginUrl, request).pipe(
      map((response) => parseSignInResponse(response)),
      tap((authSession) => this.session.establish(authSession)),
      map(() => undefined),
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(this.registerUrl, request);
  }

  confirmEmail(request: ConfirmEmailRequest): Observable<void> {
    return this.http
      .post(this.confirmEmailUrl, request, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  resendConfirmationEmail(email: string): Observable<unknown> {
    return this.http.get(this.resendConfirmationEmailUrl, {
      params: { email },
    });
  }

  sendPasswordResetEmail(email: string): Observable<void> {
    return this.http
      .post(this.forgotPasswordUrl, { email }, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http
      .post(this.resetPasswordUrl, request, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  getAccount(): Observable<UserAccount> {
    return this.http.get<unknown>(this.accountMeUrl).pipe(
      map((response) => {
        const account = parseUserAccount(response);
        if (!account) {
          throw new Error('Invalid account response.');
        }

        return account;
      }),
    );
  }

  updateUserName(userName: string): Observable<string> {
    return this.http.put(this.accountUrl, JSON.stringify(userName), {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
    });
  }

  notifyAccountChanged(account: UserAccount): void {
    this.accountChangeSubject.next(account);
  }

  logout(): Observable<void> {
    this.session.setLoggedOut();
    return of(undefined);
  }
}
