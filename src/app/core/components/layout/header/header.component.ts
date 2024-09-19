import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
/* Modules */
import { CoreService } from '../../../services/core.service';
/* Components */
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';
import { from, fromEvent, map } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [BsDropdownModule, CommonModule, GenericButtonComponent],
  providers: [CoreService],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements AfterViewInit {
  labelClass = 'bef bef-d-flex bef-w-100per bef-fontWeight-700 jusCon-center aliIte-center';
  buttonClass = 'bef bef-bg-red bef-w-60per bef-h-100per bef-bc-black bef-r-20px';
  containerClass = 'bef bef-h-100per bef-d-flex fleDir-column aliIte-center jusCon-center';
  buttonContainerClass = 'bef bef-w-100per bef-h-100per bef-d-flex jusCon-center aliIte-center';

  @ViewChildren('actionButton', {read: ElementRef}) actionButtons!: QueryList<ElementRef>;

  buttons: {label: string, hasLabel: boolean, id: string}[] = [
    {
      label: 'Add',
      hasLabel: true,
      id: 'add',
    },
    {
      label: 'Edit',
      hasLabel: true,
      id: 'edit',
    },
    {
      label: 'Remove',
      hasLabel: true,
      id: 'remove',
    },
    {
      label: 'About',
      hasLabel: true,
      id: 'about',
    },
  ];


  constructor(private coreService: CoreService) {

  }

  ngAfterViewInit(): void {
    this.actionButtons.forEach(button => {
      fromEvent(button.nativeElement, 'click')
        .pipe(map(() => button.nativeElement.getAttribute('data-id')))
        .subscribe(id => this.coreService.setOptionSelected(id));
    });
  }


}
