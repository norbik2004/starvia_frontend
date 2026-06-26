import { inject, Injectable } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { Observable } from 'rxjs';
import { map } from 'rxjs';
import type { DashboardDeleteConfirmData } from './dashboard-delete-confirm-data';
import { DashboardDeleteConfirmSheetContent } from './dashboard-delete-confirm-sheet-content';

@Injectable({ providedIn: 'root' })
export class DashboardDeleteConfirmService {
  private readonly bottomSheet = inject(MatBottomSheet);

  open(data: DashboardDeleteConfirmData): Observable<boolean> {
    const ref = this.bottomSheet.open(DashboardDeleteConfirmSheetContent, {
      data: {
        keepLabel: 'Keep',
        deleteLabel: 'Delete',
        deletingLabel: 'Deleting…',
        ...data,
      },
      panelClass: 'dashboard-delete-bottom-sheet-panel',
      backdropClass: 'dashboard-delete-bottom-sheet-backdrop',
      disableClose: false,
      hasBackdrop: true,
    });

    return ref.afterDismissed().pipe(map((result) => result === true));
  }
}
