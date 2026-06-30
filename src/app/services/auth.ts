import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { parseUserAccount, type UserAccount } from '../models/user-account';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly loginUrl = new URL('Login/login', environment.backendUrl).toString();
  private readonly registerUrl = new URL('Account/register', environment.backendUrl).toString();
  private readonly resendConfirmationEmailUrl = new URL(
    'Account/resend-confirmation-email',
    environment.backendUrl
  ).toString();
  private readonly resetPasswordUrl = new URL('Account/reset-password', environment.backendUrl).toString();
  private readonly confirmResetPasswordUrl = new URL(
    'Account/confirm-reset-password',
    environment.backendUrl
  ).toString();
  private readonly sessionUrl = new URL('Account/me', environment.backendUrl).toString();
  private readonly accountUrl = new URL('Account', environment.backendUrl).toString();
  private readonly logoutUrl = new URL('Login/logout', environment.backendUrl).toString();
  private readonly accountChangeSubject = new Subject<UserAccount>();

  /** Emits when account profile fields change (e.g. username update). */
  readonly accountChanges$ = this.accountChangeSubject.asObservable();

  login(request: LoginRequest): Observable<unknown> {
    return this.http.post(this.loginUrl, request, { withCredentials: true });
  }

  register(request: RegisterRequest): Observable<unknown> {
    return this.http.post(this.registerUrl, request, { withCredentials: true });
  }

  resendConfirmationEmail(email: string): Observable<unknown> {
    return this.http.get(this.resendConfirmationEmailUrl, {
      withCredentials: true,
      params: { email },
    });
  }

  sendPasswordResetEmail(email: string): Observable<unknown> {
    return this.http.get(this.resetPasswordUrl, {
      withCredentials: true,
      params: { email },
    });
  }

  confirmResetPassword(token: string, userId: string, password: string): Observable<string> {
    return this.http.post(this.confirmResetPasswordUrl, JSON.stringify(password), {
      withCredentials: true,
      params: { token, userId },
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
    });
  }

  getSession(): Observable<unknown> {
    return this.http.get(this.sessionUrl, { withCredentials: true });
  }

  getAccount(): Observable<UserAccount> {
    return this.http.get<unknown>(this.sessionUrl, { withCredentials: true }).pipe(
      map((response) => {
        const account = parseUserAccount(response);
        if (!account) {
          throw new Error('Invalid account response.');
        }

        return account;
      })
    );
  }

  updateUserName(userName: string): Observable<string> {
    return this.http.put(this.accountUrl, JSON.stringify(userName), {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
    });
  }

  notifyAccountChanged(account: UserAccount): void {
    this.accountChangeSubject.next(account);
  }

  logout(): Observable<unknown> {
    return this.http.post(this.logoutUrl, null, { withCredentials: true });
  }
}
