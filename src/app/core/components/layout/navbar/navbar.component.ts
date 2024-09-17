import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  public optionTitles: { title: string, path: string }[] = [
    { title: 'Home', path: '/home' },
    { title: 'About', path: '/about' },
  ];
}
