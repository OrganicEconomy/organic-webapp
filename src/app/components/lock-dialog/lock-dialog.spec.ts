import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';

import { LockDialog } from './lock-dialog';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PageReopenerService } from '../../services/page-reopener.service';
import { ChainSyncService } from '../../services/chain-sync.service';

describe('LockDialog', () => {
  let fixture: ComponentFixture<LockDialog>;
  let component: LockDialog;
  let unlockSpy: jasmine.Spy;
  let dialogRefSpy: jasmine.SpyObj<Pick<MatDialogRef<LockDialog>, 'close'>>;
  let reopenSpy: jasmine.Spy;
  let syncSpy: jasmine.Spy;

  beforeEach(async () => {
    unlockSpy = jasmine.createSpy('unlock').and.resolveTo(true);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    reopenSpy = jasmine.createSpy('reopenCurrentPage').and.resolveTo();
    syncSpy = jasmine.createSpy('syncTheConnectedAccount').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [LockDialog],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: { unlock: unlockSpy } },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: PageReopenerService, useValue: { reopenCurrentPage: reopenSpy } },
        { provide: ChainSyncService, useValue: { syncTheConnectedAccount: syncSpy } },
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

    it('should stay open until the page is reopened, so that nothing can be tapped in between', async () => {
      component.password = 'the-password';

      await component.unlock();

      expect(reopenSpy).toHaveBeenCalledBefore(dialogRefSpy.close);
    });

    it('should sync with the server before reopening the page', async () => {
      component.password = 'the-password';

      await component.unlock();

      expect(syncSpy).toHaveBeenCalledBefore(reopenSpy);
    });

    it('should try only once when asked twice while the key is being decrypted', async () => {
      component.password = 'the-password';

      await Promise.all([component.unlock(), component.unlock()]);

      expect(unlockSpy).toHaveBeenCalledTimes(1);
    });

    it('should stay open and say so with a wrong password', async () => {
      unlockSpy.and.resolveTo(false);
      component.password = 'a-wrong-password';

      await component.unlock();
      fixture.detectChanges();

      expect(dialogRefSpy.close).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.unlock-error').textContent).toContain(
        'Mot de passe incorrect.',
      );
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

  describe('template', () => {
    it('should unlock when the citizen presses Enter in the password field', () => {
      spyOn(component, 'unlock');
      const passwordField: HTMLInputElement =
        fixture.nativeElement.querySelector('input[type=password]');

      passwordField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expect(component.unlock).toHaveBeenCalled();
    });

    it('should log out to change account from the « Changer de compte » button', () => {
      spyOn(component, 'changeAccount');
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      );

      buttons.find((button) => button.textContent?.includes('Changer de compte'))?.click();

      expect(component.changeAccount).toHaveBeenCalled();
    });
  });
});
