import { Component, computed, effect, inject, signal } from '@angular/core';
import { inputValue } from '../../shared/ui/dom';
import { Switch } from '../../shared/ui/switch';
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
  imports: [SheetDirective, Switch],
  templateUrl: './familia-card.html',
  styleUrl: './familia-card.scss',
})
export class FamiliaCard {
  protected readonly inputValue = inputValue;
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
    const epoch = this.openSheet({ kind: 'childFriends', link, data: null });
    const data = await this.fam.listChildFriends(link.user.userId);
    this.setSheetLater(epoch, { kind: 'childFriends', link, data });
  }

  protected async removeChildFriend(link: FamilyLinkView, friendshipId: string): Promise<void> {
    const epoch = this.sheetEpoch;
    if ((await this.fam.removeChildFriendship(link.user.userId, friendshipId)) && this.sheetEpoch === epoch) {
      await this.openChildFriends(link);
    }
  }

  protected async cancelChildRequest(link: FamilyLinkView, requestId: string): Promise<void> {
    const epoch = this.sheetEpoch;
    if ((await this.fam.cancelChildRequest(link.user.userId, requestId)) && this.sheetEpoch === epoch) {
      await this.openChildFriends(link);
    }
  }

  protected readonly sheet = signal<Sheet>(null);

  /** Bumped on every explicit open/close. Async completions may only touch
   *  the sheet if nothing was dismissed or replaced while they were in
   *  flight — a late reveal would re-expose a temp password or invite code
   *  the user already put away (zombie-sheet guard, audit #7). */
  private sheetEpoch = 0;

  private openSheet(sheet: Sheet): number {
    this.sheetEpoch++;
    this.sheet.set(sheet);
    return this.sheetEpoch;
  }

  private setSheetLater(epoch: number, sheet: Sheet): void {
    if (this.sheetEpoch === epoch) this.sheet.set(sheet);
  }

  protected readonly newUsername = signal('');
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
        this.close();
      }
    });
    if (this.auth.user()) void this.fam.open();
  }

  protected close(): void {
    this.sheetEpoch++;
    this.sheet.set(null);
  }

  // ── create a minor ────────────────────────────────────────────────────────

  protected openCreate(): void {
    this.newUsername.set('');
    this.openSheet({ kind: 'create' });
  }

  protected async submitCreate(): Promise<void> {
    const epoch = this.sheetEpoch;
    // ONE field since 0.0.108: the username (the key the child will type) is
    // also the display name at birth — the guardian renames any time.
    const u = this.newUsername().trim();
    const result = await this.fam.createChild(u, u);
    if (result) this.setSheetLater(epoch, { kind: 'created', ...result });
  }

  // ── per-child admin ───────────────────────────────────────────────────────

  protected openChild(link: FamilyLinkView): void {
    this.renameValue.set(link.user.displayName);
    this.openSheet({ kind: 'child', link });
  }

  protected async doRename(link: FamilyLinkView): Promise<void> {
    const name = this.renameValue().trim();
    if (!name || name === link.user.displayName) return;
    const epoch = this.sheetEpoch;
    if (await this.fam.renameChild(link.user.userId, name)) {
      this.toast.show({ message: this.i18n.t().common.done });
      if (this.sheetEpoch === epoch) this.close();
    }
  }

  protected async toggleSocial(link: FamilyLinkView): Promise<void> {
    const epoch = this.sheetEpoch;
    // Paint from the SERVER's answer (audit #10): a failed refresh must not
    // show — and on the next tap re-flip — the stale pre-toggle value.
    const profile = await this.fam.setChildSocial(link.user.userId, !link.user.socialEnabled);
    if (!profile) return;
    const updated: FamilyLinkView = {
      ...link,
      user: { ...link.user, socialEnabled: profile.socialEnabled },
    };
    this.setSheetLater(epoch, { kind: 'child', link: updated });
  }

  protected async doReset(link: FamilyLinkView): Promise<void> {
    const epoch = this.sheetEpoch;
    const result = await this.fam.resetChildPassword(link.user.userId);
    if (result) this.setSheetLater(epoch, { kind: 'reset', link, tempPassword: result.tempPassword });
  }

  protected async doExport(link: FamilyLinkView): Promise<void> {
    if (await this.fam.exportChild(link.user.userId, link.user.username)) {
      this.toast.show({ message: this.i18n.t().familia.exportOk });
    }
  }

  protected async doInviteCo(link: FamilyLinkView): Promise<void> {
    const epoch = this.sheetEpoch;
    const grant = await this.fam.createInvite({ kind: 'coGuardian', minorId: link.user.userId });
    if (grant) this.setSheetLater(epoch, { kind: 'invite', flavor: 'coGuardian', grant });
  }

  protected confirmUnlink(link: FamilyLinkView, mineSide: boolean): void {
    this.openSheet({ kind: 'unlink', link, mineSide });
  }

  protected async doUnlink(link: FamilyLinkView): Promise<void> {
    const epoch = this.sheetEpoch;
    if (await this.fam.unlink(link.linkId)) {
      this.toast.show({ message: this.i18n.t().familia.unlinkOk });
      if (this.sheetEpoch === epoch) this.close();
    }
  }

  protected confirmDelete(link: FamilyLinkView): void {
    this.openSheet({ kind: 'delete', link });
  }

  protected async doDelete(link: FamilyLinkView): Promise<void> {
    const epoch = this.sheetEpoch;
    if (await this.fam.deleteChild(link.user.userId, link.user.username)) {
      this.toast.show({
        message: this.i18n.fill(this.i18n.t().familia.deleteOk, { name: link.user.displayName }),
      });
      if (this.sheetEpoch === epoch) this.close();
    }
  }

  // ── invites & redemption ──────────────────────────────────────────────────

  protected async doInviteExisting(): Promise<void> {
    const epoch = this.sheetEpoch;
    const grant = await this.fam.createInvite({ kind: 'linkExisting' });
    if (grant) this.setSheetLater(epoch, { kind: 'invite', flavor: 'linkExisting', grant });
  }

  protected openAccept(): void {
    this.acceptCode.set('');
    this.openSheet({ kind: 'accept' });
  }

  protected async submitAccept(): Promise<void> {
    const epoch = this.sheetEpoch;
    if (await this.fam.acceptInvite(this.acceptCode().trim())) {
      this.toast.show({ message: this.i18n.t().familia.acceptOk });
      if (this.sheetEpoch === epoch) this.close();
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
