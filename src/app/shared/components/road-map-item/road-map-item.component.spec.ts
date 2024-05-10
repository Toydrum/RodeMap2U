import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoadMapItemComponent } from './road-map-item.component';

describe('RoadMapItemComponent', () => {
  let component: RoadMapItemComponent;
  let fixture: ComponentFixture<RoadMapItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoadMapItemComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RoadMapItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
