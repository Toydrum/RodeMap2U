import { CommonModule } from '@angular/common';
import { Component, TemplateRef, ViewChild } from '@angular/core';
/* Modules */
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [BsDropdownModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  public buttonClasses = 'bef bef-r-70px bef-bg-lave bef-p-7px bef-w-90px';
  public dropButtonClasses = 'bef bef-bg-lave bef-r-10px ';

  @ViewChild('currentTemplate') currentTemplate!: TemplateRef<any>;
  @ViewChild('futureTemplate') futureTemplate!: TemplateRef<any>;
  @ViewChild('completedTemplate') completedTemplate!: TemplateRef<any>;
  @ViewChild('clockTemplate') clockTemplate!: TemplateRef<any>;
  @ViewChild('pausedTemplate') pausedTemplate!: TemplateRef<any>;

  public currentTemplateRef: TemplateRef<any> | null = null;

 renderOptions(option: string) {
    switch (option) {
      case 'current':
        this.currentTemplateRef = this.currentTemplate;
        break;
      case 'future':
        this.currentTemplateRef = this.futureTemplate;
        break;
      case 'completed':
        this.currentTemplateRef = this.completedTemplate;
        break;
      case 'clock':
        this.currentTemplateRef = this.clockTemplate;
        break;
      case 'paused':
        this.currentTemplateRef = this.pausedTemplate;
        break;
      default:
        this.currentTemplateRef = null;
    }
  }
}
