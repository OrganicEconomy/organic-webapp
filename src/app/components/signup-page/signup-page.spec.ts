import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { SignupPage } from './signup-page';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';

const SERVER_URL = 'https://trifouillis.fr'

describe('SignupPage', () => {
  let component: SignupPage;
  let fixture: ComponentFixture<SignupPage>;
  let httpMock: HttpTestingController;
  let router: Router;
  let localDB: LocalDatabaseService;
  let userService: ConnectedUserService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ server: SERVER_URL }) } },
        },
      ],
    })
    .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    localDB = TestBed.inject(LocalDatabaseService);
    userService = TestBed.inject(ConnectedUserService);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(SignupPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
    const start = Date.now()
    return new Promise((resolve, reject) => {
      const check = () => {
        if (predicate()) return resolve()
        if (Date.now() - start > timeoutMs) return reject(new Error('waitUntil: timed out'))
        setTimeout(check, 10)
      }
      check()
    })
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should store the membership status returned by the server on the local account', async () => {
    const saveSpy = spyOn(localDB, 'saveUser').and.callThrough()
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '2000-01-01', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    const publickey = req.request.body.publickey
    req.flush({ publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0)

    expect(saveSpy).toHaveBeenCalled()
    const savedAccount = saveSpy.calls.mostRecent().args[0]
    expect(savedAccount.status).toBe('pending-validation')
  });
});
