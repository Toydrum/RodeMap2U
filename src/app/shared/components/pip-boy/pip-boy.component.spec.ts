import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PipBoyComponent } from './pip-boy.component';

describe('PipBoyComponent', () => {
  let component: PipBoyComponent;
  let fixture: ComponentFixture<PipBoyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PipBoyComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PipBoyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
