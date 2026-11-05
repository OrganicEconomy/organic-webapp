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
  let account: { contacts: ReturnType<typeof contactNamed>[] };

  beforeEach(async () => {
    account = { contacts: [] };
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
  });
});
