import { Directive, ElementRef, OnDestroy, OnInit, afterNextRender, inject, output } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), ' +
  'select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behavior for every hand-rolled sheet: initial focus,
 * Escape-to-close (topmost sheet only), a minimal Tab trap, and focus
 * restoration to the opener. Purely behavioral — each sheet keeps its
 * own markup and styles.
 */
@Directive({
  selector: '[appSheet]',
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
    '(keydown)': 'onTab($event)',
  },
})
export class SheetDirective implements OnInit, OnDestroy {
  readonly sheetClose = output<void>();

  /** Stacked sheets (node sheet → branch flow): only the top one obeys Escape. */
  private static stack: SheetDirective[] = [];

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private prevFocus: Element | null = null;

  constructor() {
    afterNextRender(() => {
      this.captureOpener();
      const host = this.el.nativeElement;
      if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
      (host.querySelector<HTMLElement>('[autofocus]') ?? host).focus();
    });
  }

  /** Remember whoever REALLY had focus (never body) — keyboard openers
   *  capture at init; late programmatic focus is caught post-render. */
  private captureOpener(): void {
    const active = document.activeElement;
    if (active && active !== document.body) this.prevFocus = active;
  }

  ngOnInit(): void {
    this.captureOpener();
    SheetDirective.stack.push(this);
  }

  protected onEscape(ev: Event): void {
    if (SheetDirective.stack.at(-1) !== this) return;
    ev.preventDefault();
    this.sheetClose.emit();
  }

  protected onTab(ev: KeyboardEvent): void {
    if (ev.key !== 'Tab') return;
    const items = [...this.el.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) {
      ev.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey && (active === first || active === this.el.nativeElement)) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  ngOnDestroy(): void {
    SheetDirective.stack = SheetDirective.stack.filter((s) => s !== this);
    // Element, not HTMLElement: tree nodes are focusable SVG <g> elements.
    if (this.prevFocus instanceof Element && this.prevFocus.isConnected) {
      (this.prevFocus as HTMLElement).focus?.();
    }
  }
}
