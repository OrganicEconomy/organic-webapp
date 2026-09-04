import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { decodeQr } from 'organic-protocol';

import { PendingValidation } from './pending-validation';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';

const SERVER_URL = 'https://trifouillis.fr'
const STATUS_URL = `${SERVER_URL}/api/v1/validations/status/camille-pk`

let fakeAccount: any;
let stubConnectedUserService: any;

describe('PendingValidation', () => {
  let component: PendingValidation;
  let fixture: ComponentFixture<PendingValidation>;
  let router: Router;
  let httpMock: HttpTestingController;
  let localDB: LocalDatabaseService;

  beforeEach(async () => {
    fakeAccount = {
      name: 'Camille',
      publickey: 'camille-pk',
      serverUrl: SERVER_URL,
      status: 'pending-validation',
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
    };

    await TestBed.configureTestingModule({
      imports: [PendingValidation, RouterTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    localDB = TestBed.inject(LocalDatabaseService);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(PendingValidation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();

    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });
  });

  it('should redirect to /user-selection if there is no connected user', () => {
    stubConnectedUserService.getConnectedUser = () => null;

    createComponent();

    expect(router.navigate).toHaveBeenCalledWith(['/user-selection']);
  });

  it('should build the QR payload from the connected user\'s identity', () => {
    createComponent();

    const decoded = decodeQr(component.qrData);

    expect(decoded.type).toBe('BR');
    if (decoded.type === 'BR') {
      expect(decoded.payload.pk).toBe('camille-pk');
      expect(decoded.payload.url).toBe(SERVER_URL);
      expect(decoded.payload.n).toBe('Camille');
    }

    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });
  });

  it('should call getValidationStatus immediately on init', () => {
    createComponent();

    const req = httpMock.expectOne(STATUS_URL);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'pending-validation' });
  });

  it('should stay on the screen when the server still reports pending-validation', () => {
    createComponent();

    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });

    expect(router.navigate).not.toHaveBeenCalledWith(['/home']);
  });

  it('should navigate to /home when the server reports active on the first check', () => {
    createComponent();

    httpMock.expectOne(STATUS_URL).flush({ status: 'active' });

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should persist the updated status onto the local account before navigating home', () => {
    const saveSpy = spyOn(localDB, 'saveUser').and.callThrough();
    createComponent();

    httpMock.expectOne(STATUS_URL).flush({ status: 'active' });

    expect(saveSpy).toHaveBeenCalled();
    expect(saveSpy.calls.mostRecent().args[0].status).toBe('active');
    expect(fakeAccount.status).toBe('active');
  });

  it('should schedule a follow-up check 30s later when still pending', fakeAsync(() => {
    createComponent();
    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });

    tick(30000);

    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });
    fixture.destroy();
  }));

  it('should navigate to /home once a later poll (not the first) reports active', fakeAsync(() => {
    createComponent();
    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });

    tick(30000);
    httpMock.expectOne(STATUS_URL).flush({ status: 'active' });

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  }));

  it('should stop polling once the component is destroyed', fakeAsync(() => {
    createComponent();
    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });

    fixture.destroy();
    tick(30000);

    httpMock.expectNone(STATUS_URL);
  }));

  it('should keep polling silently after a network error, without navigating or crashing', fakeAsync(() => {
    createComponent();
    httpMock.expectOne(STATUS_URL).error(new ProgressEvent('network error'));

    expect(router.navigate).not.toHaveBeenCalledWith(['/home']);

    tick(30000);

    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });
    fixture.destroy();
  }));

  it('should not build a QR code or poll at all when the initial status is rejected', () => {
    fakeAccount.status = 'rejected';

    createComponent();

    expect(component.qrData).toBe('');
    httpMock.expectNone(STATUS_URL);
  });

  it('should stop polling and not navigate home when a later poll reports rejected', fakeAsync(() => {
    createComponent();
    httpMock.expectOne(STATUS_URL).flush({ status: 'pending-validation' });

    tick(30000);
    httpMock.expectOne(STATUS_URL).flush({ status: 'rejected' });

    expect(router.navigate).not.toHaveBeenCalledWith(['/home']);
    expect(component.user.status).toBe('rejected');

    tick(30000);
    httpMock.expectNone(STATUS_URL);
  }));
});
