import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Contacts } from './contacts';
import { ConnectedUserService } from '../../services/connected-user.service';

function contactNamed(name: string) {
  return { name, pk: `pk-${name}`, url: 'https://trifouillis.fr', type: 'citizen' };
}

describe('Contacts', () => {
  let component: Contacts;
  let fixture: ComponentFixture<Contacts>;
  let account: { name: string; contacts: ReturnType<typeof contactNamed>[] };

  beforeEach(async () => {
    account = { name: 'Hugo Ménard', contacts: [] };
    await TestBed.configureTestingModule({
      imports: [Contacts],
      providers: [
        provideRouter([]),
        {
          provide: ConnectedUserService,
          useValue: { getConnectedUser: () => account, getSecretKey: () => '' },
        },
      ],
    })
    .compileComponents();
  });

  function createComponent() {
    fixture = TestBed.createComponent(Contacts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();

    expect(component).toBeTruthy();
  });

  describe('visibleContacts', () => {
    it('should sort the contacts by name, ignoring case and accents', () => {
      account.contacts = ['fanny', 'Émile', 'Zoé', 'denis'].map(contactNamed);
      createComponent();

      expect(component.visibleContacts().map((contact) => contact.name)).toEqual([
        'denis',
        'Émile',
        'fanny',
        'Zoé',
      ]);
    });

    it('should keep only the contacts whose name contains the search, ignoring case and accents', () => {
      account.contacts = ['fanny', 'Émile', 'Rémi', 'denis'].map(contactNamed);
      createComponent();

      component.search.set('EMI');

      expect(component.visibleContacts().map((contact) => contact.name)).toEqual(['Émile', 'Rémi']);
    });
  });

  describe('exportContacts', () => {
    afterEach(() => jasmine.clock().uninstall());

    it('should download a file named after the user and the day', () => {
      account.contacts = ['fanny'].map(contactNamed);
      createComponent();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 10, 6, 23, 30));
      let downloadedFileName = '';
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });

      component.exportContacts();

      expect(downloadedFileName).toBe('contacts-hugo-menard-2026-11-06.json');
    });
  });

  describe('template', () => {
    it('should say that no contact matches the search', () => {
      account.contacts = ['fanny'].map(contactNamed);
      createComponent();

      component.search.set('zoé');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.no-match').textContent).toContain(
        'Aucun contact ne correspond à « zoé ».',
      );
    });

    it('should not offer to export an empty contact list', () => {
      createComponent();

      expect(fixture.nativeElement.querySelector('.export-contacts').disabled).toBeTrue();
    });
  });
});
