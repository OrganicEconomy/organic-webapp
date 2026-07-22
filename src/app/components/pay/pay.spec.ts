import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Pay } from './pay';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';

const MY_PK = 'my-pk';

// Minimal stand-in for a logged-in account — see home.spec.ts for context.
let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveLastBlock' | 'sendTransaction'>>;

describe('Pay', () => {
  let component: Pay;
  let fixture: ComponentFixture<Pay>;
  let router: Router;

  beforeEach(() => {
    fakeTx = { target: '', export: () => ({ exported: true }) };
    fakeBlockchain = {
      getMyPublicKey: () => MY_PK,
      getAvailableMoneyAmount: () => 100,
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
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveLastBlock', 'sendTransaction']);

    TestBed.configureTestingModule({
      imports: [Pay],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
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

  it('should not send the transaction over the network on a self-pay', () => {
    component.target = MY_PK;
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(serverDBSpy.saveLastBlock).toHaveBeenCalled();
    expect(serverDBSpy.sendTransaction).not.toHaveBeenCalled();
  });

  it('should send the transaction to the server when paying someone else', () => {
    component.target = 'someone-elses-pk';
    component.amount = 5;
    component.validated = true;

    component.pay();

    expect(serverDBSpy.sendTransaction).toHaveBeenCalledWith('https://trifouillis.fr', { exported: true } as any);
  });

  it('should navigate back to home after a successful payment', () => {
    component.target = MY_PK;
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
});
