import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/auth/auth.service';
import { FamilyService } from '../../core/family.service';
import { CodeGrant, FamilyLinkView, FriendsResponse, UserProfile } from '../../core/api/contracts';
import { SheetDirective } from '../../shared/ui/sheet.directive';
import { ToastService } from '../../shared/ui/toast.service';

type Sheet =
  | { kind: 'create' }
  | { kind: 'created'; child: UserProfile; tempPassword: string }
  | { kind: 'child'; link: FamilyLinkView }
  | { kind: 'reset'; link: FamilyLinkView; tempPassword: string }
  | { kind: 'invite'; flavor: 'coGuardian' | 'linkExisting'; grant: CodeGrant }
  | { kind: 'accept' }
  | { kind: 'unlink'; link: FamilyLinkView; mineSide: boolean }
  | { kind: 'delete'; link: FamilyLinkView }
  | { kind: 'childFriends'; link: FamilyLinkView; data: FriendsResponse | null }
  | null;

/**
 * The familia section in Settings (signed-in only; the host template guards).
 * Everything demoable on the mock cloud today: create a minor (temp password
 * revealed ONCE), per-child admin sheet (rename · social toggle · new temp
 * password · export · co-guardian invite · unlink · export-first delete),
 * link-existing invites, code redemption, and the guardians view with the
 * honest visibility disclosure.
 */
@Component({
  selector: 'app-familia-card',
  imports: [SheetDirective],
  templateUrl: './familia-card.html',
  styleUrl: './familia-card.scss',
})
export class FamiliaCard {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly fam = inject(FamilyService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Into their garden — the whole tree toolkit, on their cloud forest. */
  protected enterForest(link: FamilyLinkView): void {
    this.close();
    void this.router.navigate(['/visit', link.user.userId]);
  }

  /** Oversight, never initiation — and the minor sees the very same list. */
  protected async openChildFriends(link: FamilyLinkView): Promise<void> {
    this.sheet.set({ kind: 'childFriends', link, data: null });
    const data = await this.fam.listChildFriends(link.user.userId);
    this.sheet.set({ kind: 'childFriends', link, data });
  }

  protected async removeChildFriend(link: FamilyLinkView, friendshipId: string): Promise<void> {
    if (await this.fam.removeChildFriendship(link.user.userId, friendshipId)) {
      await this.openChildFriends(link);
    }
  }

  protected async cancelChildRequest(link: FamilyLinkView, requestId: string): Promise<void> {
    if (await this.fam.cancelChildRequest(link.user.userId, requestId)) {
      await this.openChildFriends(link);
    }
  }

  protected readonly sheet = signal<Sheet>(null);

  protected readonly newUsername = signal('');
  protected readonly newDisplayName = signal('');
  protected readonly renameValue = signal('');
  protected readonly acceptCode = signal('');

  protected readonly isAdult = computed(() => this.auth.user()?.accountType === 'adult');

  protected readonly errorText = computed(() => {
    const code = this.fam.lastError();
    return code ? this.i18n.t().familia.errors[code] : '';
  });

  constructor() {
    effect(() => {
      if (this.auth.status() === 'guest') {
        this.fam.clear();
        this.sheet.set(null);
      }
    });
    if (this.auth.user()) void this.fam.open();
  }

  protected close(): void {
    this.sheet.set(null);
  }

  // ── create a minor ────────────────────────────────────────────────────────

  protected openCreate(): void {
    this.newUsername.set('');
    this.newDisplayName.set('');
    this.sheet.set({ kind: 'create' });
  }

  protected async submitCreate(): Promise<void> {
    const result = await this.fam.createChild(
      this.newUsername().trim(),
      this.newDisplayName().trim(),
    );
    if (result) this.sheet.set({ kind: 'created', ...result });
  }

  // ── per-child admin ───────────────────────────────────────────────────────

  protected openChild(link: FamilyLinkView): void {
    this.renameValue.set(link.user.displayName);
    this.sheet.set({ kind: 'child', link });
  }

  protected async doRename(link: FamilyLinkView): Promise<void> {
    const name = this.renameValue().trim();
    if (!name || name === link.user.displayName) return;
    if (await this.fam.renameChild(link.user.userId, name)) {
      this.toast.show({ message: this.i18n.t().common.done });
      this.close();
    }
  }

  protected async toggleSocial(link: FamilyLinkView): Promise<void> {
    await this.fam.setChildSocial(link.user.userId, !link.user.socialEnabled);
    // Keep the sheet open with fresh data so the switch reflects reality.
    const updated = this.fam.minors().find((l) => l.linkId === link.linkId);
    if (updated) this.sheet.set({ kind: 'child', link: updated });
  }

  protected async doReset(link: FamilyLinkView): Promise<void> {
    const result = await this.fam.resetChildPassword(link.user.userId);
    if (result) this.sheet.set({ kind: 'reset', link, tempPassword: result.tempPassword });
  }

  protected async doExport(link: FamilyLinkView): Promise<void> {
    if (await this.fam.exportChild(link.user.userId, link.user.username)) {
      this.toast.show({ message: this.i18n.t().familia.exportOk });
    }
  }

  protected async doInviteCo(link: FamilyLinkView): Promise<void> {
    const grant = await this.fam.createInvite({ kind: 'coGuardian', minorId: link.user.userId });
    if (grant) this.sheet.set({ kind: 'invite', flavor: 'coGuardian', grant });
  }

  protected confirmUnlink(link: FamilyLinkView, mineSide: boolean): void {
    this.sheet.set({ kind: 'unlink', link, mineSide });
  }

  protected async doUnlink(link: FamilyLinkView): Promise<void> {
    if (await this.fam.unlink(link.linkId)) {
      this.toast.show({ message: this.i18n.t().familia.unlinkOk });
      this.close();
    }
  }

  protected confirmDelete(link: FamilyLinkView): void {
    this.sheet.set({ kind: 'delete', link });
  }

  protected async doDelete(link: FamilyLinkView): Promise<void> {
    if (await this.fam.deleteChild(link.user.userId, link.user.username)) {
      this.toast.show({
        message: this.i18n.fill(this.i18n.t().familia.deleteOk, { name: link.user.displayName }),
      });
      this.close();
    }
  }

  // ── invites & redemption ──────────────────────────────────────────────────

  protected async doInviteExisting(): Promise<void> {
    const grant = await this.fam.createInvite({ kind: 'linkExisting' });
    if (grant) this.sheet.set({ kind: 'invite', flavor: 'linkExisting', grant });
  }

  protected openAccept(): void {
    this.acceptCode.set('');
    this.sheet.set({ kind: 'accept' });
  }

  protected async submitAccept(): Promise<void> {
    if (await this.fam.acceptInvite(this.acceptCode().trim())) {
      this.toast.show({ message: this.i18n.t().familia.acceptOk });
      this.close();
    }
  }

  protected prettyCode(code: string): string {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  protected expiryDate(grant: CodeGrant): string {
    const locale = this.i18n.lang() === 'en' ? 'en' : 'es';
    return new Date(grant.expiresAt).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
    });
  }
}
