import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
/* Components */
import { HeaderComponent } from "./core/components/layout/header/header.component";
import { FooterComponent } from "./core/components/layout/footer/footer.component";
import { NavbarComponent } from "./core/components/layout/navbar/navbar.component";
/* Material */
import { MatSidenavModule } from "@angular/material/sidenav";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    NavbarComponent,
    MatSidenavModule,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  public opened: boolean = false;
}
