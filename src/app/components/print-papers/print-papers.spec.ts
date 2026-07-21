import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { PrintPapers } from './print-papers';

describe('PrintPapers', () => {
  let component: PrintPapers;
  let fixture: ComponentFixture<PrintPapers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrintPapers, RouterTestingModule]
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
