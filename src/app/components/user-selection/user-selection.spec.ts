import { LocalReadError } from '../../services/local-database.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { UserSelection } from './user-selection';
import { LocalDatabaseService } from '../../services/local-database.service';
import { encryptSecretKey } from '../../services/secret-key-crypto.util';

describe('UserSelection', () => {
  let component: UserSelection;
  let fixture: ComponentFixture<UserSelection>;
  let router: Router;
  let httpMock: HttpTestingController;
  // Stubbed rather than the real localforage-backed service: getUserList's
  // result now drives real navigation logic (redirect on first launch), and
  // the real service shares IndexedDB state across every spec in this run.
  let getUserListSpy: jasmine.Spy;
  let queryParams: Record<string, string>;

  beforeEach(async () => {
    queryParams = {}
    getUserListSpy = jasmine.createSpy('getUserList').and.resolveTo([
      { name: 'Alice', publickey: 'pk', secretkey: 'encrypted-blob' },
    ])

    await TestBed.configureTestingModule({
      imports: [
        UserSelection,
        RouterTestingModule,
        NoopAnimationsModule,
        MatDialogModule,
        MatButtonModule,
        MatCardModule,
        MatListModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LocalDatabaseService, useValue: {
          getUserList: getUserListSpy,
          saveUser: jasmine.createSpy('saveUser'),
          saveUserInBackground: jasmine.createSpy('saveUserInBackground'),
        } },
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(queryParams); } } } },
      ],
    })
    .compileComponents();

    router = TestBed.inject(Router)
    httpMock = TestBed.inject(HttpTestingController)
    spyOn(router, 'navigate')

    fixture = TestBed.createComponent(UserSelection);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should list the local accounts and not redirect when at least one exists', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.users.length).toBe(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should say that this device could not read its accounts, instead of starting over', async () => {
    getUserListSpy.and.rejectWith(new LocalReadError('blocked'));
    spyOn(console, 'error');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.load-error').textContent).toContain(
      "Cet appareil n'a pas pu lire ses comptes. Quittez la navigation privée, ou vérifiez que le site peut enregistrer des données.",
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to /server-selection when there are no local accounts (first launch)', async () => {
    getUserListSpy.and.resolveTo([]);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/server-selection']);
  });

  it('should decrypt the secret key when the password is right', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'correct-password')
    const user: any = { publickey: 'pk', secretkey }

    const result = await component.tryUnlock(user, 'correct-password')

    expect(result).toBe('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f')
  });

  it('should return null on a wrong password, never by comparing it directly', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'the-real-password')
    const user: any = { publickey: 'pk', secretkey }

    const result = await component.tryUnlock(user, 'a-wrong-password')

    expect(result).toBeNull()
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

  it('should navigate to /home when the locally cached status is active', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'correct-password')
    getUserListSpy.and.resolveTo([{ name: 'Alice', publickey: 'pk', secretkey, status: 'active', blocks: [] }])
    fixture.detectChanges();
    await fixture.whenStable();
    spyOn(component.dialog, 'open').and.returnValue({ afterClosed: () => of('correct-password') } as any)

    component.selectUser(0)
    await waitUntil(() => (router.navigate as jasmine.Spy).calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should navigate to /pending-validation when the locally cached status is pending-validation', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'correct-password')
    getUserListSpy.and.resolveTo([{ name: 'Camille', publickey: 'pk', secretkey, status: 'pending-validation', blocks: [] }])
    fixture.detectChanges();
    await fixture.whenStable();
    spyOn(component.dialog, 'open').and.returnValue({ afterClosed: () => of('correct-password') } as any)

    component.selectUser(0)
    await waitUntil(() => (router.navigate as jasmine.Spy).calls.count() > 0)
    httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
    httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })

    expect(router.navigate).toHaveBeenCalledWith(['/pending-validation']);
  });

  describe('selectUser', () => {
    async function unlockActiveAlice() {
      const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'correct-password')
      getUserListSpy.and.resolveTo([{ name: 'Alice', publickey: 'pk', secretkey, status: 'active', blocks: [] }])
      fixture.detectChanges();
      await fixture.whenStable();
      spyOn(component.dialog, 'open').and.returnValue({ afterClosed: () => of('correct-password') } as any)
      const navigateByUrl = spyOn(router, 'navigateByUrl')

      component.selectUser(0)
      await waitUntil(() => navigateByUrl.calls.count() + (router.navigate as jasmine.Spy).calls.count() > 0)
      httpMock.expectOne((r) => r.url.endsWith('/ecosystems/mine')).flush([])
      httpMock.expectOne((r) => r.url.endsWith('/info')).flush({ corePk: null })
      return navigateByUrl
    }

    it('should open the page kept in "next", such as a shared contact link', async () => {
      queryParams = { next: '/addcontact?pk=02ab&name=Basile' }

      const navigateByUrl = await unlockActiveAlice()

      expect(navigateByUrl).toHaveBeenCalledWith('/addcontact?pk=02ab&name=Basile')
    });
  });
});
