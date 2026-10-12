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

  function flushInfo(baseUrl: string, name = 'Un serveur', users = 42) {
    httpMock.expectOne(`${baseUrl}/api/v1/info`).flush({
      protocolVersion: 1, apiVersion: '1', name, serverPk: 'pk', corePk: null, stats: { users },
    });
    fixture.detectChanges();
  }

  function failInfo(baseUrl: string) {
    httpMock.expectOne(`${baseUrl}/api/v1/info`).error(new ProgressEvent('error'));
    fixture.detectChanges();
  }

  function getElement(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function getAllElements(selector: string): HTMLElement[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(selector));
  }

  function click(selector: string) {
    (getElement(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function rowNames(): string[] {
    return getAllElements('.server-list .server-name')
      .map(row => row.textContent!.trim());
  }

  function clickRow(name: string) {
    const row = getAllElements('.server-list .server-row')
      .find(button => button.textContent!.includes(name));
    expect(row).toBeDefined();
    row!.click();
    fixture.detectChanges();
  }

  function actionLabels(): string[] {
    return getAllElements('.chosen-actions button')
      .map(button => button.textContent!.trim());
  }

  function goBack() {
    click('.use-list-link');
  }

  describe('with several known servers', () => {
    beforeEach(() => {
      flushKnownServers([
        { name: 'Serveur de Trifouillis', url: 'https://trifouillis.fr' },
        { name: 'Orga Bretagne', url: 'https://orga-bzh.fr' },
      ]);
    });

    it('should list the servers without picking one or contacting any', () => {
      expect(component.step).toBe('choose');
      expect(component.selectedServerUrl).toBe('');
      expect(rowNames()).toEqual(['Serveur de Trifouillis', 'Orga Bretagne']);
      expect(getElement('.chosen-server')).toBeFalsy();
      httpMock.expectNone(() => true);
    });

    it('should not offer account actions before a server is picked', () => {
      expect(getElement('.chosen-actions')).toBeFalsy();
    });

    it('should offer "Utiliser une autre adresse" under the list', () => {
      expect(getElement('.use-custom-link')?.textContent).toContain('Utiliser une autre adresse');
    });

    it('should check the picked server straight away and swap the list for its card', () => {
      clickRow('Orga Bretagne');

      expect(component.step).toBe('verify');
      expect(getElement('.server-list')).toBeFalsy();
      expect(getElement('.chosen-name')!.textContent).toContain('Orga Bretagne');
      expect(getElement('.checking')).toBeTruthy();

      flushInfo('https://orga-bzh.fr', 'Orga Bretagne', 5);

      expect(getElement('.checking')).toBeFalsy();
      expect(getElement('.verified')!.textContent).toContain('5 citoyens');
      expect(getElement('.verified')!.textContent).toContain('protocole v1');
    });

    it('should normalize the picked server URL', () => {
      component.selectServer({ name: 'Orga Bretagne', url: 'orga-bzh.fr/' });
      fixture.detectChanges();

      expect(component.selectedServerUrl).toBe('https://orga-bzh.fr');
      flushInfo('https://orga-bzh.fr');
    });

    it('should show an error under the list when the picked server URL is invalid', () => {
      component.selectServer({ name: 'Cassé', url: '' });
      fixture.detectChanges();

      expect(component.step).toBe('choose');
      expect(rowNames().length).toBe(2);
      expect(getElement('.error')).toBeTruthy();
    });

    it('should drop the invalid URL error once another server is picked', () => {
      component.selectServer({ name: 'Cassé', url: '' });
      fixture.detectChanges();

      clickRow('Orga Bretagne');
      flushInfo('https://orga-bzh.fr');

      expect(getElement('.error')).toBeFalsy();
    });

    it('should show the account actions on the card once the check succeeded', () => {
      clickRow('Orga Bretagne');
      expect(actionLabels()).toEqual([]);

      flushInfo('https://orga-bzh.fr');

      expect(actionLabels()).toEqual(['Créer mon compte', 'Restaurer mon compte']);
    });

    it('should not repeat the server name when it is the one the list gives', () => {
      clickRow('Orga Bretagne');
      flushInfo('https://orga-bzh.fr', 'Orga Bretagne');

      expect(getElement('.verified')!.textContent).not.toContain('«');
    });

    it('should show the name the server reports when it differs from the list', () => {
      clickRow('Orga Bretagne');
      flushInfo('https://orga-bzh.fr', 'Bretagne Orga Officielle');

      expect(getElement('.verified')!.textContent).toContain('« Bretagne Orga Officielle »');
    });

    it('should show an error and a retry, but no account actions, when the server is unreachable', () => {
      clickRow('Orga Bretagne');
      failInfo('https://orga-bzh.fr');

      expect(component.verifiedInfo).toBeNull();
      expect(getElement('.status.error')).toBeTruthy();
      expect(getElement('.chosen-actions')).toBeFalsy();
      expect(getElement('.checking')).toBeFalsy();
    });

    it('should retry the check from the error state', () => {
      clickRow('Orga Bretagne');
      failInfo('https://orga-bzh.fr');

      const retry = getAllElements('.chosen-server button')
        .find(button => button.textContent!.includes('Réessayer'))!;
      retry.click();
      fixture.detectChanges();
      flushInfo('https://orga-bzh.fr');

      expect(component.error).toBe('');
      expect(getElement('.verified')).toBeTruthy();
    });

    it('should offer "Revenir à la liste" on the card', () => {
      clickRow('Orga Bretagne');
      flushInfo('https://orga-bzh.fr');

      expect(getElement('.use-list-link')!.textContent).toContain('Revenir à la liste');
    });

    it('should go back to the list, dropping the previous selection and outcome', () => {
      clickRow('Orga Bretagne');
      flushInfo('https://orga-bzh.fr');

      goBack();

      expect(component.step).toBe('choose');
      expect(component.useCustom).toBeFalse();
      expect(component.verifiedInfo).toBeNull();
      expect(component.selectedServerUrl).toBe('');
      expect(component.selectedServerName).toBe('');
      expect(rowNames().length).toBe(2);
      expect(getElement('.chosen-server')).toBeFalsy();
    });

    it('should cancel the pending check when the user goes back', () => {
      clickRow('Orga Bretagne');
      const pending = httpMock.expectOne('https://orga-bzh.fr/api/v1/info');

      goBack();

      expect(pending.cancelled).toBeTrue();
      expect(component.verifying).toBeFalse();
    });

    it('should ignore a slow answer from a server picked earlier', () => {
      clickRow('Orga Bretagne');
      const first = httpMock.expectOne('https://orga-bzh.fr/api/v1/info');

      goBack();
      clickRow('Trifouillis');
      flushInfo('https://trifouillis.fr', 'Serveur de Trifouillis', 7);

      expect(first.cancelled).toBeTrue();
      expect(component.verifiedInfo?.stats.users).toBe(7);
    });

    it('should cancel the pending check when the component is destroyed', () => {
      clickRow('Orga Bretagne');
      const pending = httpMock.expectOne('https://orga-bzh.fr/api/v1/info');

      fixture.destroy();

      expect(pending.cancelled).toBeTrue();
    });

    it('should navigate to /signup on createAccount, with the chosen server as a query param', () => {
      const navigateSpy = spyOn(router, 'navigate');
      clickRow('Serveur de Trifouillis');
      flushInfo('https://trifouillis.fr');

      component.createAccount();

      expect(navigateSpy).toHaveBeenCalledWith(['/signup'], { queryParams: { server: 'https://trifouillis.fr' } });
    });

    it('should navigate to /restore-account on restoreAccount, with the chosen server as a query param', () => {
      const navigateSpy = spyOn(router, 'navigate');
      clickRow('Serveur de Trifouillis');
      flushInfo('https://trifouillis.fr');

      component.restoreAccount();

      expect(navigateSpy).toHaveBeenCalledWith(['/restore-account'], { queryParams: { server: 'https://trifouillis.fr' } });
    });
  });

  describe('with a single known server', () => {
    beforeEach(() => {
      flushKnownServers([{ name: 'Serveur de Trifouillis', url: 'https://trifouillis.fr' }]);
    });

    it('should pick and check it without any click', () => {
      expect(component.step).toBe('verify');
      expect(component.selectedServerUrl).toBe('https://trifouillis.fr');
      expect(getElement('.chosen-name')!.textContent).toContain('Serveur de Trifouillis');

      flushInfo('https://trifouillis.fr', 'Serveur de Trifouillis', 42);

      expect(component.verifiedInfo?.stats.users).toBe(42);
      expect(actionLabels()).toEqual(['Créer mon compte', 'Restaurer mon compte']);
    });

    it('should still let the user leave it for the list', () => {
      flushInfo('https://trifouillis.fr');

      goBack();

      expect(rowNames()).toEqual(['Serveur de Trifouillis']);
      expect(getElement('.use-custom-link')).toBeTruthy();
    });
  });

  describe('with the custom address', () => {
    beforeEach(() => {
      flushKnownServers([
        { name: 'Serveur de Trifouillis', url: 'https://trifouillis.fr' },
        { name: 'Orga Bretagne', url: 'https://orga-bzh.fr' },
      ]);
      click('.use-custom-link');
    });

    function type(value: string) {
      component.customUrl = value;
      fixture.detectChanges();
    }

    function submit(value: string) {
      type(value);
      component.submitCustom();
      fixture.detectChanges();
    }

    it('should reveal the address field and hide the list when "Utiliser une autre adresse" is clicked', () => {
      expect(component.useCustom).toBeTrue();
      expect(getElement('input[type="text"]')).toBeTruthy();
      expect(getElement('.server-list')).toBeFalsy();
    });

    it('should not check anything while the user is typing', () => {
      type('orga-bzh');

      expect(component.step).toBe('choose');
      httpMock.expectNone(() => true);
    });

    it('should normalize the address (adds https://, strips trailing slash) and check it', () => {
      submit('orga-bzh.fr/');

      expect(component.selectedServerUrl).toBe('https://orga-bzh.fr');
      expect(component.step).toBe('verify');
      flushInfo('https://orga-bzh.fr', 'Orga Bretagne', 5);
      expect(component.verifiedInfo?.name).toBe('Orga Bretagne');
    });

    it('should submit on Enter', () => {
      type('orga-bzh.fr');

      const input = getElement('input[type="text"]')!;
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      fixture.detectChanges();

      expect(component.step).toBe('verify');
      flushInfo('https://orga-bzh.fr');
    });

    it('should show the typed address on the card, then its account actions', () => {
      submit('mon-serveur.example.org');
      flushInfo('https://mon-serveur.example.org');

      expect(getElement('.chosen-name')!.textContent).toContain('https://mon-serveur.example.org');
      expect(actionLabels()).toEqual(['Créer mon compte', 'Restaurer mon compte']);
    });

    it('should show the name the server reports next to the typed address', () => {
      submit('orga-bzh.fr');
      flushInfo('https://orga-bzh.fr', 'Orga Bretagne');

      expect(getElement('.chosen-name')!.textContent).toContain('https://orga-bzh.fr');
      expect(getElement('.verified')!.textContent).toContain('« Orga Bretagne »');
    });

    it('should reject an invalid address without making a request, staying on the field', () => {
      submit('');

      expect(component.step).toBe('choose');
      expect(component.error).toBeTruthy();
      expect(getElement('.error')).toBeTruthy();
    });

    it('should disable "Vérifier" while the field is empty', () => {
      type('   ');

      const verify = getElement('button.full-width') as HTMLButtonElement;

      expect(verify.textContent).toContain('Vérifier');
      expect(verify.disabled).toBeTrue();
    });

    it('should go back to the list with "Revenir à la liste"', () => {
      goBack();

      expect(component.useCustom).toBeFalse();
      expect(rowNames().length).toBe(2);
    });

    it('should offer "Retour" on the card of a typed address', () => {
      submit('orga-bzh.fr');
      flushInfo('https://orga-bzh.fr');

      expect(getElement('.use-list-link')!.textContent).toContain('Retour');
      expect(getElement('.use-list-link')!.textContent).not.toContain('liste');
    });

    it('should come back to the address field, not the list, from the card of a typed address', async () => {
      submit('orga-bzh.fr');
      flushInfo('https://orga-bzh.fr');

      goBack();
      await fixture.whenStable();

      expect(component.step).toBe('choose');
      expect(component.useCustom).toBeTrue();
      expect(getElement('.server-list')).toBeFalsy();
      expect((getElement('input[type="text"]') as HTMLInputElement).value).toBe('orga-bzh.fr');
    });
  });

  describe('with a long known-servers list', () => {
    const servers = [
      { name: 'Orga Bretagne', url: 'https://orga-bzh.fr' },
      { name: 'Serveur de Trifouillis', url: 'https://trifouillis.fr' },
      { name: 'Économie Lyonnaise', url: 'https://lyon.example.org' },
      { name: 'Monnaie du Quercy', url: 'https://quercy.example.org' },
      { name: 'Les Voisins de Nantes', url: 'https://nantes.example.org' },
      { name: 'Clocher de Lille', url: 'https://lille.example.org' },
      { name: 'Communauté du Périgord', url: 'https://perigord.example.org' },
    ];

    function search(query: string) {
      component.onSearchChange(query);
      fixture.detectChanges();
    }

    beforeEach(() => {
      flushKnownServers(servers);
    });

    it('should show the search box once the list is longer than the visible rows', () => {
      expect(servers.length).toBeGreaterThan(component.visibleRows);
      expect(getElement('input[type="search"]')).toBeTruthy();
    });

    it('should make the list scrollable at the same row count', () => {
      const list = getElement('.server-list')!;

      expect(list.style.getPropertyValue('--visible-rows-count')).toBe(String(component.visibleRows));
      expect(getComputedStyle(list).overflowY).toBe('auto');
    });

    it('should list every server when the search is empty', () => {
      expect(rowNames().length).toBe(servers.length);
    });

    it('should filter as the user types in the search box', () => {
      const input = getElement('input[type="search"]') as HTMLInputElement;
      input.value = 'quercy';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(rowNames()).toEqual(['Monnaie du Quercy']);
    });

    it('should match regardless of case', () => {
      search('TRIFOUILLIS');

      expect(rowNames()).toEqual(['Serveur de Trifouillis']);
    });

    it('should match regardless of accents, in both directions', () => {
      search('perigord');
      expect(rowNames()).toEqual(['Communauté du Périgord']);

      search('ÉCONOMIE');
      expect(rowNames()).toEqual(['Économie Lyonnaise']);
    });

    it('should match on the URL as well as the name', () => {
      search('bzh');

      expect(rowNames()).toEqual(['Orga Bretagne']);
    });

    it('should match words in any order', () => {
      search('nantes voisins');

      expect(rowNames()).toEqual(['Les Voisins de Nantes']);
    });

    it('should ignore extra whitespace', () => {
      search('  clocher   lille ');

      expect(rowNames()).toEqual(['Clocher de Lille']);
    });

    it('should only show the clear button while there is a query', () => {
      expect(getElement('[aria-label="Effacer la recherche"]')).toBeFalsy();

      search('lille');

      expect(getElement('[aria-label="Effacer la recherche"]')).toBeTruthy();
    });

    it('should show everything again once the search is cleared', () => {
      search('lille');

      click('[aria-label="Effacer la recherche"]');

      expect(component.searchQuery).toBe('');
      expect(rowNames().length).toBe(servers.length);
    });

    it('should keep the filter when the user comes back from a picked server', () => {
      search('lille');
      clickRow('Clocher de Lille');
      flushInfo('https://lille.example.org');

      goBack();

      expect(rowNames()).toEqual(['Clocher de Lille']);
    });

    it('should show a message when nothing matches, and still offer the custom address', () => {
      search('zzz');

      expect(rowNames().length).toBe(0);
      expect(getElement('.no-match')!.textContent).toContain('zzz');
      expect(getElement('.use-custom-link')).toBeTruthy();
    });
  });

  describe('with a list that fits without scrolling', () => {
    it('should not show the search box', () => {
      flushKnownServers(Array.from({ length: component.visibleRows }, (_, i) => ({ name: `Serveur ${i}`, url: `https://s${i}.example.org` })));

      expect(getElement('input[type="search"]')).toBeFalsy();
      expect(rowNames().length).toBe(component.visibleRows);
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
      expect(getElement('input[type="text"]')).toBeTruthy();
      expect(getElement('.server-list')).toBeFalsy();
      expect(getElement('.admin-hint')).toBeTruthy();
    });

    it('should not offer to go back to a list that does not exist', () => {
      expect(getElement('.use-list-link')).toBeFalsy();
    });

    it('should land on the address field again when going back from the card', () => {
      component.customUrl = 'orga-bzh.fr';
      component.submitCustom();
      fixture.detectChanges();
      flushInfo('https://orga-bzh.fr');

      goBack();

      expect(component.useCustom).toBeTrue();
      expect(getElement('input[type="text"]')).toBeTruthy();
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
      expect(getElement('input[type="text"]')).toBeTruthy();
      expect(getElement('.admin-hint')).toBeTruthy();
    });
  });
});
