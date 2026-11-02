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
import { BackupService } from '../../services/backup.service';
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
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic' | 'recordPayment'>>;
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
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'active', blocks: [] }));
    serverDBSpy.getEcosystemInfo.and.returnValue(of({} as any));
    serverDBSpy.sendTransaction.and.returnValue(of({}));
    serverDBSpy.sendEcosystemTx.and.returnValue(of({}));
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic', 'recordPayment']);
    backupSpy.recordPayment.and.returnValue(of({}));
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

  it('should use recordAutomatic (policy-respecting), not recordPayment, on a self-pay', () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
    expect(backupSpy.recordPayment).not.toHaveBeenCalled();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should use recordPayment (mandatory push) when paying someone else', () => {
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(backupSpy.recordPayment).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should only send the transaction after recordPayment succeeds', () => {
    const subject = new Subject<unknown>();
    backupSpy.recordPayment.and.returnValue(subject.asObservable());
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();

    subject.next({});
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

  it('should not send when recordPayment fails (e.g. offline) — payment stays local-only', () => {
    backupSpy.recordPayment.and.returnValue(throwError(() => ({ status: 0 })));
    component.target = SOMEONE_ELSES_PK;
    component.amount = 5;

    component.pay();

    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should navigate back to home after a successful self-pay', () => {
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

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
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'rejected', blocks: [] }));
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

  it('should not ask for confirmation once the page has been left during the check', () => {
    const lookup = new Subject<any>();
    serverDBSpy.getValidationStatus.and.returnValue(lookup);
    component.target = CITIZEN_PK;
    component.amount = 5;

    component.pay();
    fixture.destroy();
    lookup.next({ status: 'active', blocks: [] });

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
    serverDBSpy.getValidationStatus.and.returnValue(of({ status: 'rejected', blocks: [] }));
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

  it('should ask LevelUpService to celebrate using the level captured before and after paying', () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    component.target = MY_PK;
    component.amount = 5;

    component.pay();

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
