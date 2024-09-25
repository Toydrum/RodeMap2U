import { CommonModule } from '@angular/common';
import { AfterViewInit, Component} from '@angular/core';

/* Modules */
import { CoreService } from '../../../services/core.service';
/* Components */
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';
import { RouterModule } from '@angular/router';



@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, GenericButtonComponent, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements AfterViewInit{
  labelClass = 'bef bef-d-flex bef-w-100per bef-fontWeight-700 jusCon-center aliIte-center';
  buttonClass = 'bef bef-bg-red bef-w-60per bef-h-100per bef-bc-black bef-r-20px';
  containerClass = 'bef bef-h-100per bef-d-flex fleDir-column aliIte-center jusCon-center';
  buttonContainerClass = 'bef bef-w-100per bef-h-100per bef-d-flex jusCon-center aliIte-center';


  buttons: {label: string, hasLabel: boolean, route: string, id: string}[] = [
    {
      label: 'Add',
      hasLabel: true,
      route: '/roadmap/all',
      id: 'add',
    },
    {
      label: 'Edit',
      hasLabel: true,
      route: '/roadmap/all',
      id: 'edit',
    },
    {
      label: 'Remove',
      hasLabel: true,
      route: '/roadmap/all',
      id: 'remove',
    },
    {
      label: 'About',
      hasLabel: true,
      route: '/roadmap/all',
      id: 'about',
    },
  ];

  constructor(private _coreService: CoreService) {

  }

  ngAfterViewInit() {
    this._coreService.getModifiedSelection().subscribe(modifiedValue => {
      console.log(modifiedValue);
    });
  }

  buttonClick(event: string) {
    const target = event

    this._coreService.updateSelection(target);
  }


}
