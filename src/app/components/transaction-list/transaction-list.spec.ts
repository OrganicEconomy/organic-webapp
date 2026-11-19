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

  it('should show the newest rows first, even an engagement carried over with its old date', () => {
    fakeAccount.blockchain.getHistory = () => [
      { date: new Date(2026, 10, 2), type: 3, signer: MY_PK, target: 'alice-pk', money: [1], invests: [], signature: 'november' },
      { date: new Date(2026, 8, 25), type: 4, signer: MY_PK, target: 'eco-pk', money: [], invests: [1], signature: 'engagement' },
      { date: new Date(2026, 9, 20), type: 3, signer: MY_PK, target: 'alice-pk', money: [1], invests: [], signature: 'october' },
      { date: new Date(2026, 8, 25), type: 4, signer: MY_PK, target: 'eco-pk', money: [], invests: [1], signature: 'engagement' },
    ];

    const list = TestBed.createComponent(TransactionList).componentInstance;

    expect(list.rows.map((row) => row.month)).toEqual(['novembre 2026', 'octobre 2026', 'septembre 2026']);
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
      expect(component.entries()).toEqual([
        { heading: 'janvier 2026' },
        jasmine.objectContaining({ label: 'Paiement' }),
      ]);

      component.search.set('bob');
      expect(component.entries()).toEqual([]);
    });

    it('should keep only the rows of the chosen type', () => {
      component.chosenType.set('Création du jour');
      expect(component.entries()).toEqual([]);

      component.chosenType.set('Paiement');
      expect(component.entries()).toEqual([
        { heading: 'janvier 2026' },
        jasmine.objectContaining({ label: 'Paiement' }),
      ]);
    });
  });

  describe('template', () => {
    it('should show each row with the icon of its kind and its amounts', () => {
      const card: HTMLElement = fixture.nativeElement.querySelector('.mobile-list .transaction-card');

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
      const desktopHeading: HTMLElement = fixture.nativeElement.querySelector('.desktop-table .month-heading');
      const mobileHeading: HTMLElement = fixture.nativeElement.querySelector('.mobile-list .month-heading');

      expect(desktopHeading.textContent?.trim()).toBe('janvier 2026');
      expect(mobileHeading.textContent?.trim()).toBe('janvier 2026');
    });

    it('should say that no transaction matches the search', () => {
      component.search.set('bob');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty')?.textContent).toContain('Aucune transaction ne correspond à la recherche.');
    });

    it('should announce the month of the desktop table as a heading', () => {
      const heading: HTMLElement = fixture.nativeElement.querySelector('.desktop-table .month-heading [role]');

      expect(heading.getAttribute('role')).toBe('heading');
      expect(heading.getAttribute('aria-level')).toBe('2');
    });

    it('should show that every type is shown until one is chosen', async () => {
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.history-filters mat-select').textContent).toContain('Tous les types');
    });

    it('should show on its row, in the table and in the list, what an engagement holds back', () => {
      const oneADayForTwoDays = [202601169000, 202601179000];
      fakeAccount.blockchain.getHistory = () => [
        { date: new Date(2026, 0, 16), type: 4, signer: MY_PK, target: 'eco-pk', money: [], invests: oneADayForTwoDays },
      ];

      const list = TestBed.createComponent(TransactionList);
      list.detectChanges();

      const shownAmounts = Array.from(list.nativeElement.querySelectorAll('app-transaction-amounts') as NodeListOf<HTMLElement>);
      expect(shownAmounts.map((amounts) => amounts.textContent?.trim())).toEqual([
        '1 investissement/jour pendant 2 jours',
        '1 investissement/jour pendant 2 jours',
      ]);
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
