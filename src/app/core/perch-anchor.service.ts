import { Injectable, signal } from '@angular/core';

/**
 * Where the companion parakeet is perched RIGHT NOW. Scene surfaces (the
 * tree canvas when the session's branch is on screen; the meadow when the
 * session's tree stands in the visible clearing) CLAIM the perch and render
 * the bird inside their scenery; the app shell's corner perch yields while
 * a claim is held. Exactly one `.session-perch` exists at any moment —
 * verify-perch counts on it.
 */
@Injectable({ providedIn: 'root' })
export class PerchAnchorService {
  private readonly owner = signal<null | 'tree' | 'forest'>(null);
  readonly claimed = this.owner.asReadonly();

  claim(who: 'tree' | 'forest'): void {
    this.owner.set(who);
  }

  /** Only the current owner may release — a late destroy from a previous
   *  surface must not knock down a fresh claim. */
  release(who: 'tree' | 'forest'): void {
    if (this.owner() === who) this.owner.set(null);
  }
}
