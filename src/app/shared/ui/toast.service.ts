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

/**
 * One toast at a time, but never at the cost of a promise: a toast that
 * carries an ACTION (an undo) is protected — newcomers wait in a small
 * queue instead of destroying it. The sticky update offer steps aside for
 * newcomers and re-surfaces when the air clears (it used to be silently
 * replaced and never re-fired). Plain informational toasts replace each
 * other immediately, as always.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Array<{ toast: Toast; durationMs: number }> = [];

  show(toast: Toast, durationMs = 5000): void {
    const cur = this.current();
    if (cur?.sticky && !toast.sticky) {
      // The sticky offer yields but never dies — front of the line.
      this.queue.unshift({ toast: cur, durationMs: 0 });
      this.display(toast, durationMs);
      return;
    }
    if (cur?.actionLabel && !cur.sticky) {
      // An undo in flight: the newcomer waits its turn.
      if (this.queue.length >= 4) {
        const drop = this.queue.findIndex((q) => !q.toast.actionLabel && !q.toast.sticky);
        this.queue.splice(drop === -1 ? 0 : drop, 1);
      }
      this.queue.push({ toast, durationMs });
      return;
    }
    this.display(toast, durationMs);
  }

  dismiss(): void {
    this.next();
  }

  private display(toast: Toast, durationMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.current.set(toast);
    if (!toast.sticky) {
      this.timer = setTimeout(() => this.next(), durationMs);
    }
  }

  private next(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const upcoming = this.queue.shift();
    if (upcoming) {
      this.display(upcoming.toast, upcoming.durationMs || 5000);
    } else {
      this.current.set(null);
    }
  }
}
