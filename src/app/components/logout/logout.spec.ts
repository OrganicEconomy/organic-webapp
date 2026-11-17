import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Logout } from './logout';
import { ConnectedUserService } from '../../services/connected-user.service';

describe('Logout', () => {
  describe('constructor', () => {
    it('should forget the connected account, then open the account choice', async () => {
      const disconnect = jasmine.createSpy('disconnect');
      await TestBed.configureTestingModule({
        imports: [Logout],
        providers: [provideRouter([]), { provide: ConnectedUserService, useValue: { disconnect } }],
      }).compileComponents();
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      TestBed.createComponent(Logout);

      expect(disconnect).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/user-selection']);
    });
  });
});
