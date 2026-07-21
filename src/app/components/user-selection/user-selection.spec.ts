import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';

import { UserSelection } from './user-selection';
import { encryptSecretKey } from '../../services/secret-key-crypto.util';

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

  it('should decrypt the secret key when the password is right', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'correct-password')
    const user: any = { publickey: 'pk', secretkey }

    const result = await component.tryUnlock(user, 'correct-password')

    expect(result).toBe('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f')
  });

  it('should return null on a wrong password, never by comparing it directly', async () => {
    const secretkey = await encryptSecretKey('ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f', 'the-real-password')
    const user: any = { publickey: 'pk', secretkey }

    const result = await component.tryUnlock(user, 'a-wrong-password')

    expect(result).toBeNull()
  });
});
