import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ServerSelection } from './server-selection';
import { environment } from '../../../environments/environment';

describe('ServerSelection', () => {
  let component: ServerSelection;
  let fixture: ComponentFixture<ServerSelection>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerSelection],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(ServerSelection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushKnownServers(servers: { name: string; url: string }[]) {
    const req = httpMock.expectOne(`${environment.serverUrl}/api/v1/servers`);
    req.flush(servers);
    fixture.detectChanges();
  }

  describe('with a non-empty known-servers list', () => {
    beforeEach(() => {
      flushKnownServers([{ name: 'Serveur de Trifouillis', url: 'https://trifouillis.fr' }]);
    });

    it('should create and preselect the first known server', () => {
      expect(component).toBeTruthy();
      expect(component.knownServers.length).toBe(1);
      expect(component.chosenUrl).toBe('https://trifouillis.fr');
    });

    it('should not switch to custom-URL mode', () => {
      expect(component.useCustom).toBeFalse();
    });

    it('should hide the URL field and show the server list', () => {
      const input = fixture.nativeElement.querySelector('input[type="text"]');
      const radios = fixture.nativeElement.querySelectorAll('mat-radio-button');

      expect(input).toBeFalsy();
      expect(radios.length).toBe(1);
    });

    it('should reveal the URL field when "Utiliser une autre adresse" is clicked', () => {
      const toggleLink: HTMLButtonElement = fixture.nativeElement.querySelector('.use-custom-link');
      toggleLink.click();
      fixture.detectChanges();

      expect(component.useCustom).toBeTrue();
      const input = fixture.nativeElement.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
    });

    it('should verify the chosen server and expose its info on success', () => {
      component.verify()

      const req = httpMock.expectOne('https://trifouillis.fr/api/v1/info')
      req.flush({ protocolVersion: 1, apiVersion: '1', name: 'Serveur de Trifouillis', serverPk: 'pk', corePk: null, stats: { users: 42 } })

      expect(component.verifiedInfo?.name).toBe('Serveur de Trifouillis')
      expect(component.verifiedInfo?.stats.users).toBe(42)
      expect(component.error).toBe('')
    });

    it('should show an error when the server cannot be reached', () => {
      component.verify()

      const req = httpMock.expectOne('https://trifouillis.fr/api/v1/info')
      req.error(new ProgressEvent('error'))

      expect(component.verifiedInfo).toBeNull()
      expect(component.error).toBeTruthy()
    });

    it('should normalize a custom URL before verifying (adds https://, strips trailing slash)', () => {
      component.useCustom = true
      component.customUrl = 'orga-bzh.fr/'

      component.verify()

      httpMock.expectOne('https://orga-bzh.fr/api/v1/info').flush({
        protocolVersion: 1, apiVersion: '1', name: 'Orga Bretagne', serverPk: 'pk', corePk: null, stats: { users: 5 },
      })
      expect(component.verifiedInfo?.name).toBe('Orga Bretagne')
    });

    it('should reject an empty custom URL without making a request', () => {
      component.useCustom = true
      component.customUrl = ''

      component.verify()

      httpMock.expectNone(() => true)
      expect(component.error).toBeTruthy()
    });

    it('createAccount navigates to /signup with the chosen server as a query param', () => {
      const navigateSpy = spyOn(router, 'navigate')

      component.createAccount()

      expect(navigateSpy).toHaveBeenCalledWith(['/signup'], { queryParams: { server: 'https://trifouillis.fr' } })
    });

    it('restoreAccount navigates to /restore-account with the chosen server as a query param', () => {
      const navigateSpy = spyOn(router, 'navigate')

      component.restoreAccount()

      expect(navigateSpy).toHaveBeenCalledWith(['/restore-account'], { queryParams: { server: 'https://trifouillis.fr' } })
    });
  });

  describe('with an empty known-servers list', () => {
    beforeEach(() => {
      flushKnownServers([]);
    });

    it('should switch to custom-URL mode automatically', () => {
      expect(component.useCustom).toBeTrue();
    });

    it('should show the URL field and an admin hint, with no server list', () => {
      const input = fixture.nativeElement.querySelector('input[type="text"]');
      const radios = fixture.nativeElement.querySelectorAll('mat-radio-button');
      const hint = fixture.nativeElement.querySelector('.admin-hint');

      expect(input).toBeTruthy();
      expect(radios.length).toBe(0);
      expect(hint).toBeTruthy();
    });
  });

  describe('when the root server is unreachable', () => {
    beforeEach(() => {
      const req = httpMock.expectOne(`${environment.serverUrl}/api/v1/servers`);
      req.error(new ProgressEvent('error'));
      fixture.detectChanges();
    });

    it('should still switch to custom-URL mode so the user can type an address', () => {
      expect(component.useCustom).toBeTrue();
    });
  });
});
