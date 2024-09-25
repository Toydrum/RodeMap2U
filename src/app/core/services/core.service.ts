import { Injectable } from '@angular/core';
import { BehaviorSubject, from, map, Observable, Subject, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CoreService {
   selectionSubject = new BehaviorSubject<string>('');
  selection$ = this.selectionSubject.asObservable();

  constructor() {

  }
  /* Header */
  updateSelection(value: string) {

    this.selectionSubject.next(value);
  }

  getModifiedSelection() {
    return this.selection$.pipe(
      map(value => value)
    );

  }



  /* Navbar */
}
