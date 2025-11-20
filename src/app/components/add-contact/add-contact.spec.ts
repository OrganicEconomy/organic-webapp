import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddContact } from './add-contact';

describe('AddContact', () => {
  let component: AddContact;
  let fixture: ComponentFixture<AddContact>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddContact]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddContact);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
