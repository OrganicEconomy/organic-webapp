import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Pay } from './pay';
import { ConnectedUserService } from '../../services/connected-user.service';

// Minimal stand-in for a logged-in account — see home.spec.ts for context.
const stubConnectedUserService = {
  getConnectedUser: () => ({
    contacts: [],
    blockchain: {
      getMyPublicKey: () => 'pk',
      getAvailableMoneyAmount: () => 0,
    },
  }),
  getSecretKey: () => '',
}

describe('Pay', () => {
  let component: Pay;
  let fixture: ComponentFixture<Pay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pay],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
      ],
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
