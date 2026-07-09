import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CONFIG } from '../../core/config';
import { PASSWORD_POLICY } from '../../core/auth/auth-types';

type Step =
  | 'welcome'
  | 'signIn'
  | 'create'
  | 'confirmCode'
  | 'newPassword'
  | 'forgot'
  | 'forgotCode'
  | 'profile';

/**
 * The account ritual — same full-screen pattern as the check-in: one
 * component, a signal-driven step machine, no tab bar. Steps advance from
 * flow RESULTS ('done' | 'confirmSignUp' | 'newPasswordRequired' | 'error');
 * errors render as calm copy from the `lastError` signal, never as thrown
 * surprises. Signing in or out never touches the local forest.
 */
@Component({
  selector: 'app-account',
  imports: [RouterLink],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class AccountPage {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Where the auth gate was headed — internal paths only. */
  readonly volver = input<string>();

  protected readonly isMock = APP_CONFIG.backend === 'mock';
  protected readonly minLength = PASSWORD_POLICY.minLength;

  protected readonly step = signal<Step>('welcome');

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly password2 = signal('');
  protected readonly email = signal('');
  protected readonly displayName = signal('');
  protected readonly code = signal('');

  /** Client-side-only complaint (password mismatch) — not an auth error. */
  protected readonly localError = signal('');
  /** Gentle success line ("your new password is ready"). */
  protected readonly notice = signal('');
  protected readonly confirmingDelete = signal(false);

  constructor() {
    if (this.auth.status() === 'signedIn') this.step.set('profile');
    // A cross-tab sign-out must not leave THIS tab on the profile step with
    // sign-out/delete buttons a guest can see.
    effect(() => {
      if (this.auth.status() === 'guest' && this.step() === 'profile') {
        this.step.set('welcome');
      }
    });
  }

  protected readonly errorText = computed(() => {
    const code = this.auth.lastError();
    return code ? this.i18n.t().account.errors[code] : '';
  });

  protected go(step: Step): void {
    this.auth.dismissChallenge();
    this.localError.set('');
    this.notice.set('');
    this.confirmingDelete.set(false);
    this.step.set(step);
  }

  protected async doSignIn(): Promise<void> {
    this.localError.set('');
    this.notice.set('');
    const result = await this.auth.signIn(this.username().trim(), this.password());
    if (result === 'done') this.afterAuth();
    else if (result === 'confirmSignUp') this.step.set('confirmCode');
    else if (result === 'newPasswordRequired') {
      this.password.set('');
      this.password2.set('');
      this.step.set('newPassword');
    }
  }

  protected async doCreate(): Promise<void> {
    this.notice.set('');
    if (this.password() !== this.password2()) {
      this.localError.set(this.i18n.t().account.passwordMismatch);
      return;
    }
    this.localError.set('');
    const result = await this.auth.signUp({
      username: this.username().trim(),
      password: this.password(),
      email: this.email().trim(),
      displayName: this.displayName().trim(),
    });
    if (result === 'confirmSignUp') this.step.set('confirmCode');
    else if (result === 'done') this.afterAuth();
  }

  protected async doConfirmCode(): Promise<void> {
    const result = await this.auth.confirmCode(this.code().trim());
    if (result === 'done') this.afterAuth();
    else if (result === 'newPasswordRequired') {
      this.password.set('');
      this.password2.set('');
      this.step.set('newPassword');
    }
  }

  protected async doResend(): Promise<void> {
    if ((await this.auth.resendCode()) === 'done') {
      this.notice.set(this.i18n.t().account.resent);
    }
  }

  protected async doNewPassword(): Promise<void> {
    this.notice.set('');
    if (this.password() !== this.password2()) {
      this.localError.set(this.i18n.t().account.passwordMismatch);
      return;
    }
    this.localError.set('');
    const result = await this.auth.completeNewPassword(this.password());
    if (result === 'done') this.afterAuth();
  }

  protected async doForgot(): Promise<void> {
    this.notice.set('');
    const result = await this.auth.forgotPassword(this.username().trim());
    if (result === 'done') {
      this.code.set('');
      this.password.set('');
      this.password2.set('');
      this.step.set('forgotCode');
    }
  }

  protected async doForgotConfirm(): Promise<void> {
    if (this.password() !== this.password2()) {
      this.localError.set(this.i18n.t().account.passwordMismatch);
      return;
    }
    this.localError.set('');
    const result = await this.auth.confirmForgotPassword(this.code().trim(), this.password());
    if (result === 'done') {
      this.password.set('');
      this.password2.set('');
      this.notice.set(this.i18n.t().account.forgotDone);
      this.step.set('signIn');
    }
  }

  protected async doSignOut(): Promise<void> {
    await this.auth.signOut();
    this.password.set('');
    this.go('welcome');
  }

  protected async doDelete(): Promise<void> {
    const result = await this.auth.deleteAccount();
    if (result === 'done') {
      this.confirmingDelete.set(false);
      this.go('welcome');
    }
  }

  /** A finished sign-in returns to `volver` (internal only) or shows profile. */
  private afterAuth(): void {
    this.password.set('');
    this.password2.set('');
    this.code.set('');
    const target = this.volver();
    // '//' is protocol-relative — it would escape the origin.
    if (target && target.startsWith('/') && !target.startsWith('//')) {
      void this.router.navigateByUrl(target);
      return;
    }
    this.step.set('profile');
  }
}
