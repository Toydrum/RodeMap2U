import { computed, Injectable, signal, WritableSignal } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { TConfig } from '../types/config.type';
import { config } from '../data/config.data';
import { TDeckButton } from '../types/deckButton.type';
import { TMenuOptions } from '../types/menuOptions.type';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  public config$: WritableSignal<TConfig> = signal<TConfig>(config);

  constructor() {}

  optionSelected(id: string) {

   switch(id){
    case 'add':
      this.config$.set({...this.config$(), menuOptions:[
        {
          label: 'New map',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
        {
          label: 'New goal',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
      ]})
      break;
    case 'edit':
      this.config$.set({...this.config$(), menuOptions:[
        {
          label: 'Edit map',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
        {
          label: 'Edit goal',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
        {
          label: 'Edit task',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
      ]
    })
      break;
    case 'remove':
      this.config$.set({...this.config$(), menuOptions:[
        {
          label: 'Remove map',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
        {
          label: 'Remove goal',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
        {
          label: 'Remove task',
          path: '/roadmap/all',
          light: false,
          isActive: false,
          get isUnactive() {
            return !this.isActive;
          },
        },
      ]
    })
      break;

  }
}
  /* if (button) {
        button.isActive = !button.isActive;
        switch (id) {
          case 'add':
            configData.menuOptions = [
              {
                label: 'New map',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
              {
                label: 'New goal',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
            ];
            break;
          case 'edit':
            configData.menuOptions = [
              {
                label: 'Edit map',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
              {
                label: 'Edit goal',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
              {
                label: 'Edit task',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
            ];
            break;
          case 'remove':
            configData.menuOptions = [
              {
                label: 'Remove map',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
              {
                label: 'Remove goal',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
              {
                label: 'Remove task',
                path: '/roadmap/all',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              },
            ];
            break;
          case 'about':
            configData.menuOptions = [
              {
                label: 'About',
                path: '/about',
                light: false,
                isActive: false,
                get isUnactive() {
                  return !this.isActive;
                },
              }
            ];
            break;
            default:{
              configData.menuOptions
            }
            break;

        }

    } */
}
