import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { SettingsService } from '../../core/repos/settings.service';
import { ThemeService } from '../../core/theme/theme.service';
import { TreesRepo } from '../../core/repos/trees.repo';
import { NodesRepo } from '../../core/repos/nodes.repo';
import { BackupService } from '../../core/repos/backup.service';
import { ToastService } from '../../shared/ui/toast.service';
import { Lang, MotionPref, TextSize, ThemeName, Tree } from '../../core/db/schema';

@Component({
  selector: 'app-settings',
  imports: [RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsService);
  protected readonly theme = inject(ThemeService);
  protected readonly trees = inject(TreesRepo);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);

  protected readonly importing = signal(false);
  /** Tree pending permanent deletion (confirm sheet open). */
  protected readonly deleting = signal<Tree | null>(null);
  private readonly nodes = inject(NodesRepo);

  protected setTheme(theme: ThemeName): void {
    void this.theme.setTheme(theme);
  }

  protected setLang(lang: Lang): void {
    void this.i18n.set(lang);
  }

  protected setMotion(pref: MotionPref): void {
    void this.settings.patch({ reduceMotion: pref });
  }

  protected setTextSize(size: TextSize): void {
    void this.theme.setTextSize(size);
  }

  protected toggleDyslexia(): void {
    void this.settings.patch({ dyslexiaFont: !this.settings.settings().dyslexiaFont });
  }

  protected setTimerDefault(value: number): void {
    if (value >= 1 && value <= 180) void this.settings.patch({ timerDefaultMinutes: value });
  }

  protected exportData(): void {
    void this.backup.download();
  }

  protected branchCountOf(tree: Tree): number {
    return this.nodes.all().filter((n) => n.treeId === tree.id).length;
  }

  /** The ONLY irreversible action in the app — backup first, always. */
  protected async deleteForever(): Promise<void> {
    const tree = this.deleting();
    if (!tree) return;
    await this.backup.download('rodemap2u-pre-delete');
    const treeNodes = this.nodes.all().filter((n) => n.treeId === tree.id);
    await this.nodes.tombstoneMany(treeNodes);
    await this.trees.tombstone(tree);
    this.deleting.set(null);
    this.toast.show({
      message: this.i18n.fill(this.i18n.t().settings.deletedToast, { name: tree.name }),
    });
  }

  protected async onImportFile(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.importing.set(true);
    try {
      await this.backup.importReplace(await file.text());
      this.toast.show({ message: this.i18n.t().settings.importOk });
    } catch {
      this.toast.show({ message: this.i18n.t().settings.importError });
    } finally {
      this.importing.set(false);
    }
  }
}
