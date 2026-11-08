import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConnectedUserService } from './connected-user.service';
import { makeDefaultAccount } from '../models/account';
import { AccountTabsService } from './account-tabs.service';
import { LocalDatabaseService } from './local-database.service';

const SERVER_URL = 'https://trifouillis.fr';
const MINE_URL = `${SERVER_URL}/api/v1/ecosystems/mine`;
const INFO_URL = `${SERVER_URL}/api/v1/info`;

describe('ConnectedUserService', () => {
  let service: ConnectedUserService;
  let httpMock: HttpTestingController;
  let staleAccounts: Set<string>;

  beforeEach(() => {
    staleAccounts = new Set();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AccountTabsService,
          useValue: {
            isStale: (pk: string) => staleAccounts.has(pk),
            announceChange: () => {},
            takeBack: (pk: string) => staleAccounts.delete(pk),
          },
        },
      ],
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

  describe('setConnectedUser', () => {
    it('should take the account back from any other tab, since connecting loads it afresh', () => {
      staleAccounts.add('pk-reconnected');

      service.setConnectedUser(makeDefaultAccount('pk-reconnected') as any, 'sk');

      expect(service.isReadOnlySession()).toBeFalse();
    });
  });

  describe('isReadOnlySession', () => {
    it('should be read-only while another tab holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-held') as any, 'sk');
      staleAccounts.add('pk-held');

      expect(service.isReadOnlySession()).toBeTrue();
    });
  });

  describe('readOnlyMessage', () => {
    it('should name the other tab when another tab holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-tab-message') as any, 'sk');
      staleAccounts.add('pk-tab-message');

      expect(service.readOnlyMessage()).toBe("Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci.");
    });

    it('should name the other device when another device holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-device-message') as any, 'sk');
      service.setReadOnly();

      expect(service.readOnlyMessage()).toBe('Ce compte est actif sur un autre appareil — lecture seule.');
    });
  });

  describe('readOnlyReason', () => {
    it('should say that another tab took the account over', () => {
      service.setConnectedUser(makeDefaultAccount('pk-tabs') as any, 'sk');
      staleAccounts.add('pk-tabs');

      expect(service.readOnlyReason()).toBe('other-tab');
    });

    it('should say that another device took the account over', () => {
      service.setConnectedUser(makeDefaultAccount('pk-device') as any, 'sk');
      service.setReadOnly();

      expect(service.readOnlyReason()).toBe('other-device');
    });

    it('should give no reason for a session that can write', () => {
      service.setConnectedUser(makeDefaultAccount('pk-free') as any, 'sk');

      expect(service.readOnlyReason()).toBeNull();
    });
  });

  describe('useThisTab', () => {
    it('should take the account back with what the other tab stored, keeping the unlocked key', async () => {
      const pk = `pk-${Date.now()}-take-back`;
      await TestBed.inject(LocalDatabaseService).saveUser({ ...makeDefaultAccount(pk), name: 'Stored by the other tab' });
      service.setConnectedUser({ ...makeDefaultAccount(pk), name: 'Stale' } as any, 'unlocked-sk');
      staleAccounts.add(pk);

      await service.useThisTab();

      expect(service.isReadOnlySession()).toBeFalse();
      expect(service.getConnectedUser().name).toBe('Stored by the other tab');
      expect(service.getSecretKey()).toBe('unlocked-sk');
    });

    it('should leave this tab read-only when the account can no longer be read from this device', async () => {
      const pk = `pk-${Date.now()}-gone`;
      service.setConnectedUser(makeDefaultAccount(pk) as any, 'unlocked-sk');
      staleAccounts.add(pk);

      await expectAsync(service.useThisTab()).toBeRejected();
      expect(service.isReadOnlySession()).toBeTrue();
    });
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
      httpMock.expectOne((r) => r.url === INFO_URL).flush({ corePk: null })

      expect(service.getConnectedUser().myEcosystems).toEqual([
        { publickey: 'old-pk', name: 'Old', role: 'admin' },
      ])
    });
  });

  describe('refreshing corePk on connect', () => {
    it('should fetch and cache the server core ecosystem public key', () => {
      const account: any = makeDefaultAccount('pk-core')
      account.serverUrl = SERVER_URL
      service.setConnectedUser(account, 'sk')

      httpMock.expectOne((r) => r.url === MINE_URL).flush([])
      httpMock.expectOne((r) => r.url === INFO_URL).flush({ corePk: 'core-ecosystem-pk' })

      expect(service.getConnectedUser().corePk).toBe('core-ecosystem-pk')
    });

    it('should cache a null corePk when the server has no core ecosystem yet', () => {
      const account: any = makeDefaultAccount('pk-core-2')
      account.serverUrl = SERVER_URL
      service.setConnectedUser(account, 'sk')

      httpMock.expectOne((r) => r.url === MINE_URL).flush([])
      httpMock.expectOne((r) => r.url === INFO_URL).flush({ corePk: null })

      expect(service.getConnectedUser().corePk).toBeNull()
    });

    it('should keep the previously cached corePk if the refresh fails', () => {
      const account: any = makeDefaultAccount('pk-core-3')
      account.serverUrl = SERVER_URL
      account.corePk = 'old-core-pk'
      service.setConnectedUser(account, 'sk')

      httpMock.expectOne((r) => r.url === MINE_URL).flush([])
      httpMock.expectOne((r) => r.url === INFO_URL).error(new ProgressEvent('network error'))

      expect(service.getConnectedUser().corePk).toBe('old-core-pk')
    });
  });
});
