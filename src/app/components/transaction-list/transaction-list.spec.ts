import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TransactionList } from './transaction-list';
import { ConnectedUserService } from '../../services/connected-user.service';

const MY_PK = 'my-pk';
let fakeAccount: any;
let stubConnectedUserService: any;

describe('TransactionList', () => {
  let component: TransactionList;
  let fixture: ComponentFixture<TransactionList>;

  beforeEach(async () => {
    fakeAccount = {
      contacts: [{ pk: 'alice-pk', name: 'Alice' }],
      blockchain: {
        getMyPublicKey: () => MY_PK,
        getHistory: () => [
          { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: MY_PK, money: [1, 2, 3], invests: [] },
        ],
      },
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
    };

    await TestBed.configureTestingModule({
      imports: [TransactionList],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read the source contact from tx.signer, not the nonexistent tx.source', () => {
    expect(component.rows[0].parties?.source.label).toBe('Alice');
  });

  it('should show only once an engagement that each new block carries over', () => {
    const engagement = { date: new Date(2026, 0, 10), type: 4, signer: MY_PK, target: 'eco-pk', money: [], invests: [1, 2], signature: 'engagement-signature' };
    fakeAccount.blockchain.getHistory = () => [engagement, { ...engagement }];

    const list = TestBed.createComponent(TransactionList).componentInstance;

    expect(list.rows.length).toBe(1);
  });

  it('should name an ecosystem of mine even when it is not among the contacts', () => {
    const ecosystemKey = '02' + 'cd'.repeat(32);
    fakeAccount.myEcosystems = [{ publickey: ecosystemKey, name: 'La Boulange', role: 'actor' }];
    fakeAccount.blockchain.getHistory = () => [
      { date: new Date(2026, 0, 16), type: 4, signer: MY_PK, target: ecosystemKey, money: [], invests: [1] },
    ];

    const list = TestBed.createComponent(TransactionList).componentInstance;

    expect(list.rows[0].parties?.target.label).toBe('La Boulange');
  });

  describe('typeChoices', () => {
    it('should offer once each type found in the history', () => {
      fakeAccount.blockchain.getHistory = () => [
        { date: new Date(2026, 0, 17), type: 3, signer: 'alice-pk', target: MY_PK, money: [1], invests: [], signature: 'a' },
        { date: new Date(2026, 0, 16), type: 2, signer: MY_PK, target: '', money: [1], invests: [1], signature: 'b' },
        { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: MY_PK, money: [1], invests: [], signature: 'c' },
      ];

      const list = TestBed.createComponent(TransactionList).componentInstance;

      expect(list.typeChoices).toEqual(['Paiement', 'Création du jour']);
    });
  });

  describe('entries', () => {
    it('should keep only the rows that match the search', () => {
      component.search.set('alice');
      expect(component.entries().length).toBe(2);

      component.search.set('bob');
      expect(component.entries()).toEqual([]);
    });

    it('should keep only the rows of the chosen type', () => {
      component.chosenType.set('Création du jour');
      expect(component.entries()).toEqual([]);

      component.chosenType.set('Paiement');
      expect(component.entries().length).toBe(2);
    });
  });

  describe('template', () => {
    it('should show each row with the icon of its kind and its signed amounts', () => {
      const card: HTMLElement = fixture.nativeElement.querySelector('.mobile-list .tx-card');

      expect(card.querySelector('i.bi-arrow-down-left')?.getAttribute('aria-hidden')).toBe('true');
      expect(card.querySelector('app-transaction-amounts')?.textContent).toContain('+3 XP');
    });

    it('should keep the column headers stuck on top while the rows scroll', () => {
      const header: HTMLElement = fixture.nativeElement.querySelector('.desktop-table th');

      expect(getComputedStyle(header).position).toBe('sticky');
    });

    it('should scroll the rows in their own area, leaving the title in place', () => {
      const rows: HTMLElement = fixture.nativeElement.querySelector('.history-rows');

      expect(getComputedStyle(rows).overflowY).toBe('auto');
      expect(rows.querySelector('.mobile-list')).not.toBeNull();
      expect(rows.querySelector('.desktop-table')).not.toBeNull();
      expect(rows.querySelector('h1')).toBeNull();
    });

    it('should say that there is no transaction yet, on every screen size', () => {
      fakeAccount.blockchain.getHistory = () => [];
      fixture = TestBed.createComponent(TransactionList);
      fixture.detectChanges();

      const emptyMessage: HTMLElement = fixture.nativeElement.querySelector('.empty');
      expect(emptyMessage.textContent).toContain('Aucune transaction.');
      expect(emptyMessage.closest('.mobile-list')).toBeNull();
    });

    it('should name the month above its rows, on every screen size', () => {
      const headings = Array.from(fixture.nativeElement.querySelectorAll('.month-heading') as NodeListOf<HTMLElement>)
        .map((heading) => heading.textContent?.trim());

      expect(headings).toEqual(['janvier 2026', 'janvier 2026']);
    });

    it('should say that no transaction matches the search', () => {
      component.search.set('bob');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty')?.textContent).toContain('Aucune transaction ne correspond à la recherche.');
    });

    it('should lead back to the payments', () => {
      const backLink = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>)
        .find((link) => link.textContent?.includes('Retour'));

      expect(backLink?.getAttribute('href')).toBe('/pay');
    });

    it('should show the whole key of an unknown party once it is touched', () => {
      const unknownKey = '03' + 'ab'.repeat(32);
      fakeAccount.blockchain.getHistory = () => [
        { date: new Date(2026, 0, 16), type: 3, signer: unknownKey, target: MY_PK, money: [1] },
      ];
      fixture = TestBed.createComponent(TransactionList);
      fixture.detectChanges();

      const abbreviatedKey: HTMLElement = fixture.nativeElement.querySelector('.mobile-list .party-key summary');
      abbreviatedKey.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.mobile-list .party-key[open]')?.textContent).toContain(unknownKey);
    });

    it('should show in the desktop table the whole key of an unknown party once it is touched', () => {
      const unknownKey = '03' + 'ab'.repeat(32);
      fakeAccount.blockchain.getHistory = () => [
        { date: new Date(2026, 0, 16), type: 3, signer: unknownKey, target: MY_PK, money: [1] },
      ];
      fixture = TestBed.createComponent(TransactionList);
      fixture.detectChanges();

      const abbreviatedKey: HTMLElement = fixture.nativeElement.querySelector('.desktop-table .party-key summary');
      abbreviatedKey.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.desktop-table .party-key[open]')?.textContent).toContain(unknownKey);
    });

    it('should leave the desktop sender and receiver cells empty for the daily creation', () => {
      fakeAccount.blockchain.getHistory = () => [
        { date: new Date(2026, 0, 16), type: 2, signer: MY_PK, target: '', money: [1], invests: [] },
      ];
      fixture = TestBed.createComponent(TransactionList);
      fixture.detectChanges();

      const cells = fixture.nativeElement.querySelectorAll('.desktop-table .transaction-row td');
      expect(cells[2].textContent.trim()).toBe('');
      expect(cells[3].textContent.trim()).toBe('');
    });
  });
});
