import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DailyMoneyDialog, DailyMoneyDialogData } from './daily-money-dialog';

describe('DailyMoneyDialog', () => {
  function render(data: DailyMoneyDialogData): string {
    TestBed.configureTestingModule({
      imports: [DailyMoneyDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(DailyMoneyDialog);
    fixture.detectChanges();
    return fixture.nativeElement.textContent;
  }

  it('should display the number of units created today', () => {
    expect(render({ created: 3, cashed: 0 })).toContain('+3');
  });

  it('should mention the expired units cashed when there are some', () => {
    expect(render({ created: 3, cashed: 2 })).toContain('2 unité(s) périmée(s) encaissée(s)');
  });

  it('should not mention any cashing when nothing expired', () => {
    expect(render({ created: 3, cashed: 0 })).not.toContain('encaissée');
  });
});
