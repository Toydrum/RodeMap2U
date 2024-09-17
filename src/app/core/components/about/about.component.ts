import { Component,signal, } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [MatExpansionModule],

  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly panelOpenState = signal(false);


}
