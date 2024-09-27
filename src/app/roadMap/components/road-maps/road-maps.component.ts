import { Component, computed, OnInit, Signal } from '@angular/core';
import { RoadMapComponent } from '../road-map/road-map.component';
import { RoadmapService } from '../../services/roadmap.service';
import { TRoadMap } from '../../types/roadMap.type';
import { NgxBootstrapExpandedFeaturesService } from 'ngx-bootstrap-expanded-features';
import { ExistsDirective } from '../../../shared/directives/exists.directive';


@Component({
  selector: 'app-road-maps',
  standalone: true,
  imports: [RoadMapComponent, ExistsDirective],
  templateUrl: './road-maps.component.html',
  styleUrl: './road-maps.component.scss'
})
export class RoadMapsComponent implements OnInit {
  roadMaps: Signal<TRoadMap[]>;

  constructor(private _roadmapService: RoadmapService, private _bef: NgxBootstrapExpandedFeaturesService) {

    this.roadMaps = computed(()=>{return this._roadmapService.roadMaps()});
  }

  ngOnInit(): void {
    this.cssCreate();
  }

  cssCreate(){
    this._bef.cssCreate();
  }
}
