import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { InvalidTransactionError } from 'organic-money/src/errors.js';

import { EcosystemRoles } from './ecosystem-roles';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { BackupService } from '../../services/backup.service';

const SERVER_URL = 'https://trifouillis.fr';
const ECO_PK = 'eco-pk';
const SK = 'the-real-sk';
const ECO_INFO = { publickey: ECO_PK, name: 'Boulangerie associative', description: null, lat: null, lng: null, iscore: false, blocks: [] };

let fakeTx: any;
let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let stubViewedEcosystemService: any;
let serverSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getEcosystemInfo' | 'sendEcosystemTx'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'recordPayment'>>;

describe('EcosystemRoles', () => {
  let component: EcosystemRoles;
  let fixture: ComponentFixture<EcosystemRoles>;
  let router: Router;

  beforeEach(() => {
    fakeTx = { export: jasmine.createSpy('export').and.returnValue({ exported: true }) };
    fakeBlockchain = {
      isAdmin: jasmine.createSpy('isAdmin').and.returnValue(true),
      getAdmins: jasmine.createSpy('getAdmins').and.returnValue(new Set(['admin-pk'])),
      getActors: jasmine.createSpy('getActors').and.returnValue(new Map([['actor-pk', 2]])),
      getPayers: jasmine.createSpy('getPayers').and.returnValue(new Map([['payer-pk', -1]])),
      setAdmin: jasmine.createSpy('setAdmin').and.returnValue(fakeTx),
      unsetAdmin: jasmine.createSpy('unsetAdmin').and.returnValue(fakeTx),
      setActor: jasmine.createSpy('setActor').and.returnValue(fakeTx),
      unsetActor: jasmine.createSpy('unsetActor').and.returnValue(fakeTx),
      setPayer: jasmine.createSpy('setPayer').and.returnValue(fakeTx),
      unsetPayer: jasmine.createSpy('unsetPayer').and.returnValue(fakeTx),
    };
    fakeAccount = {
      publickey: 'my-pk',
      serverUrl: SERVER_URL,
      blockchain: fakeBlockchain,
      contacts: [
        { pk: 'admin-pk', name: 'Camille', url: '', type: 'citizen' },
        { pk: 'actor-pk', name: 'Farid', url: '', type: 'citizen' },
      ],
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => SK,
      isReadOnlySession: () => false,
    };
    stubViewedEcosystemService = {
      setViewedEcosystem: jasmine.createSpy('setViewedEcosystem'),
      getViewedEcosystem: () => ({ blockchain: fakeBlockchain }),
    };
    serverSpy = jasmine.createSpyObj('ServerConnexionService', ['getEcosystemInfo', 'sendEcosystemTx']);
    serverSpy.getEcosystemInfo.and.returnValue(of(ECO_INFO));
    serverSpy.sendEcosystemTx.and.returnValue(of({}));
    backupSpy = jasmine.createSpyObj('BackupService', ['recordPayment']);
    backupSpy.recordPayment.and.returnValue(of({}));

    TestBed.configureTestingModule({
      imports: [EcosystemRoles],
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
    fixture = TestBed.createComponent(EcosystemRoles);
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

  it('should set the viewed ecosystem from the fetched info', () => {
    createComponent();

    expect(stubViewedEcosystemService.setViewedEcosystem).toHaveBeenCalledWith(ECO_INFO);
  });

  it('should expose isAdmin for the connected user', () => {
    createComponent();

    expect(component.isAdmin).toBeTrue();
  });

  it('should list current admins/actors/payers resolved with pk and contact name', () => {
    createComponent();

    expect(component.admins).toEqual([{ pk: 'admin-pk', name: 'Camille' }]);
    expect(component.actors).toEqual([{ pk: 'actor-pk', name: 'Farid' }]);
    expect(component.payers).toEqual([{ pk: 'payer-pk', name: 'payer-pk…' }]);
  });

  it('should show "Moi" for the connected user\'s own public key instead of a truncated key', () => {
    fakeBlockchain.getAdmins.and.returnValue(new Set(['admin-pk', 'my-pk']));

    createComponent();

    expect(component.admins).toEqual([{ pk: 'admin-pk', name: 'Camille' }, { pk: 'my-pk', name: 'Moi' }]);
  });

  describe('removeRole', () => {
    beforeEach(() => createComponent());

    it('should call unsetAdmin and re-fetch on success', () => {
      component.removeRole('admin', 'admin-pk');

      expect(fakeBlockchain.unsetAdmin).toHaveBeenCalledWith(SK, ECO_PK, 'admin-pk');
      expect(backupSpy.recordPayment).toHaveBeenCalledWith(fakeAccount, SK);
      expect(serverSpy.getEcosystemInfo).toHaveBeenCalledTimes(2);
    });

    it('should call unsetActor for an actor', () => {
      component.removeRole('actor', 'actor-pk');

      expect(fakeBlockchain.unsetActor).toHaveBeenCalledWith(SK, ECO_PK, 'actor-pk');
    });

    it('should call unsetPayer for a payer', () => {
      component.removeRole('payer', 'payer-pk');

      expect(fakeBlockchain.unsetPayer).toHaveBeenCalledWith(SK, ECO_PK, 'payer-pk');
    });

    it('should not send when recordPayment fails', () => {
      backupSpy.recordPayment.and.returnValue(throwError(() => ({ status: 0 })));

      component.removeRole('admin', 'admin-pk');

      expect(serverSpy.sendEcosystemTx).not.toHaveBeenCalled();
    });

    it("should show the server's own error message when the removal is rejected (e.g. still payer)", () => {
      spyOn(component, 'displayMessage');
      serverSpy.sendEcosystemTx.and.returnValue(throwError(() => ({ error: { error: 'Cannot remove actor who is still payer.' } })));

      component.removeRole('actor', 'actor-pk');

      expect(component.displayMessage).toHaveBeenCalledWith('Cannot remove actor who is still payer.');
    });

    it('should fall back to a generic message when the rejection carries no server message', () => {
      spyOn(component, 'displayMessage');
      serverSpy.sendEcosystemTx.and.returnValue(throwError(() => ({ status: 0 })));

      component.removeRole('actor', 'actor-pk');

      expect(component.displayMessage).toHaveBeenCalledWith('Action enregistrée mais non transmise — réessayez plus tard.');
    });

    it('should not remove when the session is read-only', () => {
      stubConnectedUserService.isReadOnlySession = () => true;

      component.removeRole('admin', 'admin-pk');

      expect(fakeBlockchain.unsetAdmin).not.toHaveBeenCalled();
    });

    it('should show a clear message when the exact same role change was already made today', () => {
      spyOn(component, 'displayMessage');
      fakeBlockchain.unsetAdmin.and.throwError(new InvalidTransactionError('Transaction duplicate abc123'));

      component.removeRole('admin', 'admin-pk');

      expect(component.displayMessage).toHaveBeenCalledWith("Cette action a déjà été tentée aujourd'hui — réessayez demain.");
    });

    it('should not throw uncaught if building the wire payload throws asynchronously', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      fakeTx.export.and.callFake(() => { throw new Error('boom'); });

      component.removeRole('admin', 'admin-pk');

      expect(() => subject.next({})).not.toThrow();
    });
  });

  describe('addRole', () => {
    beforeEach(() => createComponent());

    it('should not add when no contact is selected', () => {
      component.targetPk = '';
      component.roleType = 'admin';

      component.addRole();

      expect(fakeBlockchain.setAdmin).not.toHaveBeenCalled();
    });

    it('should call setAdmin when the role type is admin', () => {
      component.targetPk = 'actor-pk';
      component.roleType = 'admin';

      component.addRole();

      expect(fakeBlockchain.setAdmin).toHaveBeenCalledWith(SK, ECO_PK, 'actor-pk');
    });

    it('should call setActor with the given ratio when the role type is actor', () => {
      component.targetPk = 'admin-pk';
      component.roleType = 'actor';
      component.ratio = 2;

      component.addRole();

      expect(fakeBlockchain.setActor).toHaveBeenCalledWith(SK, ECO_PK, 'admin-pk', 2);
    });

    it('should not call setActor when the ratio is negative', () => {
      spyOn(component, 'displayMessage');
      component.targetPk = 'admin-pk';
      component.roleType = 'actor';
      component.ratio = -1;

      component.addRole();

      expect(fakeBlockchain.setActor).not.toHaveBeenCalled();
      expect(component.displayMessage).toHaveBeenCalledWith('Le ratio doit être un nombre entier positif ou nul.');
    });

    it('should not call setActor when the ratio is not an integer', () => {
      component.targetPk = 'admin-pk';
      component.roleType = 'actor';
      component.ratio = 1.5;

      component.addRole();

      expect(fakeBlockchain.setActor).not.toHaveBeenCalled();
    });

    it('should call setPayer with the given cap when the role type is payer', () => {
      component.targetPk = 'admin-pk';
      component.roleType = 'payer';
      component.cap = 5;
      component.capUnlimited = false;

      component.addRole();

      expect(fakeBlockchain.setPayer).toHaveBeenCalledWith(SK, ECO_PK, 'admin-pk', 5);
    });

    it('should call setPayer with -1 when the cap is marked unlimited', () => {
      component.targetPk = 'admin-pk';
      component.roleType = 'payer';
      component.capUnlimited = true;

      component.addRole();

      expect(fakeBlockchain.setPayer).toHaveBeenCalledWith(SK, ECO_PK, 'admin-pk', -1);
    });

    it('should not call setPayer when the cap is negative and not unlimited', () => {
      spyOn(component, 'displayMessage');
      component.targetPk = 'admin-pk';
      component.roleType = 'payer';
      component.capUnlimited = false;
      component.cap = -3;

      component.addRole();

      expect(fakeBlockchain.setPayer).not.toHaveBeenCalled();
      expect(component.displayMessage).toHaveBeenCalledWith('Le plafond doit être un nombre entier positif ou nul.');
    });

    it('should allow setPayer with cap 0 (not unlimited)', () => {
      component.targetPk = 'admin-pk';
      component.roleType = 'payer';
      component.capUnlimited = false;
      component.cap = 0;

      component.addRole();

      expect(fakeBlockchain.setPayer).toHaveBeenCalledWith(SK, ECO_PK, 'admin-pk', 0);
    });

    it('should save via recordPayment then send via sendEcosystemTx only after it succeeds', () => {
      const subject = new Subject<unknown>();
      backupSpy.recordPayment.and.returnValue(subject.asObservable());
      component.targetPk = 'actor-pk';
      component.roleType = 'admin';

      component.addRole();
      expect(serverSpy.sendEcosystemTx).not.toHaveBeenCalled();

      subject.next({});
      expect(serverSpy.sendEcosystemTx).toHaveBeenCalledWith(SERVER_URL, ECO_PK, { exported: true } as any);
    });

    it('should re-fetch and refresh the lists after a successful add', () => {
      component.targetPk = 'actor-pk';
      component.roleType = 'admin';

      component.addRole();

      expect(serverSpy.getEcosystemInfo).toHaveBeenCalledTimes(2);
    });

    it('should not add when the session is read-only', () => {
      stubConnectedUserService.isReadOnlySession = () => true;
      component.targetPk = 'actor-pk';
      component.roleType = 'admin';

      component.addRole();

      expect(fakeBlockchain.setAdmin).not.toHaveBeenCalled();
    });

    it('should show a clear message when the exact same role change was already made today', () => {
      spyOn(component, 'displayMessage');
      fakeBlockchain.setAdmin.and.throwError(new InvalidTransactionError('Transaction duplicate abc123'));
      component.targetPk = 'actor-pk';
      component.roleType = 'admin';

      component.addRole();

      expect(component.displayMessage).toHaveBeenCalledWith("Cette action a déjà été tentée aujourd'hui — réessayez demain.");
    });
  });
});
