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
          { date: new Date(2026, 0, 15), type: 3, signer: 'alice-pk', target: MY_PK, money: [1, 2, 3] },
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
    expect(component.dataSource[0].parties?.source.label).toBe('Alice');
  });

  describe('template', () => {
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
  });
});
