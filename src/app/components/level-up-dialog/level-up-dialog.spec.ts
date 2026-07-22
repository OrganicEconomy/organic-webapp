import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LevelUpDialog, LevelUpDialogData } from './level-up-dialog';

describe('LevelUpDialog', () => {
  let component: LevelUpDialog;
  let fixture: ComponentFixture<LevelUpDialog>;

  beforeEach(async () => {
    const data: LevelUpDialogData = { oldLevel: 3, newLevel: 4 };

    await TestBed.configureTestingModule({
      imports: [LevelUpDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: () => {} } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(LevelUpDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the new level from the injected dialog data', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('4');
    expect(text).toContain('3');
  });
});
