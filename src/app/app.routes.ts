import { Routes } from "@angular/router";
/* Components */
import { HomeComponent } from "./core/components/home/home.component";
import { ErrorComponent } from "./core/components/error/error.component";

export const routes: Routes = [
  {
    path: "",
    component: HomeComponent,
  },
  {
    path: "home",
    component: HomeComponent,
  },
  {
    path: 'roadmap',
    loadChildren: () => import ('./roadMap/roadMap.routes').then((x)=>x.RoadMapRoutes)
  },
  {
    path: "**",
    component: ErrorComponent,
  },
];
