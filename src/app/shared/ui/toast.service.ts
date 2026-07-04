import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  actionLabel?: string;
  action?: () => void;
  /** Never auto-expires (the SW update offer). Everything else breathes out. */
  sticky?: boolean;
}

/** Undo offers stay long enough to not race anyone; then the commit stands. */
export const UNDO_MS = 8000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(toast: Toast, durationMs = 5000): void {
    this.current.set(toast);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!toast.sticky) {
      this.timer = setTimeout(() => this.current.set(null), durationMs);
    }
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set(null);
  }
}
