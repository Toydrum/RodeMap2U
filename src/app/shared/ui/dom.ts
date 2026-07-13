/**
 * Typed replacements for the `$any($event.target).value` template idiom
 * (B8, 0.0.77). Components expose them as protected readonly fields so
 * templates stay type-checked: `(input)="name.set(inputValue($event))"`.
 */
export function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}

export function inputEl(event: Event): HTMLInputElement | HTMLTextAreaElement {
  return event.target as HTMLInputElement | HTMLTextAreaElement;
}
