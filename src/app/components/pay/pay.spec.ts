import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { Pay } from './pay';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { BackupService } from '../../services/backup.service';

const MY_PK = 'my-pk';

// Minimal stand-in for a logged-in account — see home.spec.ts for context.
let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'sendTransaction'>>;
let levelUpSpy: jasmine.SpyObj<Pick<LevelUpService, 'celebrateIfLevelUp'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic' | 'recordPayment'>>;

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
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['sendTransaction']);
    serverDBSpy.sendTransaction.and.returnValue(of({}));
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic', 'recordPayment']);
    backupSpy.recordPayment.and.returnValue(of({}));

    TestBed.configureTestingModule({
      imports: [Pay],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: LevelUpService, useValue: levelUpSpy },
        { provide: BackupService, useValue: backupSpy },
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
    component.validated = true;

    component.pay();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
    expect(backupSpy.recordPayment).not.toHaveBeenCalled();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should use recordPayment (mandatory push) when paying someone else', () => {
    component.target = 'someone-elses-pk';
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(backupSpy.recordPayment).toHaveBeenCalledWith(fakeAccount, 'the-real-sk');
  });

  it('should only send the transaction after recordPayment succeeds', () => {
    const subject = new Subject<unknown>();
    backupSpy.recordPayment.and.returnValue(subject.asObservable());
    component.target = 'someone-elses-pk';
    component.amount = 5;
    component.validated = true;

    component.pay();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();

    subject.next({});
    expect(serverDBSpy.sendTransaction).toHaveBeenCalledWith('https://trifouillis.fr', { exported: true } as any);
  });

  it('should not send when recordPayment fails (e.g. offline) — payment stays local-only', () => {
    backupSpy.recordPayment.and.returnValue(throwError(() => ({ status: 0 })));
    component.target = 'someone-elses-pk';
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should navigate back to home after a successful self-pay', () => {
    component.target = MY_PK;
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should navigate back to home after a successful payment to someone else', () => {
    component.target = 'someone-elses-pk';
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should not pay when the amount is zero or the confirmation checkbox is unticked', () => {
    component.target = MY_PK;
    component.amount = 0;
    component.validated = true;
    component.pay();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();

    component.amount = 5;
    component.validated = false;
    component.pay();
    expect(fakeBlockchain.pay).not.toHaveBeenCalled();
  });

  it('should ask LevelUpService to celebrate using the level captured before and after paying', () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    component.target = MY_PK;
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(levelUpSpy.celebrateIfLevelUp).toHaveBeenCalledWith(2, 3);
  });

  it('should not pay when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    component.target = MY_PK;
    component.amount = 5;
    component.validated = true;

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
});
