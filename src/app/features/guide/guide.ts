import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';

/** In-app guide: a short, calm walk through the whole app. */
@Component({
  selector: 'app-guide',
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class GuidePage {
  protected readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected goBack(): void {
    if (history.length > 1) {
      this.location.back();
    } else {
      void this.router.navigate(['/forest']);
    }
  }
}
