import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CashPayment } from './cash-payment';
import { ConnectedUserService } from '../../services/connected-user.service';
import { PendingPaymentsService } from '../../services/pending-payments.service';

let fakeAccount: any;
let stubConnectedUserService: any;
let pendingSpy: jasmine.SpyObj<Pick<PendingPaymentsService, 'refresh' | 'cash'>> & { dataSource: any[] };

describe('CashPayment', () => {
  let component: CashPayment;
  let fixture: ComponentFixture<CashPayment>;

  beforeEach(() => {
    fakeAccount = { publickey: 'pk', serverUrl: 'https://trifouillis.fr', contacts: [] };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
    };
    pendingSpy = jasmine.createSpyObj('PendingPaymentsService', ['refresh', 'cash']);
    pendingSpy.dataSource = [{ hash: 'deadbeef', date: '22/07/2026', source: 'Alice', amount: 3 }];

    TestBed.configureTestingModule({
      imports: [CashPayment],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: PendingPaymentsService, useValue: pendingSpy },
      ],
    });
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(CashPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should refresh the pending payments list on load', () => {
    createComponent();
    expect(pendingSpy.refresh).toHaveBeenCalled();
  });

  it('should expose the shared service\'s dataSource', () => {
    createComponent();
    expect(component.dataSource).toBe(pendingSpy.dataSource);
  });

  it('should delegate cash() to the shared service', () => {
    createComponent();
    component.cash('deadbeef');
    expect(pendingSpy.cash).toHaveBeenCalledWith('deadbeef');
  });
});
