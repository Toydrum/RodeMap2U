import { Component, computed, effect, inject, signal } from '@angular/core';
import { inputValue } from '../../shared/ui/dom';
import { ConfirmSheet } from '../../shared/ui/confirm-sheet';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';
import { FamilyService } from '../../core/family.service';
import { API_CLIENT } from '../../core/api/api-client';
import {
  ApiError,
  ApiErrorCode,
  CodeGrant,
  FriendView,
  FriendsResponse,
} from '../../core/api/contracts';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * The friendships section in Settings — social-enabled accounts only (adults
 * always; minors when their guardian turned it on). No search, no discovery:
 * the shareable code is the ONLY introduction, every request needs an
 * explicit accept, and declines are silent (no-shame doctrine). A friend's
 * garden opens through the same /visit route family uses — read-only there.
 */
@Component({
  selector: 'app-amigos-card',
  imports: [SheetDirective, ConfirmSheet],
  templateUrl: './amigos-card.html',
  styleUrl: './amigos-card.scss',
})
export class AmigosCard {
  protected readonly inputValue = inputValue;
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  private readonly fam = inject(FamilyService);
  private readonly api = inject(API_CLIENT);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly friends = signal<FriendsResponse | null>(null);
  protected readonly myCode = signal<CodeGrant | null>(null);
  protected readonly loading = signal(false);
  protected readonly lastError = signal<ApiErrorCode | null>(null);
  protected readonly redeemCode = signal('');
  protected readonly removing = signal<FriendView | null>(null);

  /** Adults are always social; minors follow their guardian's toggle (/me). */
  protected readonly socialOn = computed(() => {
    const user = this.auth.user();
    if (!user) return false;
    if (user.accountType === 'adult') return true;
    return this.fam.me()?.profile.socialEnabled ?? false;
  });

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user || !this.socialOn()) {
        this.loadedFor = null;
        return;
      }
      if (this.loadedFor === user.userId) return;
      this.loadedFor = user.userId;
      void this.load();
    });
  }

  protected readonly errorText = computed(() => {
    const code = this.lastError();
    return code ? this.i18n.t().familia.errors[code] : '';
  });

  protected async load(): Promise<void> {
    await this.run(async () => {
      const [friends, code] = await Promise.all([this.api.getFriends(), this.api.getFriendCode()]);
      this.friends.set(friends);
      this.myCode.set(code);
    });
  }

  protected async doRotate(): Promise<void> {
    await this.run(async () => {
      this.myCode.set(await this.api.rotateFriendCode());
      this.toast.show({ message: this.i18n.t().amigos.rotateOk });
    });
  }

  protected async doRedeem(): Promise<void> {
    const code = this.redeemCode().trim();
    if (!code) return;
    await this.run(async () => {
      await this.api.createFriendRequest(code);
      this.redeemCode.set('');
      this.toast.show({ message: this.i18n.t().amigos.requestSent });
      this.friends.set(await this.api.getFriends());
    });
  }

  protected async doAccept(requestId: string): Promise<void> {
    await this.run(async () => {
      await this.api.acceptFriendRequest(requestId);
      this.toast.show({ message: this.i18n.t().amigos.acceptOk });
      this.friends.set(await this.api.getFriends());
    });
  }

  protected async doDecline(requestId: string): Promise<void> {
    await this.run(async () => {
      await this.api.declineFriendRequest(requestId);
      this.friends.set(await this.api.getFriends());
    });
  }

  protected async doCancel(requestId: string): Promise<void> {
    await this.run(async () => {
      await this.api.cancelFriendRequest(requestId);
      this.friends.set(await this.api.getFriends());
    });
  }

  protected async doRemove(friend: FriendView): Promise<void> {
    await this.run(async () => {
      await this.api.removeFriend(friend.friendshipId);
      this.removing.set(null);
      this.toast.show({ message: this.i18n.t().amigos.removeOk });
      this.friends.set(await this.api.getFriends());
    });
  }

  protected visit(friend: FriendView): void {
    void this.router.navigate(['/visit', friend.user.userId]);
  }

  protected prettyCode(code: string): string {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    // Synchronous re-entry guard: under zoneless, [disabled] repaints one
    // render late — a double-click lands here twice before the first await.
    if (this.loading()) return;
    this.loading.set(true);
    this.lastError.set(null);
    try {
      await operation();
    } catch (error) {
      this.lastError.set(error instanceof ApiError ? error.code : 'unknown');
    } finally {
      this.loading.set(false);
    }
  }
}
