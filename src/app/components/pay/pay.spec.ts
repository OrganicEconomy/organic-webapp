import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Pay } from './pay';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { BackupService, UndoNotStoredError } from '../../services/backup.service';
import { LocalSaveError } from '../../services/local-database.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { MALFORMED_PUBLIC_KEY_MESSAGE } from '../../utils/public-key.util';

const MY_PK = '02' + 'a1'.repeat(32);
const SOMEONE_ELSES_PK = '03' + 'b2'.repeat(32);
const ECO_PK = '02' + 'c3'.repeat(32);
const CITIZEN_PK = '03' + 'd4'.repeat(32);

// Minimal stand-in for a logged-in account — see home.spec.ts for context.
let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let serverDBSpy: jasmine.SpyObj<
  Pick<ServerConnexionService, 'sendTransaction' | 'sendEcosystemTx' | 'getValidationStatus' | 'getEcosystemInfo'>
>;
let levelUpSpy: jasmine.SpyObj<Pick<LevelUpService, 'celebrateIfLevelUp'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'applyAndRecord' | 'applyAndSave'>>;
let dialogSpy: jasmine.SpyObj<MatDialog>;

describe('Pay', () => {
  let component: Pay;
  let fixture: ComponentFixture<Pay>;
  let router: Router;

  beforeEach(() => {
    fakeTx = { target: '', export: () => ({ exported: true }) };
    fakeBlockchain = {
      getMyPublicKey: () => MY_PK,
      getAvailableMoneyAmount: () => 100,
      getLevel: () => 2,
      getHistory: () => [],
      pay: jasmine.createSpy('pay').and.callFake((sk: string, target: string) => {
        fakeTx.target = target
        return fakeTx
      }),
    };
    fakeAccount = {
      contacts: [],
      serverUrl: 'https://trifouillis.fr',
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
      isReadOnlySession: () => false,
    };
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', [
      'sendTransaction',
      'sendEcosystemTx',
      'getValidationStatus',
      'getEcosystemInfo',
    ]);
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'active' }));
    serverDBSpy.getEcosystemInfo.and.returnValue(of({} as any));
    serverDBSpy.sendTransaction.and.returnValue(of({}));
    serverDBSpy.sendEcosystemTx.and.returnValue(of({}));
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);
    backupSpy = jasmine.createSpyObj('BackupService', ['applyAndRecord', 'applyAndSave']);
    backupSpy.applyAndRecord.and.callFake(async (_account, _sk, change) => change());
    backupSpy.applyAndSave.and.callFake((user: any, sk: string, change: () => any) => of(change()));
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    dialogSpy.open.and.returnValue({ afterClosed: () => of(true) } as any);

    TestBed.configureTestingModule({
      imports: [Pay],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: LevelUpService, useValue: levelUpSpy },
        { provide: BackupService, useValue: backupSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(Pay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should store a self-pay on this device, not through the mandatory server save', async () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();
    await fixture.whenStable();

    expect(backupSpy.applyAndRecord).toHaveBeenCalledWith(fakeAccount, 'the-real-sk', jasmine.any(Function));
    expect(backupSpy.applyAndSave).not.toHaveBeenCalled();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should pay someone else through applyAndSave (mandatory push)', () => {
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(backupSpy.applyAndSave).toHaveBeenCalledWith(fakeAccount, 'the-real-sk', jasmine.any(Function));
    expect(fakeBlockchain.pay).toHaveBeenCalledWith('the-real-sk', SOMEONE_ELSES_PK, 5);
  });

  it('should only send the transaction after the save succeeds', () => {
    const subject = new Subject<any>();
    backupSpy.applyAndSave.and.returnValue(subject.asObservable());
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();

    subject.next(fakeTx);
    expect(serverDBSpy.sendTransaction).toHaveBeenCalledWith('https://trifouillis.fr', { exported: true } as any);
  });

  it("should send via sendEcosystemTx (not sendTransaction) when paying a contact of type 'ecosystem'", () => {
    fakeAccount.contacts.push({ pk: ECO_PK, name: 'Boulangerie', url: '', type: 'ecosystem' });
    component.target = ECO_PK;
    component.amount = 5;

    component.pay();

    expect(serverDBSpy.sendEcosystemTx).toHaveBeenCalledWith('https://trifouillis.fr', ECO_PK, { exported: true } as any);
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it("should send via sendTransaction when paying a contact of type 'citizen'", () => {
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: '', type: 'citizen' });
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(serverDBSpy.sendTransaction).toHaveBeenCalledWith('https://trifouillis.fr', { exported: true } as any);
    expect(serverDBSpy.sendEcosystemTx).not.toHaveBeenCalled();
  });

  it('should not send when the save fails (e.g. offline)', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => ({ status: 0 })));
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should cancel the payment, with no celebration, when this device was revoked by a newer login', () => {
    backupSpy.applyAndSave.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'DEVICE_REVOKED' } })),
    );
    spyOn(component, 'displayMessage');
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(
      "Ce compte est actif sur un autre appareil : paiement annulé, rien n'a été débité.",
    );
    expect(levelUpSpy.celebrateIfLevelUp).not.toHaveBeenCalled();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should cancel the payment when this device could not store it', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => new LocalSaveError('full')));
    spyOn(component, 'displayMessage');
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(
      "Paiement annulé : cet appareil n'a pas pu l'enregistrer. Rien n'a été débité.",
    );
  });

  it('should cancel the payment when the server could not save it', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    spyOn(component, 'displayMessage');
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(
      "Paiement annulé : il n'a pas pu être enregistré sur le serveur. Rien n'a été débité.",
    );
  });

  it('should not blame the server when the payment itself is impossible', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => new Error('Unsufficient funds.')));
    spyOn(component, 'displayMessage');
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith('Une erreur est survenue oO');
  });

  it('should say how to recover when this device could not store the undo of a refused payment', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => new UndoNotStoredError('Opération refusée par le serveur, mais cet appareil n’a pas pu enregistrer son annulation.')));
    spyOn(component, 'displayMessage');
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(jasmine.stringMatching(/n’a pas pu enregistrer son annulation/));
  });

  it('should cancel a self-pay that this device could not store', async () => {
    backupSpy.applyAndRecord.and.rejectWith(new LocalSaveError('device full'));
    spyOn(component, 'displayMessage');
    spyOn(console, 'error');
    component.target = MY_PK;
    component.amount = 5;

    component.pay();
    await fixture.whenStable();

    expect(component.displayMessage).toHaveBeenCalledOnceWith(
      "Paiement annulé : cet appareil n'a pas pu l'enregistrer. Rien n'a été débité.",
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate back to home after a successful self-pay', async () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should navigate back to home after a successful payment to someone else', () => {
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should not pay a contact registered on another server, so nothing is debited', () => {
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: 'https://ailleurs.fr', type: 'citizen' });
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should consider a contact whose server address only adds a trailing slash to be on this server', () => {
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: 'https://trifouillis.fr/', type: 'citizen' });
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(dialogSpy.open).toHaveBeenCalled();
  });

  it('should check the recipient only once when Payer is tapped twice during the check', () => {
    serverDBSpy.getValidationStatus.and.returnValue(new Subject<any>());
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();
    component.pay();

    expect(serverDBSpy.getValidationStatus).toHaveBeenCalledTimes(1);
  });

  it('should check the recipient again on a new tap once the previous check is over', () => {
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'rejected' }));
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();
    component.pay();

    expect(serverDBSpy.getValidationStatus).toHaveBeenCalledTimes(2);
  });

  it('should disable the Payer button while the recipient is being checked', () => {
    serverDBSpy.getValidationStatus.and.returnValue(new Subject<any>());
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pay-btn').disabled).toBeTrue();
  });

  it('should not start a second payment while the first one is being saved', () => {
    backupSpy.applyAndSave.and.returnValue(new Subject<any>());
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    component.pay();

    expect(backupSpy.applyAndSave).toHaveBeenCalledTimes(1);
  });

  it('should allow paying again once the save has failed', () => {
    backupSpy.applyAndSave.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    component.pay();

    expect(backupSpy.applyAndSave).toHaveBeenCalledTimes(2);
  });

  it('should allow paying again once the send has failed', () => {
    serverDBSpy.sendTransaction.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    component.pay();

    expect(backupSpy.applyAndSave).toHaveBeenCalledTimes(2);
  });

  it('should disable the Payer button while the payment is being saved', () => {
    backupSpy.applyAndSave.and.returnValue(new Subject<any>());
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pay-btn').disabled).toBeTrue();
  });

  it('should not ask for confirmation once the page has been left during the check', () => {
    const lookup = new Subject<any>();
    serverDBSpy.getValidationStatus.and.returnValue(lookup);
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();
    fixture.destroy();
    lookup.next({ status: 'active' });

    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should not pay a citizen this server does not know, so nothing is debited', () => {
    serverDBSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: 'https://trifouillis.fr', type: 'citizen' });
    spyOn(component, 'displayMessage');
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith("Ce destinataire n'est pas inscrit sur ton serveur.");
    expect(serverDBSpy.getValidationStatus).toHaveBeenCalledWith('https://trifouillis.fr', CITIZEN_PK);
    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should not pay a citizen who is not active, so nothing is debited', () => {
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'rejected' }));
    spyOn(component, 'displayMessage');
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith("Ce destinataire n'est pas un citoyen actif.");

    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should not pay an ecosystem this server does not know, so nothing is debited', () => {
    serverDBSpy.getEcosystemInfo.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fakeAccount.contacts.push({ pk: ECO_PK, name: 'Boulangerie', url: '', type: 'ecosystem' });
    spyOn(component, 'displayMessage');
    component.target = ECO_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith("Cet écosystème n'existe pas sur ton serveur.");
    expect(serverDBSpy.getEcosystemInfo).toHaveBeenCalledWith('https://trifouillis.fr', ECO_PK);
    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should explain that the recipient could not be checked when the server is unreachable', () => {
    serverDBSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    spyOn(component, 'displayMessage');
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(
      'Impossible de vérifier le destinataire : pas de connexion au serveur.',
    );
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should not ask the server about yourself on a self-pay', () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

    expect(serverDBSpy.getValidationStatus).not.toHaveBeenCalled();
  });

  it('should explain that the recipient could not be checked when the server fails', () => {
    serverDBSpy.getValidationStatus.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    spyOn(component, 'displayMessage');
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(component.displayMessage).toHaveBeenCalledWith(
      'Impossible de vérifier le destinataire : le serveur ne répond pas correctement.',
    );
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should consider a contact whose server address differs only in case or default port to be on this server', () => {
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: 'HTTPS://Trifouillis.fr:443', type: 'citizen' });
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(dialogSpy.open).toHaveBeenCalled();
  });

  it('should not pay a contact whose server address is not a valid URL', () => {
    fakeAccount.contacts.push({ pk: CITIZEN_PK, name: 'Farid', url: 'pas une adresse', type: 'citizen' });
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();

    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it("should not pay a contact whose public key is malformed, so nothing is debited", () => {
    const snackBar = TestBed.inject(MatSnackBar);
    spyOn(snackBar, 'open');
    component.target = 'abcdef123456';
    component.amount = 5;

    component.pay();

    expect(snackBar.open).toHaveBeenCalledWith(MALFORMED_PUBLIC_KEY_MESSAGE, 'Fermer', { duration: 3000 });

    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should not pay when the amount is zero', () => {
    component.target = MY_PK;
    component.amount = 0;
    component.pay();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should open a confirmation dialog when Payer is tapped', () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

    expect(dialogSpy.open).toHaveBeenCalledWith(ConfirmDialog, {
      data: { title: 'Payer', message: jasmine.stringMatching(/5/) },
    });
  });

  it('should not call blockchain.pay when the confirmation dialog is dismissed', () => {
    dialogSpy.open.and.returnValue({ afterClosed: () => of(false) } as any);
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should ask LevelUpService to celebrate using the level captured before and after paying', async () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    component.target = MY_PK;
    component.amount = 5;

    component.pay();
    await fixture.whenStable();

    expect(levelUpSpy.celebrateIfLevelUp).toHaveBeenCalledWith(2, 3);
  });

  it('should not pay when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should disable the Payer button when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    fixture = TestBed.createComponent(Pay);
    fixture.detectChanges();

    const payBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.pay-btn');
    expect(payBtn.disabled).toBeTrue();
  });

  describe('Historique card', () => {
    it('should show at most the 5 most recent transactions', () => {
      const tx = (n: number) => ({ date: new Date(2026, 0, n), type: 3, signer: MY_PK, target: MY_PK, money: [1] });
      fakeBlockchain.getHistory = () => [tx(6), tx(5), tx(4), tx(3), tx(2), tx(1)];

      fixture = TestBed.createComponent(Pay);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.recentTransactions.length).toBe(5);
    });

    it('should show an empty message when there is no transaction yet', () => {
      expect(fixture.nativeElement.querySelector('.history-card').textContent).toContain('Aucune transaction pour l\'instant.');
    });

    it('should link "Voir tout l\'historique" to /transactions', () => {
      const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.history-card a[routerLink="/transactions"]');
      expect(link).toBeTruthy();
    });
  });
});
