import { AsyncPipe, CommonModule } from '@angular/common';
import { CoreService } from '../../../services/core.service';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  OnChanges,
  OnDestroy,
  OnInit,
  Signal,
  SimpleChange,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';
import { Observable } from 'rxjs';
import { TConfig } from '../../../types/config.type';
import { TMenuOptions } from '../../../types/menuOptions.type';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, GenericButtonComponent, AsyncPipe, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  menuOptions: Signal<TMenuOptions[]>;
  isVisible: Signal<boolean>;
  constructor(private _coreService: CoreService) {
    this.menuOptions = computed(() => this._coreService.config$().menuOptions);
    this.isVisible = computed(() => {
      return this._coreService.config$().menuOptions.some(option => option.label !== '');
    });
  }

  toggleMenuOption() {}
}
