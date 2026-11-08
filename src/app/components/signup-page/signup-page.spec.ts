import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { SignupPage } from './signup-page';
import { LocalDatabaseService, LocalSaveError } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { AccountTabsService } from '../../services/account-tabs.service';

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

  it('should disable the submit button while the form is invalid', () => {
    component.signupForm.setValue({ email: '', name: 'Alice', birthdate: '01/01/2000', password: 'a-password' })
    fixture.detectChanges()

    const submitButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]')

    expect(submitButton.disabled).toBeTrue()
  });

  it('should not register when the form is invalid (e.g. an empty field)', async () => {
    component.signupForm.setValue({ email: '', name: 'Alice', birthdate: '01/01/2000', password: 'a-password' })

    await component.signup()

    expect(() => httpMock.expectNone(`${SERVER_URL}/api/v1/users/register`)).not.toThrow()
  });

  it('should not register when the birthdate is not a real calendar date (e.g. 31 April)', async () => {
    component.signupForm.setValue({ email: 'alice@ex.fr', name: 'Alice', birthdate: '31/04/2026', password: 'a-password' })

    await component.signup()

    expect(() => httpMock.expectNone(`${SERVER_URL}/api/v1/users/register`)).not.toThrow()
  });

  it('should send to the restore page an account created on the server that this device could not store', async () => {
    spyOn(localDB, 'saveUser').and.rejectWith(new LocalSaveError('full'))
    spyOn(console, 'error')
    const alertSpy = spyOn(window, 'alert')

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    req.flush({ publickey: req.request.body.publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => alertSpy.calls.count() > 0)

    expect(alertSpy).toHaveBeenCalledWith(
      "Votre compte est créé, mais cet appareil n'a pas pu l'enregistrer. Libérez de la place, puis restaurez-le.",
    )
    expect(router.navigate).toHaveBeenCalledWith(['/restore-account'], { queryParams: { server: SERVER_URL } })
  });

  it('should store the new account even if another tab announced that key', async () => {
    const tabs = TestBed.inject(AccountTabsService)
    let takenBack = false
    spyOn(tabs, 'isStale').and.callFake(() => !takenBack)
    spyOn(tabs, 'takeBack').and.callFake(() => { takenBack = true })
    const alertSpy = spyOn(window, 'alert')

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()
    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    req.flush({ publickey: req.request.body.publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => (router.navigate as jasmine.Spy).calls.count() > 0)
    httpMock.expectOne((r) => r.url.includes('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(alertSpy).not.toHaveBeenCalled()
    expect(router.navigate).toHaveBeenCalledWith(['/pending-validation'])
  });

  it('should store the membership status returned by the server on the local account', async () => {
    const saveSpy = spyOn(localDB, 'saveUser').and.callThrough()
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    const publickey = req.request.body.publickey
    req.flush({ publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(saveSpy).toHaveBeenCalled()
    const savedAccount = saveSpy.calls.mostRecent().args[0]
    expect(savedAccount.status).toBe('pending-validation')
  });

  it('should not add the new citizen to their own contacts', async () => {
    const saveSpy = spyOn(localDB, 'saveUser').and.callThrough()
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    const publickey = req.request.body.publickey
    req.flush({ publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(saveSpy.calls.mostRecent().args[0].contacts).toEqual([])
  });

  it('should navigate to /pending-validation when the server reports pending-validation', async () => {
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.signupForm.setValue({ email: 'camille@ex.fr', name: 'Camille', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    const publickey = req.request.body.publickey
    req.flush({ publickey, status: 'pending-validation', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(router.navigate).toHaveBeenCalledWith(['/pending-validation'])
  });

  it('should navigate to /home when the server reports the account is already active', async () => {
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.signupForm.setValue({ email: 'alice@ex.fr', name: 'Alice', birthdate: '01/01/2000', password: 'a-password' })
    await component.signup()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    const publickey = req.request.body.publickey
    req.flush({ publickey, status: 'active', blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(router.navigate).toHaveBeenCalledWith(['/home'])
  });
});
