import { TestBed } from '@angular/core/testing';

import { ConnectedUserService } from './connected-user.service';
import { makeDefaultAccount } from '../models/account';

describe('ConnectedUserService', () => {
  let service: ConnectedUserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConnectedUserService);
  });

  it('should hold the decrypted secret key in memory alongside the account', () => {
    const account: any = makeDefaultAccount('pk-1')
    service.setConnectedUser(account, 'decrypted-sk-hex')

    expect(service.getConnectedUser().publickey).toBe('pk-1')
    expect(service.getSecretKey()).toBe('decrypted-sk-hex')
  });

  it('should attach a live CitizenBlockchain instance to the account', () => {
    const account: any = makeDefaultAccount('pk-2')
    service.setConnectedUser(account, 'sk')

    expect(typeof service.getConnectedUser().blockchain.getMyPublicKey).toBe('function')
  });

  it('should not be read-only by default', () => {
    expect(service.isReadOnlySession()).toBeFalse();
  });

  it('should become read-only after setReadOnly()', () => {
    service.setReadOnly();
    expect(service.isReadOnlySession()).toBeTrue();
  });
});
