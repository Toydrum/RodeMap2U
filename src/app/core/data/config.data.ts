import { TConfig } from '../types/config.type';

export const config: TConfig = {

  deckButtons: [
    {
      label: 'Maps',
      light: false,
      isActive: false,
      get isUnactive(){
        return !this.isActive;
      },
      hasLabel: true,
      route: '/roadmap/all',
      id: 'maps',
    },
    {
      label: 'Add',
      light: false,
      isActive: false,
      get isUnactive(){
        return !this.isActive;
      },
      hasLabel: true,
      route: '/roadmap/all',
      id: 'add',
    },
    {
      label: 'Edit',
      light: false,
      isActive: false,
      get isUnactive(){
        return !this.isActive;
      },
      hasLabel: true,
      route: '/roadmap/all',
      id: 'edit',
    },
    {
      label: 'Remove',
      light: false,
      isActive: false,
      get isUnactive(){
        return !this.isActive;
      },
      hasLabel: true,
      route: '/roadmap/all',
      id: 'remove',
    },
    {
      label: 'About',
      light: false,
      isActive: false,
      get isUnactive(){
        return !this.isActive;
      },
      hasLabel: true,
      route: '/roadmap/all',
      id: 'about',
    },
  ],
  menuOptions: [{ label: '', path: '',  light: false,
    isActive: false,
    get isUnactive(){
      return !this.isActive;
    }, }],
};
