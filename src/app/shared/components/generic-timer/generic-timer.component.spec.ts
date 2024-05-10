import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericTimerComponent } from './generic-timer.component';

describe('GenericTimerComponent', () => {
  let component: GenericTimerComponent;
  let fixture: ComponentFixture<GenericTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericTimerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GenericTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
