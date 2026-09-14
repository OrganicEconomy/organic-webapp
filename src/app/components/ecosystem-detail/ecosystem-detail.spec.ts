import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { EcosystemDetail } from './ecosystem-detail';
import { ConnectedUserService } from '../../services/connected-user.service';
import { ViewedEcosystemService } from '../../services/viewed-ecosystem.service';

const SERVER_URL = 'https://trifouillis.fr';
const ECO_PK = 'eco-pk';
const INFO_URL = `${SERVER_URL}/api/v1/ecosystems/${ECO_PK}`;

let fakeAccount: any;
let stubConnectedUserService: any;
let stubViewedEcosystemService: any;
let fakeBlockchain: any;

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
    stubConnectedUserService = { getConnectedUser: () => fakeAccount };

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

    await TestBed.configureTestingModule({
      imports: [EcosystemDetail, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ViewedEcosystemService, useValue: stubViewedEcosystemService },
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
});
