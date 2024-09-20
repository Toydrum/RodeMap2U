import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CoreService } from '../../../services/core.service';
import { AsyncPipe } from '@angular/common';
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule,GenericButtonComponent ,AsyncPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {

  currentList$ = this.coreService.setList();
  constructor(private coreService: CoreService) {

  }


}
