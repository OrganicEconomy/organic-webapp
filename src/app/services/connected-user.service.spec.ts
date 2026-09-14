import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConnectedUserService } from './connected-user.service';
import { makeDefaultAccount } from '../models/account';

const SERVER_URL = 'https://trifouillis.fr';
const MINE_URL = `${SERVER_URL}/api/v1/ecosystems/mine`;

describe('ConnectedUserService', () => {
  let service: ConnectedUserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConnectedUserService);
    httpMock = TestBed.inject(HttpTestingController);
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

  it('should not touch lastSavedBlockSignature for a brand new account with no blocks yet', () => {
    const account: any = makeDefaultAccount('pk-empty')
    service.setConnectedUser(account, 'sk')

    expect(service.getConnectedUser().lastSavedBlockSignature).toBeNull()
  });

  it('should initialize lastSavedBlockSignature from the current chain when unset (first load after register/login)', () => {
    const account: any = makeDefaultAccount('pk-3')
    account.blocks = [{ v: 1, d: 20260101, p: 'c1a551ca1c0deea5efea51b1e1dea112ed1dea0a5150f5e11ab1e50c1a15eed5', s: 'pk-3', r: '', m: '', i: '', t: 3, e: 1, h: 'sig-init', x: [] }]
    service.setConnectedUser(account, 'sk')

    expect(service.getConnectedUser().lastSavedBlockSignature).toBe('sig-init')
  });

  it('should not overwrite an already-known lastSavedBlockSignature on a later load', () => {
    const account: any = makeDefaultAccount('pk-4')
    account.blocks = [{ v: 1, d: 20260101, p: 'c1a551ca1c0deea5efea51b1e1dea112ed1dea0a5150f5e11ab1e50c1a15eed5', s: 'pk-4', r: '', m: '', i: '', t: 3, e: 1, h: 'sig-init', x: [] }]
    account.lastSavedBlockSignature = 'sig-already-known'
    service.setConnectedUser(account, 'sk')

    expect(service.getConnectedUser().lastSavedBlockSignature).toBe('sig-already-known')
  });

  it('should not be read-only by default', () => {
    expect(service.isReadOnlySession()).toBeFalse();
  });

  it('should become read-only after setReadOnly()', () => {
    service.setReadOnly();
    expect(service.isReadOnlySession()).toBeTrue();
  });

  describe('refreshing myEcosystems on connect', () => {
    it('should fetch and store the ecosystems the connecting user has a role in', () => {
      const account: any = makeDefaultAccount('pk-eco')
      account.serverUrl = SERVER_URL
      service.setConnectedUser(account, 'sk')

      const req = httpMock.expectOne((r) => r.url === MINE_URL)
      req.flush([{ publickey: 'eco-pk', name: 'Boulangerie', role: 'actor' }])

      expect(service.getConnectedUser().myEcosystems).toEqual([
        { publickey: 'eco-pk', name: 'Boulangerie', role: 'actor' },
      ])
    });

    it('should keep the previously cached list if the refresh fails', () => {
      const account: any = makeDefaultAccount('pk-eco-2')
      account.serverUrl = SERVER_URL
      account.myEcosystems = [{ publickey: 'old-pk', name: 'Old', role: 'admin' }]
      service.setConnectedUser(account, 'sk')

      httpMock.expectOne((r) => r.url === MINE_URL).error(new ProgressEvent('network error'))

      expect(service.getConnectedUser().myEcosystems).toEqual([
        { publickey: 'old-pk', name: 'Old', role: 'admin' },
      ])
    });
  });
});
