import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';

import { EcosystemInvest } from './ecosystem-invest';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';

const ECO_PK = 'eco-pk';
const SERVER_URL = 'https://trifouillis.fr';
const SK = 'the-real-sk';

let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'sendEcosystemTx'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordPayment'>>;

describe('EcosystemInvest', () => {
  let component: EcosystemInvest;
  let fixture: ComponentFixture<EcosystemInvest>;
  let router: Router;

  beforeEach(() => {
    fakeTx = { export: () => ({ exported: true }) };
    fakeBlockchain = {
      engageInvests: jasmine.createSpy('engageInvests').and.returnValue(fakeTx),
      engageMoney: jasmine.createSpy('engageMoney').and.returnValue(fakeTx),
      getAffordableInvestAmount: jasmine.createSpy('getAffordableInvestAmount').and.returnValue(12),
      getAffordableMoneyAmount: jasmine.createSpy('getAffordableMoneyAmount').and.returnValue(7),
    };
    fakeAccount = { serverUrl: SERVER_URL, blockchain: fakeBlockchain };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => SK,
      isReadOnlySession: () => false,
    };
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['sendEcosystemTx']);
    serverSpy.sendEcosystemTx.and.returnValue(of({}));
    backupSpy = jasmine.createSpyObj('BackupService', ['recordPayment']);
    backupSpy.recordPayment.and.returnValue(of({}));

    TestBed.configureTestingModule({
      imports: [EcosystemInvest],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ServerConnexionService, useValue: serverSpy },
        { provide: BackupService, useValue: backupSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ pk: ECO_PK }) } } },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(EcosystemInvest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    const localFixture = TestBed.createComponent(EcosystemInvest);
    localFixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  describe('max', () => {
    it("should read the invests daily cap when the pocket is 'invests'", () => {
      component.pocket = 'invests';
      expect(component.max).toBe(12);
    });

    it("should read the money daily cap when the pocket is 'money'", () => {
      component.pocket = 'money';
      expect(component.max).toBe(7);
    });
  });

  describe('engage', () => {
    it('should not engage when the daily amount is zero or less', () => {
      component.dailyAmount = 0;
      component.days = 3;

      component.engage();

      expect(fakeBlockchain.engageInvests).not.toHaveBeenCalled();
    });

    it('should not engage when the number of days is zero or less', () => {
      component.dailyAmount = 3;
      component.days = 0;

      component.engage();

      expect(fakeBlockchain.engageInvests).not.toHaveBeenCalled();
    });

    it('should not engage when the session is read-only', () => {
      stubConnectedUserService.isReadOnlySession = () => true;
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(fakeBlockchain.engageInvests).not.toHaveBeenCalled();
    });

    it("should call engageInvests when the pocket is 'invests'", () => {
      component.pocket = 'invests';
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(fakeBlockchain.engageInvests).toHaveBeenCalledWith(SK, ECO_PK, 3, 5);
      expect(fakeBlockchain.engageMoney).not.toHaveBeenCalled();
    });

    it("should call engageMoney when the pocket is 'money'", () => {
      component.pocket = 'money';
      component.dailyAmount = 2;
      component.days = 4;

      component.engage();

      expect(fakeBlockchain.engageMoney).toHaveBeenCalledWith(SK, ECO_PK, 2, 4);
      expect(fakeBlockchain.engageInvests).not.toHaveBeenCalled();
    });

    it('should not save or send when building the transaction throws (e.g. insufficient funds)', () => {
      fakeBlockchain.engageInvests.and.throwError('Unsufficient funds.');
      component.dailyAmount = 3;
      component.days = 5;

      expect(() => component.engage()).not.toThrow();
      expect(backupSpy.recordPayment).not.toHaveBeenCalled();
    });

    it('should save locally via recordPayment before sending', () => {
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(backupSpy.recordPayment).toHaveBeenCalledWith(fakeAccount, SK);
    });

    it('should only send after recordPayment succeeds', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();
      expect(serverSpy.sendEcosystemTx).not.toHaveBeenCalled();

      subject.next({});
      expect(serverSpy.sendEcosystemTx).toHaveBeenCalledWith(SERVER_URL, ECO_PK, { exported: true } as any);
    });

    it('should not send when recordPayment fails', () => {
      backupSpy.recordPayment.and.returnValue(throwError(() => ({ status: 0 })));
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(serverSpy.sendEcosystemTx).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalledWith(['/ecosystems', ECO_PK]);
    });

    it('should navigate back to the ecosystem detail page after a successful save and send', () => {
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(router.navigate).toHaveBeenCalledWith(['/ecosystems', ECO_PK]);
    });

    it('should not navigate when the send fails', () => {
      serverSpy.sendEcosystemTx.and.returnValue(throwError(() => ({ status: 500 })));
      component.dailyAmount = 3;
      component.days = 5;

      component.engage();

      expect(router.navigate).not.toHaveBeenCalledWith(['/ecosystems', ECO_PK]);
    });
  });
});
