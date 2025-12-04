import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserSelection } from './user-selection';

describe('UserSelection', () => {
  let component: UserSelection;
  let fixture: ComponentFixture<UserSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSelection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserSelection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
