import { AsyncPipe, CommonModule } from '@angular/common';
import { CoreService } from '../../../services/core.service';
import { AfterViewInit, Component, OnChanges, OnDestroy, OnInit, SimpleChange } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';
import { Observable } from 'rxjs';



@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, GenericButtonComponent, AsyncPipe, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  isVisible: boolean = false;
  optionSelected: string = '';
  menus: {label: string}[] = []

  constructor(private _coreService: CoreService) {
    this._coreService.selection$.subscribe({
      next: (value) => {
        this.optionSelected = value;
        this.displayMenu();

    }});
  }



  displayMenu(){
    switch (this.optionSelected) {
      case 'add':
        this.menus= [
          {label: 'New map'},
          {label: 'New action'},
        ]

        break;
      case 'edit':
        this.menus= [
          {label: 'Edit map'},
          {label: 'Edit action'},
        ]

        break;
      case 'remove':
        this.menus= [
          {label: 'Remove map'},
          {label: 'Remove action'},
        ]

        break;
      case 'about':
        this.menus= [
          {label: 'About'},
        ]

        break;
    }

  }

  toggleOptions() {
    this.isVisible = !this.isVisible;


  }




}

