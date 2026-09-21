import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { EcosystemDetail } from './ecosystem-detail';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { LocalDatabaseService } from '../../services/local-database.service';

const SERVER_URL = 'https://trifouillis.fr';
const ECO_PK = 'eco-pk';
const SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';
const INFO_URL = `${SERVER_URL}/api/v1/ecosystems/${ECO_PK}`;
const DISTRIBUTE_URL = `${INFO_URL}/distribute`;

let fakeAccount: any;
let stubConnectedUserService: any;
let stubViewedEcosystemService: any;
let fakeBlockchain: any;
let dialogSpy: jasmine.SpyObj<MatDialog>;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;

describe('EcosystemDetail', () => {
  let component: EcosystemDetail;
  let fixture: ComponentFixture<EcosystemDetail>;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    fakeAccount = {
      name: 'Farid',
      publickey: 'farid-pk',
      serverUrl: SERVER_URL,
      contacts: [{ pk: 'admin-pk', name: 'Camille', url: '', type: 'citizen' }],
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => SK,
      isReadOnlySession: () => false,
    };

    fakeBlockchain = {
      isAdmin: jasmine.createSpy('isAdmin').and.returnValue(false),
      isActor: jasmine.createSpy('isActor').and.returnValue(false),
      isPayer: jasmine.createSpy('isPayer').and.returnValue(false),
      getAdmins: jasmine.createSpy('getAdmins').and.returnValue(new Set(['admin-pk'])),
      getPayers: jasmine.createSpy('getPayers').and.returnValue(new Map([['payer-pk-not-a-contact', -1]])),
      getActors: jasmine.createSpy('getActors').and.returnValue(new Map([['a1', 1], ['a2', 1], ['a3', 2]])),
      getAvailableMoneyAmount: jasmine.createSpy('getAvailableMoneyAmount').and.returnValue(340),
      getAffordableInvestAmount: jasmine.createSpy('getAffordableInvestAmount').and.returnValues(999, 3, 1, 5, 12),
    };

    stubViewedEcosystemService = {
      setViewedEcosystem: jasmine.createSpy('setViewedEcosystem'),
      getViewedEcosystem: () => ({ blockchain: fakeBlockchain }),
    };

    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);
    dialogSpy.open.and.returnValue({ afterClosed: () => of(true) } as any);

    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    localDBSpy.saveUser.and.resolveTo(fakeAccount);

    await TestBed.configureTestingModule({
      imports: [EcosystemDetail, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ViewedEcosystemService, useValue: stubViewedEcosystemService },
        { provide: MatDialog, useValue: dialogSpy },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ pk: ECO_PK }) } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(EcosystemDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const ECO_INFO = { publickey: ECO_PK, name: 'Boulangerie associative', description: null, lat: null, lng: null, iscore: false, blocks: [] };

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  it('should show a load error when the fetch fails', () => {
    createComponent();

    httpMock.expectOne(INFO_URL).error(new ProgressEvent('network error'));

    expect(component.loadError).toBeTruthy();
  });

  it('should set the viewed ecosystem from the fetched info', () => {
    createComponent();

    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(stubViewedEcosystemService.setViewedEcosystem).toHaveBeenCalledWith(ECO_INFO);
    expect(component.name).toBe('Boulangerie associative');
  });

  it('should combine every role the connected user holds into the role label', () => {
    fakeBlockchain.isAdmin.and.returnValue(true);
    fakeBlockchain.isActor.and.returnValue(true);

    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.roleLabel).toBe('Admin, Actant');
  });

  it('should say "Aucun rôle" when the connected user has no role at all', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.roleLabel).toBe('Aucun rôle');
  });

  it('should read the balance from getAvailableMoneyAmount', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.balance).toBe(340);
  });

  it("should read today's affordable invests as a single count", () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.affordableInvests).toBe(999);
  });

  it('should build the upcoming-invests table for today/tomorrow/+7 days/+30 days', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.upcomingInvests).toEqual([
      { label: "Aujourd'hui", count: 3 },
      { label: 'Demain', count: 1 },
      { label: 'Dans 7 jours', count: 5 },
      { label: 'Dans 30 jours', count: 12 },
    ]);
  });

  it('should resolve admin names via contacts', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.admins).toEqual(['Camille']);
  });

  it('should show "Moi" for the connected user\'s own public key instead of a truncated key', () => {
    fakeBlockchain.getAdmins.and.returnValue(new Set(['admin-pk', 'farid-pk']));

    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.admins).toEqual(['Camille', 'Moi']);
  });

  it('should fall back to a truncated key for a payer who is not a contact', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.payers).toEqual(['payer-pk…']);
  });

  it('should report the actor count as a plain number', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.actorCount).toBe(3);
  });

  it('should expose isAdmin true when the connected user is admin of the viewed ecosystem', () => {
    fakeBlockchain.isAdmin.and.returnValue(true);

    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isAdmin).toBeTrue();
  });

  it('should expose isAdmin false when the connected user is not admin of the viewed ecosystem', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isAdmin).toBeFalse();
  });

  it('should expose isPayer true when the connected user is payer of the viewed ecosystem', () => {
    fakeBlockchain.isPayer.and.returnValue(true);

    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isPayer).toBeTrue();
  });

  it('should expose isPayer false when the connected user is not payer of the viewed ecosystem', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isPayer).toBeFalse();
  });

  it('should always show a link to engage invests', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.invest-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(`/ecosystems/${ECO_PK}/invest`);
  });

  it('should only show a link to manage roles when the connected user is admin', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.roles-link')).toBeFalsy();

    fakeBlockchain.isAdmin.and.returnValue(true);
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.roles-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(`/ecosystems/${ECO_PK}/roles`);
  });

  it('should only show a link to emit an order when the connected user is payer', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.order-link')).toBeFalsy();

    fakeBlockchain.isPayer.and.returnValue(true);
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.order-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(`/ecosystems/${ECO_PK}/order`);
  });

  it('should only show a button to distribute salaries when the connected user is admin', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.distribute-button')).toBeFalsy();

    fakeBlockchain.isAdmin.and.returnValue(true);
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.distribute-button')).toBeTruthy();
  });

  it('should expose isContact false when the ecosystem is not yet a contact', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isContact).toBeFalse();
  });

  it('should expose isContact true when the ecosystem is already a contact', () => {
    fakeAccount.contacts.push({ pk: ECO_PK, name: 'Boulangerie associative', url: SERVER_URL, type: 'ecosystem' });

    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);

    expect(component.isContact).toBeTrue();
  });

  it('should only show a button to add the ecosystem to contacts when it is not already one', () => {
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-contact-button')).toBeTruthy();

    fakeAccount.contacts.push({ pk: ECO_PK, name: 'Boulangerie associative', url: SERVER_URL, type: 'ecosystem' });
    createComponent();
    httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.add-contact-button')).toBeFalsy();
  });

  describe('distributeSalary', () => {
    beforeEach(() => {
      createComponent();
      httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    });

    it('should open a confirmation dialog', () => {
      component.distributeSalary();

      expect(dialogSpy.open).toHaveBeenCalledWith(ConfirmDialog, {
        data: { title: 'Distribuer les salaires', message: 'Distribuer les salaires maintenant ?' },
      });
      httpMock.expectOne(DISTRIBUTE_URL).flush({});
      httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    });

    it('should not call the server when the dialog is dismissed without confirming', () => {
      dialogSpy.open.and.returnValue({ afterClosed: () => of(false) } as any);

      component.distributeSalary();

      expect(dialogSpy.open).toHaveBeenCalled();
      httpMock.expectNone(DISTRIBUTE_URL);
    });

    it('should call distributeSalary on the server when confirmed', () => {
      component.distributeSalary();

      const req = httpMock.expectOne(DISTRIBUTE_URL);
      expect(req.request.body.publickey).toBe('farid-pk');
      req.flush({});
      httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    });

    it('should show a success message and re-fetch the ecosystem after a successful distribution', () => {
      spyOn(component, 'displayMessage');

      component.distributeSalary();
      httpMock.expectOne(DISTRIBUTE_URL).flush({});
      httpMock.expectOne(INFO_URL).flush(ECO_INFO);

      expect(component.displayMessage).toHaveBeenCalledWith('Demande de versement de salaires envoyée avec succès.');
    });

    it("should show the server's own error message when the distribution is rejected", () => {
      spyOn(component, 'displayMessage');

      component.distributeSalary();
      httpMock.expectOne(DISTRIBUTE_URL).flush({ error: 'Only admins can distribute salaries.' }, { status: 403, statusText: 'Forbidden' });

      expect(component.displayMessage).toHaveBeenCalledWith('Only admins can distribute salaries.');
    });

    it('should fall back to a generic message when the rejection carries no server message', () => {
      spyOn(component, 'displayMessage');

      component.distributeSalary();
      httpMock.expectOne(DISTRIBUTE_URL).error(new ProgressEvent('network error'));

      expect(component.displayMessage).toHaveBeenCalledWith('La distribution a échoué — réessayez plus tard.');
    });

    it('should not open the dialog when the session is read-only', () => {
      stubConnectedUserService.isReadOnlySession = () => true;

      component.distributeSalary();

      expect(dialogSpy.open).not.toHaveBeenCalled();
    });
  });

  describe('addToContacts', () => {
    beforeEach(() => {
      createComponent();
      httpMock.expectOne(INFO_URL).flush(ECO_INFO);
    });

    it('should push the ecosystem as a contact and save it', async () => {
      await component.addToContacts();

      expect(fakeAccount.contacts).toContain({ pk: ECO_PK, name: 'Boulangerie associative', url: SERVER_URL, type: 'ecosystem' });
      expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeAccount);
    });

    it('should flip isContact to true after adding', async () => {
      await component.addToContacts();

      expect(component.isContact).toBeTrue();
    });

    it('should not add a duplicate contact when already added', async () => {
      fakeAccount.contacts.push({ pk: ECO_PK, name: 'Boulangerie associative', url: SERVER_URL, type: 'ecosystem' });
      component.isContact = true;

      await component.addToContacts();

      expect(fakeAccount.contacts.length).toBe(2); // the pre-existing admin-pk contact + the ecosystem, not 3
      expect(localDBSpy.saveUser).not.toHaveBeenCalled();
    });
  });
});
