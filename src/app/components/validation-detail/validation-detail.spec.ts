import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { CitizenBlockchain } from 'organic-money/src/index.js';

import { ValidationDetail } from './validation-detail';
import { ConnectedUserService } from '../../services/connected-user.service';

const SERVER_URL = 'https://trifouillis.fr';
const CANDIDATE_PK = 'camille-pk';
const DETAIL_URL = `${SERVER_URL}/api/v1/validations/${CANDIDATE_PK}`;
const APPROVE_URL = `${SERVER_URL}/api/v1/validations/${CANDIDATE_PK}/approve`;
const REJECT_URL = `${SERVER_URL}/api/v1/validations/${CANDIDATE_PK}/reject`;
const ADMIN_SK_HEX = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';

function makePendingCandidateBlocks(): unknown[] {
  const bc = new CitizenBlockchain();
  bc.makeBirthBlock('Camille', new Date(2000, 0, 1));
  return bc.export();
}

let fakeAccount: any;
let stubConnectedUserService: any;

describe('ValidationDetail', () => {
  let component: ValidationDetail;
  let fixture: ComponentFixture<ValidationDetail>;
  let router: Router;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    fakeAccount = {
      name: 'Farid',
      publickey: 'farid-pk',
      serverUrl: SERVER_URL,
      status: 'active',
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => ADMIN_SK_HEX,
    };

    await TestBed.configureTestingModule({
      imports: [ValidationDetail, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => CANDIDATE_PK } } } },
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
    fixture = TestBed.createComponent(ValidationDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();

    httpMock.expectOne((r) => r.url === DETAIL_URL).flush({ name: 'Camille', blocks: makePendingCandidateBlocks() });
  });

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  describe('constructor', () => {
    it('should fetch the candidate detail for the pk read from the route', () => {
      createComponent();

      const req = httpMock.expectOne((r) => r.url === DETAIL_URL);
      expect(req.request.method).toBe('GET');
      req.flush({ name: 'Camille', blocks: makePendingCandidateBlocks() });
    });

    it('should store the candidate name once loaded', () => {
      createComponent();

      httpMock.expectOne((r) => r.url === DETAIL_URL).flush({ name: 'Camille', blocks: makePendingCandidateBlocks() });

      expect(component.candidateName).toBe('Camille');
    });

    it('should record an error when the candidate cannot be fetched', () => {
      createComponent();

      httpMock.expectOne((r) => r.url === DETAIL_URL).flush('not found', { status: 404, statusText: 'Not Found' });

      expect(component.loadError).toBeTruthy();
    });
  });

  describe('approve', () => {
    beforeEach(() => {
      createComponent();
      httpMock.expectOne((r) => r.url === DETAIL_URL).flush({ name: 'Camille', blocks: makePendingCandidateBlocks() });
    });

    it('should sign an InitializationBlock with the admin key and POST it to /approve', () => {
      component.approve();

      const req = httpMock.expectOne(APPROVE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.publickey).toBe('farid-pk');
      expect(req.request.body.block.t).toBe(4); // BLOCKTYPE.CITIZENINIT
      req.flush({ message: 'Account validated.' });
    });

    it('should navigate back to /validations once approved', () => {
      component.approve();

      httpMock.expectOne(APPROVE_URL).flush({ message: 'Account validated.' });

      expect(router.navigate).toHaveBeenCalledWith(['/validations']);
    });

    it('should record an error and stay put if the server refuses the approval', () => {
      component.approve();

      httpMock.expectOne(APPROVE_URL).flush('already validated', { status: 409, statusText: 'Conflict' });

      expect(component.actionError).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalledWith(['/validations']);
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      createComponent();
      httpMock.expectOne((r) => r.url === DETAIL_URL).flush({ name: 'Camille', blocks: makePendingCandidateBlocks() });
    });

    it('should POST to /reject with the admin identity', () => {
      component.reject();

      const req = httpMock.expectOne(REJECT_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.publickey).toBe('farid-pk');
      req.flush({ message: 'Account rejected.' });
    });

    it('should navigate back to /validations once rejected', () => {
      component.reject();

      httpMock.expectOne(REJECT_URL).flush({ message: 'Account rejected.' });

      expect(router.navigate).toHaveBeenCalledWith(['/validations']);
    });

    it('should record an error and stay put if the server refuses the rejection', () => {
      component.reject();

      httpMock.expectOne(REJECT_URL).error(new ProgressEvent('network error'));

      expect(component.actionError).toBeTruthy();
      expect(router.navigate).not.toHaveBeenCalledWith(['/validations']);
    });
  });
});
