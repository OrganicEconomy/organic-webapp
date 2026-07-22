import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Home } from './home';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';

// A minimal stand-in for a logged-in account — this component (like Pay,
// Contacts) has always assumed getConnectedUser() is non-null; it's not this
// step's job to add a real null-guard (that belongs to its Phase 1 rewrite).
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveLastBlock' | 'getTransactionList'>>;

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(() => {
    fakeBlockchain = {
      getMyPublicKey: () => 'pk',
      getAvailableMoneyAmount: () => 0,
      getLevel: () => 1,
      getMoneyBeforeNextLevel: () => 0,
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
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveLastBlock', 'getTransactionList']);
    serverDBSpy.getTransactionList.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
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

  it('should save (locally and to the server) when money was actually created', () => {
    fakeBlockchain.createMoneyAndInvests.and.returnValue({ money: [20260722000] });

    createComponent();

    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeAccount);
    expect(serverDBSpy.saveLastBlock).toHaveBeenCalledWith(fakeAccount, 'the-real-decrypted-sk');
  });

  it('should not save when money was already created today (null result)', () => {
    fakeBlockchain.createMoneyAndInvests.and.returnValue(null);

    createComponent();

    expect(localDBSpy.saveUser).not.toHaveBeenCalled();
    expect(serverDBSpy.saveLastBlock).not.toHaveBeenCalled();
  });

  it('should show the number of pending payments fetched on load', () => {
    serverDBSpy.getTransactionList.and.returnValue(of([{}, {}, {}] as any));

    createComponent();

    expect(component.pendingCount).toBe(3);
  });
});
