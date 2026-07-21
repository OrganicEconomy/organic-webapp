import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';
import { ConnectedUserService } from '../../services/connected-user.service';

// A minimal stand-in for a logged-in account — this component (like Pay,
// Contacts) has always assumed getConnectedUser() is non-null; it's not this
// step's job to add a real null-guard (that belongs to its Phase 1 rewrite).
const stubConnectedUserService = {
  getConnectedUser: () => ({
    name: 'Test',
    contacts: [],
    blockchain: {
      getMyPublicKey: () => 'pk',
      getAvailableMoneyAmount: () => 0,
      getLevel: () => 1,
      getMoneyBeforeNextLevel: () => 0,
    },
  }),
  getSecretKey: () => '',
}

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
