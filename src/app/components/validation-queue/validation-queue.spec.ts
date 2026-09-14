import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ValidationQueue } from './validation-queue';
import { ConnectedUserService } from '../../services/connected-user.service';

const SERVER_URL = 'https://trifouillis.fr';
const LIST_URL = `${SERVER_URL}/api/v1/validations`;
const ADMIN_SK_HEX = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';

let fakeAccount: any;
let stubConnectedUserService: any;

describe('ValidationQueue', () => {
  let component: ValidationQueue;
  let fixture: ComponentFixture<ValidationQueue>;
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
      imports: [ValidationQueue, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
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
    fixture = TestBed.createComponent(ValidationQueue);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();

    httpMock.expectOne((r) => r.url === LIST_URL).flush([]);
  });

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  describe('constructor', () => {
    it('should call getValidationList with the connected user identity on init', () => {
      createComponent();

      const req = httpMock.expectOne((r) => r.url === LIST_URL);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('publickey')).toBe('farid-pk');
      req.flush([]);
    });

    it('should store the candidates returned by the server', () => {
      createComponent();

      httpMock.expectOne((r) => r.url === LIST_URL).flush([
        { pk: 'camille-pk', name: 'Camille', requestedAt: new Date().toISOString() },
      ]);

      expect(component.candidates.length).toBe(1);
      expect(component.candidates[0].name).toBe('Camille');
    });

    it('should treat a request error as an empty list, without throwing', () => {
      createComponent();

      httpMock.expectOne((r) => r.url === LIST_URL).error(new ProgressEvent('network error'));

      expect(component.candidates).toEqual([]);
    });
  });

  describe('requestedAgo', () => {
    it('should say "il y a moins d\'une heure" for a request made 10 minutes ago', () => {
      createComponent();
      httpMock.expectOne((r) => r.url === LIST_URL).flush([]);

      const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();

      expect(component.requestedAgo(tenMinutesAgo)).toBe("il y a moins d'une heure");
    });

    it('should say "il y a 2h" for a request made 2 hours ago', () => {
      createComponent();
      httpMock.expectOne((r) => r.url === LIST_URL).flush([]);

      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();

      expect(component.requestedAgo(twoHoursAgo)).toBe('il y a 2h');
    });

    it('should say "hier" for a request made 30 hours ago', () => {
      createComponent();
      httpMock.expectOne((r) => r.url === LIST_URL).flush([]);

      const thirtyHoursAgo = new Date(Date.now() - 30 * 3600000).toISOString();

      expect(component.requestedAgo(thirtyHoursAgo)).toBe('hier');
    });

    it('should say "il y a 3 jours" for a request made 3 days ago', () => {
      createComponent();
      httpMock.expectOne((r) => r.url === LIST_URL).flush([]);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000).toISOString();

      expect(component.requestedAgo(threeDaysAgo)).toBe('il y a 3 jours');
    });
  });
});
