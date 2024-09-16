import { Routes } from "@angular/router";
/* Components */
import { RoadMapsComponent } from "./components/road-maps/road-maps.component";
import { RoadMapComponent } from "./components/road-map/road-map.component";

export const RoadMapRoutes: Routes = [
  {
    path: "all",
    component: RoadMapsComponent,
  },
  {
    path: ":id",
    component: RoadMapComponent,
  },
  {
    path: "new",
    component: RoadMapComponent,
  }
];
