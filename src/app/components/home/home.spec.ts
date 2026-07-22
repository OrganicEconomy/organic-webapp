import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PendingPaymentsService } from '../../services/pending-payments.service';
import { BackupService } from '../../services/backup.service';

// A minimal stand-in for a logged-in account — this component (like Pay,
// Contacts) has always assumed getConnectedUser() is non-null; it's not this
// step's job to add a real null-guard (that belongs to its Phase 1 rewrite).
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let pendingSpy: jasmine.SpyObj<Pick<PendingPaymentsService, 'refresh'>> & { dataSource: any[] };
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordAutomatic'>>;

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(() => {
    fakeBlockchain = {
      getMyPublicKey: () => 'pk',
      getAvailableMoneyAmount: () => 0,
      getLevel: () => 1,
      getMoneyBeforeNextLevel: () => 0,
      getHistory: () => [],
      experience: 42,
      createMoneyAndInvests: jasmine.createSpy('createMoneyAndInvests').and.returnValue(null),
    };
    fakeAccount = {
      name: 'Test',
      publickey: 'pk',
      serverUrl: 'https://trifouillis.fr',
      contacts: [],
      secretkey: 'encrypted-blob-must-never-be-used-as-sk',
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-decrypted-sk',
      isReadOnlySession: () => false,
    };
    pendingSpy = jasmine.createSpyObj('PendingPaymentsService', ['refresh']);
    pendingSpy.dataSource = [];
    backupSpy = jasmine.createSpyObj('BackupService', ['recordAutomatic']);

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: PendingPaymentsService, useValue: pendingSpy },
        { provide: BackupService, useValue: backupSpy },
      ],
    });
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should create daily money using the decrypted secret key, never the account\'s encrypted field', () => {
    createComponent();
    expect(fakeBlockchain.createMoneyAndInvests).toHaveBeenCalledWith('the-real-decrypted-sk');
  });

  it('should record the mutation (via backup.service) when money was actually created', () => {
    fakeBlockchain.createMoneyAndInvests.and.returnValue({ money: [20260722000] });

    createComponent();

    expect(backupSpy.recordAutomatic).toHaveBeenCalledWith(fakeAccount, 'the-real-decrypted-sk');
  });

  it('should not record anything when money was already created today (null result)', () => {
    fakeBlockchain.createMoneyAndInvests.and.returnValue(null);

    createComponent();

    expect(backupSpy.recordAutomatic).not.toHaveBeenCalled();
  });

  it('should not even attempt automatic money creation when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;

    createComponent();

    expect(fakeBlockchain.createMoneyAndInvests).not.toHaveBeenCalled();
  });

  it('should show a banner explaining the read-only state', () => {
    stubConnectedUserService.isReadOnlySession = () => true;

    createComponent();

    expect(fixture.nativeElement.textContent).toContain('lecture seule');
  });

  it('should disable the per-row Encaisser button when the session is read-only', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    pendingSpy.dataSource = [{ hash: 'h1', date: '22/07/2026', source: 'Alice', amount: 3 }];

    createComponent();

    const cashBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.pending-row button');
    expect(cashBtn.disabled).toBeTrue();
  });

  it('should refresh the pending payments list on load', () => {
    createComponent();
    expect(pendingSpy.refresh).toHaveBeenCalled();
  });

  it('should always show the pending payments card, even when empty', () => {
    pendingSpy.dataSource = [];
    createComponent();
    expect(fixture.nativeElement.textContent).toContain('Aucun paiement en attente.');
  });

  it('should refresh the pending payments list when the reload button is clicked', () => {
    createComponent();
    pendingSpy.refresh.calls.reset();

    const reloadBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.pending-card .reload-btn');
    reloadBtn.click();

    expect(pendingSpy.refresh).toHaveBeenCalled();
  });

  it('should expose the blockchain\'s experience as xp', () => {
    createComponent();
    expect(component.xp).toBe(42);
  });

  it('should expose the raw amount of money missing before the next level', () => {
    fakeBlockchain.getMoneyBeforeNextLevel = (asPercent?: boolean) => asPercent ? 40 : 16;
    createComponent();
    expect(component.remainingBeforeNextLevel).toBe(16);
    expect(component.percent).toBe(40);
  });

  it('should show at most the 5 most recent transactions', () => {
    const tx = (n: number) => ({ date: new Date(2026, 0, n), type: 3, signer: 'pk', target: 'pk', money: [1] });
    fakeBlockchain.getHistory = () => [tx(6), tx(5), tx(4), tx(3), tx(2), tx(1)];
    createComponent();
    expect(component.recentTransactions.length).toBe(5);
  });
});
