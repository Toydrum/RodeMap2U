import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CanvaRoadMapComponent } from './canva-road-map.component';

describe('CanvaRoadMapComponent', () => {
  let component: CanvaRoadMapComponent;
  let fixture: ComponentFixture<CanvaRoadMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvaRoadMapComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CanvaRoadMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
