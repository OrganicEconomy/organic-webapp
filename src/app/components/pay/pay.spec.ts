import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pay } from './pay';

describe('Pay', () => {
  let component: Pay;
  let fixture: ComponentFixture<Pay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Pay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
