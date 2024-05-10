import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericListContainerComponent } from './generic-list-container.component';

describe('GenericListContainerComponent', () => {
  let component: GenericListContainerComponent;
  let fixture: ComponentFixture<GenericListContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericListContainerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GenericListContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
