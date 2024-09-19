import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, map, Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
  private optionSelectedSubject = new BehaviorSubject<string>('');
  public optionSelected$: Observable<string> =
    this.optionSelectedSubject.asObservable();

  constructor() {}
  /* Header */
  setOptionSelected(option: string) {
    this.optionSelectedSubject.next(option);
  }
  /////////////////////////

  /* Navbar */

  setList(): Observable<{ label: string, hasLabel: boolean, id: string, buttonClass: string, buttonContainerClass: string, labelClass: string }[]> {
    return this.optionSelected$.pipe(
      map(option => {
        switch (option) {
          case 'add':
            return [
              {
                label: 'Road Map',
                hasLabel: true,
                id: 'roadMap',
                buttonClass: 'bef bef-bg-red bef-w-60per bef-h-100per bef-bc-black bef-r-20px',
                buttonContainerClass: 'bef bef-w-100per bef-h-100per bef-d-flex jusCon-center aliIte-center',
                labelClass: 'bef bef-d-flex',
              }
            ];
          default:
            return [{
              label: 'No Option Selected',
              hasLabel: true,
              id: 'roadMap',
              buttonClass: 'bef bef-bg-red bef-w-60per bef-h-100per bef-bc-black bef-r-20px',
              buttonContainerClass: 'bef bef-w-100per bef-h-100per bef-d-flex jusCon-center aliIte-center',
              labelClass: 'bef bef-d-flex',
            }];
        }
      })
    );

}
}
