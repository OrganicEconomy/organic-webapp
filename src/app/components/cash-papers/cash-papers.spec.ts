import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashPapers } from './cash-papers';

describe('CashPapers', () => {
  let component: CashPapers;
  let fixture: ComponentFixture<CashPapers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashPapers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashPapers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
