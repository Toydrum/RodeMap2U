import { AsyncPipe, CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';

/* Modules */
import { CoreService } from '../../../services/core.service';
/* Components */
import { GenericButtonComponent } from '../../../../shared/components/generic-button/generic-button.component';
import { RouterModule } from '@angular/router';
import { TDeckButton } from '../../../types/deckButton.type';
import { TConfig } from '../../../types/config.type';
import { TMenuOptions } from '../../../types/menuOptions.type';
import { config } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, GenericButtonComponent, RouterModule, AsyncPipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  labelClass =
    'bef bef-d-flex bef-w-100per bef-fontWeight-700 jusCon-center aliIte-center';
  buttonClass =
    'bef bef-bg-red bef-w-60per bef-h-100per bef-bc-black bef-r-20px';
  containerClass =
    'bef bef-h-100per bef-d-flex fleDir-column aliIte-center jusCon-center';
  buttonContainerClass =
    'bef bef-w-100per bef-h-100per bef-d-flex jusCon-center aliIte-center';
  buttons: Signal<TDeckButton[]>;

  constructor(private _coreService: CoreService) {

    this.buttons = computed(() => this._coreService.config$().deckButtons);
  }

optionSelected(id: string) {
  this._coreService.optionSelected(id);

}


}
