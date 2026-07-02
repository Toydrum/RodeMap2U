import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  actionLabel?: string;
  action?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(toast: Toast, durationMs = 5000): void {
    this.current.set(toast);
    if (this.timer) clearTimeout(this.timer);
    // Toasts with an action stay until dismissed — no racing the user.
    if (!toast.action) {
      this.timer = setTimeout(() => this.current.set(null), durationMs);
    }
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.current.set(null);
  }
}
