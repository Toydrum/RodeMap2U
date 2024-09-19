import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-generic-button',
  standalone: true,
  imports: [],
  templateUrl: './generic-button.component.html',
  styleUrl: './generic-button.component.scss',
})
export class GenericButtonComponent {
  @Input() buttonContainerClass = '';
  @Input() buttonClass = '';
  @Input() label = '';
  @Input() labelClass = '';
  @Input() hasLabel = true;
  constructor() {}
}
