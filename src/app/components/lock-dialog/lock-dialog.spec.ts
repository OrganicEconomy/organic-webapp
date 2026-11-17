import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';

import { LockDialog } from './lock-dialog';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PageReopenerService } from '../../services/page-reopener.service';

describe('LockDialog', () => {
  let fixture: ComponentFixture<LockDialog>;
  let component: LockDialog;
  let unlockSpy: jasmine.Spy;
  let dialogRefSpy: jasmine.SpyObj<Pick<MatDialogRef<LockDialog>, 'close'>>;
  let reopenSpy: jasmine.Spy;

  beforeEach(async () => {
    unlockSpy = jasmine.createSpy('unlock').and.resolveTo(true);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    reopenSpy = jasmine.createSpy('reopenCurrentPage').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [LockDialog],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: { unlock: unlockSpy } },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: PageReopenerService, useValue: { reopenCurrentPage: reopenSpy } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LockDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('unlock', () => {
    it('should close the dialog and reopen the page, unlocked, with the right password', async () => {
      component.password = 'the-password';

      await component.unlock();

      expect(unlockSpy).toHaveBeenCalledWith('the-password');
      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(reopenSpy).toHaveBeenCalled();
    });
  
    it('should stay open and say so with a wrong password', async () => {
      unlockSpy.and.resolveTo(false);
      component.password = 'a-wrong-password';

      await component.unlock();
      fixture.detectChanges();

      expect(dialogRefSpy.close).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.unlock-error').textContent).toContain('Mot de passe incorrect.');
    });
  });

  describe('changeAccount', () => {
    it('should close the dialog and log out', () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      component.changeAccount();

      expect(dialogRefSpy.close).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/logout']);
    });
  });
});
