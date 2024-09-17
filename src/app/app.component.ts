import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
/* Components */
import { HeaderComponent } from "./core/components/layout/header/header.component";
import { FooterComponent } from "./core/components/layout/footer/footer.component";
import { NavbarComponent } from "./core/components/layout/navbar/navbar.component";
/* Material */
import { MatSidenavModule } from "@angular/material/sidenav";
/* Services */
import { NgxBootstrapExpandedFeaturesService } from "ngx-bootstrap-expanded-features";

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
  providers: [NgxBootstrapExpandedFeaturesService],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  public events: string[] = [];
  public opened: boolean = false;

  public colors: { [key: string]: string } = {
    black: "#303336",
    green: "#157F1F",
    honey: "#cbd4c2",
    lave: "#A3320B"
  };
  public abreviationsValues: { [key: string]: string } = {
    fleStart: 'flex-start',
    fleEnd: 'flex-end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
  };
  public abreviationsClasses: { [key: string]: string } = {
    fleDir: 'bef-flexDirection',
    jusCon: 'bef-justifyContent',
    jusSel: 'bef-justifySelf',
    aliIte: 'bef-alignItems',
    aliSel: 'bef-alignSelf',
    fonWei: 'bef-fontWeight',
    texAli: 'bef-textAlign',
    wrap: 'bef-flexWrap',
    worBre: 'bef-wordBreak',
    textTra: 'bef-textTransform',
    shrink: 'bef-flexShrink',
    objFit: 'bef-objectFit',
  };

  constructor(private readonly _bef: NgxBootstrapExpandedFeaturesService) {
    this._bef.pushColors(this.colors);
    this._bef.pushAbreviationsClasses(this.abreviationsClasses);
    this._bef.pushAbreviationsValues(this.abreviationsValues);
    this.cssCreate();
  }

  cssCreate() {
    this._bef.cssCreate();
  }

  openNavBar() {
    this.opened = !this.opened;
  }

}
