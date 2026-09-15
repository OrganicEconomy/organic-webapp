import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let component: ConfirmDialog;
  let fixture: ComponentFixture<ConfirmDialog>;
  let dialogRef: { close: jasmine.Spy };

  function setup(data: ConfirmDialogData) {
    dialogRef = { close: jasmine.createSpy('close') };

    TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should display the title and message from the injected dialog data', () => {
    setup({ title: 'Distribuer les salaires', message: 'Distribuer les salaires maintenant ?' });

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Distribuer les salaires');
    expect(text).toContain('Distribuer les salaires maintenant ?');
  });

  it('should display default button labels when none are given', () => {
    setup({ title: 'Titre', message: 'Message' });

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Annuler');
    expect(text).toContain('Confirmer');
  });

  it('should display custom button labels when given', () => {
    setup({ title: 'Titre', message: 'Message', confirmLabel: 'Distribuer', cancelLabel: 'Plus tard' });

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Plus tard');
    expect(text).toContain('Distribuer');
  });

  it('should close the dialog with true when the confirm button is clicked', () => {
    setup({ title: 'Titre', message: 'Message' });

    const confirmButton: HTMLButtonElement = fixture.nativeElement.querySelector('.confirm-button');
    confirmButton.click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close the dialog with false when the cancel button is clicked', () => {
    setup({ title: 'Titre', message: 'Message' });

    const cancelButton: HTMLButtonElement = fixture.nativeElement.querySelector('.cancel-button');
    cancelButton.click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
