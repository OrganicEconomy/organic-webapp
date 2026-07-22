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
    expect(component.dataSource[0].source).toBe('Alice');
  });
});
