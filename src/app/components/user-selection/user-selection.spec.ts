import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

import { UserSelection } from './user-selection';

describe('UserSelection', () => {
  let component: UserSelection;
  let fixture: ComponentFixture<UserSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        UserSelection,
        RouterTestingModule,
        NoopAnimationsModule,
        MatDialogModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatListModule,
      ]
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
