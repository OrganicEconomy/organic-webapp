import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { RestoreAccount } from './restore-account';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { encryptSecretKey } from '../../services/secret-key-crypto.util';

const SERVER_URL = 'https://trifouillis.fr'
const TEST_SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f'
const TEST_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3'

describe('RestoreAccount', () => {
  let component: RestoreAccount;
  let fixture: ComponentFixture<RestoreAccount>;
  let httpMock: HttpTestingController;
  let router: Router;
  let localDB: LocalDatabaseService;
  let userService: ConnectedUserService;
  let secretkeyForCorrectPassword: string;
  let secretkeyForRealPassword: string;

  beforeEach(async () => {
    secretkeyForCorrectPassword = await encryptSecretKey(TEST_SK, 'correct-password')
    secretkeyForRealPassword = await encryptSecretKey(TEST_SK, 'the-real-password')

    await TestBed.configureTestingModule({
      imports: [RestoreAccount],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ server: SERVER_URL }) } },
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    localDB = TestBed.inject(LocalDatabaseService);
    userService = TestBed.inject(ConnectedUserService);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(RestoreAccount);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should prefill the server field from the ?server query param', () => {
    expect(component.restoreForm.value.serverUrl).toBe(SERVER_URL);
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

  it('should restore the account when the password decrypts the fetched secretkey', async () => {
    const saveSpy = spyOn(localDB, 'saveUser').and.callThrough()
    const connectSpy = spyOn(userService, 'setConnectedUser').and.callThrough()

    component.restoreForm.setValue({ serverUrl: SERVER_URL, email: 'alice@ex.fr', password: 'correct-password' })
    component.restore()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/login`)
    req.flush({ publickey: TEST_PK, name: 'Alice', mail: 'alice@ex.fr', secretkey: secretkeyForCorrectPassword, blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0 || component.error !== '')

    expect(saveSpy).toHaveBeenCalled()
    const savedAccount = saveSpy.calls.mostRecent().args[0]
    expect(savedAccount.publickey).toBe(TEST_PK)
    expect(savedAccount.serverUrl).toBe(SERVER_URL)
    expect(savedAccount.devicetoken).toBe('dt-1')

    expect(connectSpy).toHaveBeenCalled()
    expect(connectSpy.calls.mostRecent().args[1]).toBe(TEST_SK)
    expect(router.navigate).toHaveBeenCalledWith(['/home'])
    expect(component.error).toBe('')
  });

  it('should show an error and NOT connect when the password is wrong, without comparing it directly', async () => {
    const connectSpy = spyOn(userService, 'setConnectedUser')

    component.restoreForm.setValue({ serverUrl: SERVER_URL, email: 'alice@ex.fr', password: 'a-wrong-password' })
    component.restore()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/login`)
    req.flush({ publickey: TEST_PK, name: 'Alice', mail: 'alice@ex.fr', secretkey: secretkeyForRealPassword, blocks: [], devicetoken: 'dt-1' })
    await waitUntil(() => connectSpy.calls.count() > 0 || component.error !== '')

    expect(connectSpy).not.toHaveBeenCalled()
    expect(router.navigate).not.toHaveBeenCalled()
    expect(component.error).toBeTruthy()
  });

  it('should show an error when the server rejects the login', () => {
    component.restoreForm.setValue({ serverUrl: SERVER_URL, email: 'alice@ex.fr', password: 'whatever' })
    component.restore()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/login`)
    req.flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' })

    expect(component.error).toBeTruthy()
    expect(router.navigate).not.toHaveBeenCalled()
  });
});
