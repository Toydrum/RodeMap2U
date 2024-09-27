import { Injectable, signal, WritableSignal } from '@angular/core';
import { TRoadMap } from '../types/roadMap.type';

@Injectable({
  providedIn: 'root'
})
export class RoadmapService {

  roadMaps: WritableSignal<TRoadMap[]> = signal([
    {title: 'Road map 1', owner: 'Héctor', goals: []},
    {title: 'Road map 2', owner: 'Kenny', goals: []},
    {title: 'Road map 3', owner: 'Comino', goals: []},
  ])
  constructor() { }
}
