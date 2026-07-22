import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { decodeQr } from 'organic-protocol';

import { AccountDetails } from './account-details';
import { ConnectedUserService } from '../../services/connected-user.service';

const fakeAccount = {
  name: 'Alice',
  publickey: 'alice-pk',
  serverUrl: 'https://trifouillis.fr',
  blockchain: {
    blocks: [
      { closedate: new Date(2027, 2, 3) }, // dernier bloc (le plus récent)
      { closedate: new Date(2026, 0, 15) }, // bloc de naissance (le plus ancien)
    ],
  },
};
const stubConnectedUserService = {
  getConnectedUser: () => fakeAccount,
  getSecretKey: () => '',
};

describe('AccountDetails', () => {
  let component: AccountDetails;
  let fixture: ComponentFixture<AccountDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountDetails, RouterTestingModule],
      providers: [
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the birth block\'s close date as the inscription date', () => {
    expect(component.inscription_date).toBe(new Date(2026, 0, 15).toLocaleDateString('fr-FR'));
  });

  it('should generate a QR that decodes back to this account\'s contact card', () => {
    const decoded = decodeQr(component.myContactQr);

    expect(decoded.type).toBe('CT');
    if (decoded.type === 'CT') {
      expect(decoded.payload.pk).toBe('alice-pk');
      expect(decoded.payload.url).toBe('https://trifouillis.fr');
      expect(decoded.payload.n).toBe('Alice');
    }
  });
});
