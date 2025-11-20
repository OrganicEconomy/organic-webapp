import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashPayment } from './cash-payment';

describe('CashPayment', () => {
  let component: CashPayment;
  let fixture: ComponentFixture<CashPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
