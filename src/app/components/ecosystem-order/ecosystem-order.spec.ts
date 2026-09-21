import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { InvalidTransactionError } from 'organic-money/src/errors.js';

import { EcosystemOrder } from './ecosystem-order';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { BackupService } from '../../services/backup.service';

const SERVER_URL = 'https://trifouillis.fr';
const ECO_PK = 'eco-pk';
const SK = 'the-real-sk';
const ECO_INFO = { publickey: ECO_PK, name: 'Boulangerie associative', description: null, lat: null, lng: null, iscore: false, blocks: [] };

let fakeTx: any;
let fakeCitizenBlockchain: any;
let fakeEcosystemBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let stubViewedEcosystemService: any;
let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getEcosystemInfo' | 'sendEcosystemTx'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordPayment'>>;

describe('EcosystemOrder', () => {
  let component: EcosystemOrder;
  let fixture: ComponentFixture<EcosystemOrder>;
  let router: Router;

  beforeEach(() => {
    fakeTx = { export: () => ({ exported: true }) };
    fakeCitizenBlockchain = {
      payerOrder: jasmine.createSpy('payerOrder').and.returnValue(fakeTx),
    };
    fakeEcosystemBlockchain = {
      getAffordableInvestAmount: jasmine.createSpy('getAffordableInvestAmount').and.returnValue(3),
      invests: ['u1', 'u2', 'u3'],
    };
    fakeAccount = {
      publickey: 'my-pk',
      serverUrl: SERVER_URL,
      blockchain: fakeCitizenBlockchain,
      contacts: [{ pk: 'contact-pk', name: 'Farid', url: '', type: 'citizen' }],
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => SK,
      isReadOnlySession: () => false,
    };
    stubViewedEcosystemService = {
      setViewedEcosystem: jasmine.createSpy('setViewedEcosystem'),
      getViewedEcosystem: () => ({ blockchain: fakeEcosystemBlockchain }),
    };
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getEcosystemInfo', 'sendEcosystemTx']);
    serverSpy.getEcosystemInfo.and.returnValue(of(ECO_INFO));
    serverSpy.sendEcosystemTx.and.returnValue(of({}));
    backupSpy = jasmine.createSpyObj('BackupService', ['recordPayment']);
    backupSpy.recordPayment.and.returnValue(of({}));

    TestBed.configureTestingModule({
      imports: [EcosystemOrder],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverSpy },
        { provide: ViewedEcosystemService, useValue: stubViewedEcosystemService },
        { provide: BackupService, useValue: backupSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ pk: ECO_PK }) } } },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(EcosystemOrder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  it('should show a load error when the fetch fails', () => {
    serverSpy.getEcosystemInfo.and.returnValue(throwError(() => ({ status: 0 })));

    createComponent();

    expect(component.loadError).toBeTruthy();
  });

  it('should fetch the ecosystem and expose the affordable invest amount as max', () => {
    createComponent();

    expect(component.max).toBe(3);
  });

  describe('submitOrder', () => {
    beforeEach(() => createComponent());

    it('should not submit when no beneficiary is chosen', () => {
      component.targetPk = '';
      component.amount = 1;

      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).not.toHaveBeenCalled();
    });

    it('should not submit when the amount is zero or less', () => {
      component.targetPk = 'contact-pk';
      component.amount = 0;

      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).not.toHaveBeenCalled();
    });

    it('should not submit when the amount exceeds the affordable invests', () => {
      component.targetPk = 'contact-pk';
      component.amount = 4;

      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).not.toHaveBeenCalled();
    });

    it('should not submit when the session is read-only', () => {
      stubConnectedUserService.isReadOnlySession = () => true;
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).not.toHaveBeenCalled();
    });

    it('should call payerOrder with the chosen beneficiary and the first matching invests', () => {
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).toHaveBeenCalledWith(SK, ECO_PK, 'contact-pk', ['u1', 'u2']);
    });

    it('should save via recordPayment then send via sendEcosystemTx only after it succeeds', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();
      expect(serverSpy.sendEcosystemTx).not.toHaveBeenCalled();

      subject.next({});
      expect(serverSpy.sendEcosystemTx).toHaveBeenCalledWith(SERVER_URL, ECO_PK, { exported: true } as any);
    });

    it('should navigate back to the ecosystem detail page after a successful send', () => {
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(router.navigate).toHaveBeenCalledWith(['/ecosystems', ECO_PK]);
    });

    it("should show the server's own error message when the send is rejected", () => {
      spyOn(component, 'displayMessage');
      serverSpy.sendEcosystemTx.and.returnValue(throwError(() => ({ error: { error: 'Order exceeds payer capacity.' } })));
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(component.displayMessage).toHaveBeenCalledWith('Order exceeds payer capacity.');
    });

    it('should fall back to a generic message when the rejection carries no server message', () => {
      spyOn(component, 'displayMessage');
      serverSpy.sendEcosystemTx.and.returnValue(throwError(() => ({ status: 0 })));
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(component.displayMessage).toHaveBeenCalledWith('Ordre enregistré mais non transmis — réessayez plus tard.');
    });

    it('should show a clear message when the exact same order was already made today', () => {
      spyOn(component, 'displayMessage');
      fakeCitizenBlockchain.payerOrder.and.throwError(new InvalidTransactionError('Transaction duplicate abc123'));
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();

      expect(component.displayMessage).toHaveBeenCalledWith("Cette action a déjà été effectuée aujourd'hui — réessayez demain.");
    });

    it('should not build a second order while the first is still pending (double-click guard)', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();
      component.submitOrder();

      expect(fakeCitizenBlockchain.payerOrder).toHaveBeenCalledTimes(1);
    });

    it('should disable the submit button while a submission is pending', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();
      fixture.detectChanges();

      const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-order-button');
      expect(submitButton.disabled).toBeTrue();
    });

    it('should re-enable the submit button once the submission settles', () => {
      component.targetPk = 'contact-pk';
      component.amount = 2;

      component.submitOrder();
      fixture.detectChanges();

      const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('.submit-order-button');
      expect(submitButton.disabled).toBeFalse();
    });
  });
});
