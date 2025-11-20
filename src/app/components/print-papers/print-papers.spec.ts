import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrintPapers } from './print-papers';

describe('PrintPapers', () => {
  let component: PrintPapers;
  let fixture: ComponentFixture<PrintPapers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrintPapers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrintPapers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
