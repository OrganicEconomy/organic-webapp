import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { ConnectedUserService } from './connected-user.service';
import { makeDefaultAccount } from '../models/account';
import { AccountTabsService } from './account-tabs.service';
import { LocalDatabaseService, LocalReadError } from './local-database.service';
import { TabSessionService } from './tab-session.service';
import { encryptSecretKey } from './secret-key-crypto.util';

const SERVER_URL = 'https://trifouillis.fr';
const MINE_URL = `${SERVER_URL}/api/v1/ecosystems/mine`;
const INFO_URL = `${SERVER_URL}/api/v1/info`;

describe('ConnectedUserService', () => {
  let service: ConnectedUserService;
  let httpMock: HttpTestingController;
  let accountsInUseElsewhere: Set<string>;
  let takeBackSpy: jasmine.Spy;

  afterEach(() => sessionStorage.clear());

  beforeEach(() => {
    sessionStorage.clear();
    accountsInUseElsewhere = new Set();
    takeBackSpy = jasmine.createSpy('takeBack').and.callFake((pk: string) => accountsInUseElsewhere.delete(pk));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AccountTabsService,
          useValue: {
            isInUseElsewhere: (pk: string) => accountsInUseElsewhere.has(pk),
            announceChange: () => {},
            takeBack: takeBackSpy,
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
    it('should keep the session of this tab, so that a reload finds it again', () => {
      service.setConnectedUser(makeDefaultAccount('pk-kept') as any, 'kept-sk');

      expect(TestBed.inject(TabSessionService).stored()).toEqual(
        jasmine.objectContaining({ publickey: 'pk-kept', secretKey: 'kept-sk' }),
      );
    });

    it('should take the account back from any other tab, since connecting loads it afresh', () => {
      accountsInUseElsewhere.add('pk-reconnected');

      service.setConnectedUser(makeDefaultAccount('pk-reconnected') as any, 'sk');

      expect(service.isReadOnlySession()).toBeFalse();
    });
  });

  describe('resumeTabSession', () => {
    let pk: string;
    let tabSession: TabSessionService;

    beforeEach(async () => {
      pk = `pk-${Date.now()}-${Math.random().toString(36).slice(2)}-resumed`;
      await TestBed.inject(LocalDatabaseService).saveUser({ ...makeDefaultAccount(pk), name: 'Alice' });
      tabSession = TestBed.inject(TabSessionService);
    });

    function rememberedMinutesAgo(minutes: number, secretKey: string | null): void {
      sessionStorage.setItem(
        'organic-session',
        JSON.stringify({ publickey: pk, secretKey, lastActivityAt: Date.now() - minutes * 60_000 }),
      );
    }

    it('should reconnect, unlocked, the account of a tab active less than 15 minutes ago', async () => {
      rememberedMinutesAgo(14, 'alice-sk');

      await service.resumeTabSession();

      expect(service.getConnectedUser().name).toBe('Alice');
      expect(service.getSecretKey()).toBe('alice-sk');
    });

    it('should reconnect, locked, the account of a tab idle for 15 minutes or more', async () => {
      rememberedMinutesAgo(15, 'alice-sk');

      await service.resumeTabSession();

      expect(service.getConnectedUser().name).toBe('Alice');
      expect(service.isLocked()).toBeTrue();
      expect(tabSession.stored()?.secretKey).toBeNull();
    });

    it('should reconnect, locked, an account whose key was already forgotten', async () => {
      rememberedMinutesAgo(1, null);

      await service.resumeTabSession();

      expect(service.isLocked()).toBeTrue();
    });

    it('should keep, through a reload, that another device took the account over', async () => {
      sessionStorage.setItem(
        'organic-session',
        JSON.stringify({ publickey: pk, secretKey: 'alice-sk', lastActivityAt: Date.now(), revokedByAnotherDevice: true }),
      );

      await service.resumeTabSession();

      expect(service.readOnlyReason()).toBe('other-device');
    });

    it('should not take the account from the other tabs before the password is given', async () => {
      rememberedMinutesAgo(15, 'alice-sk');

      await service.resumeTabSession();

      expect(takeBackSpy).not.toHaveBeenCalled();
    });

    it('should connect nobody when this tab has no session', async () => {
      await service.resumeTabSession();

      expect(service.getConnectedUser()).toBeNull();
    });

    it('should start without a session, and say so, when this device cannot read the account', async () => {
      rememberedMinutesAgo(1, 'alice-sk');
      spyOn(TestBed.inject(LocalDatabaseService), 'getUser').and.rejectWith(new LocalReadError('blocked'));
      spyOn(console, 'error');

      await service.resumeTabSession();

      expect(service.getConnectedUser()).toBeNull();
      expect(console.error).toHaveBeenCalled();
      expect(tabSession.stored()).not.toBeNull();
    });

    it('should forget a session whose account is no longer on this device', async () => {
      sessionStorage.setItem('organic-session', JSON.stringify({ publickey: 'pk-gone', secretKey: 'sk', lastActivityAt: Date.now() }));

      await service.resumeTabSession();

      expect(service.getConnectedUser()).toBeNull();
      expect(tabSession.stored()).toBeNull();
    });
  });

  describe('setConnectedUser after a revocation', () => {
    it('should let this device write again once the citizen logs in afresh', () => {
      service.setConnectedUser(makeDefaultAccount('pk-again') as any, 'sk');
      service.setReadOnly();

      service.setConnectedUser(makeDefaultAccount('pk-again') as any, 'sk');

      expect(service.isReadOnlySession()).toBeFalse();
    });
  });

  describe('setReadOnly', () => {
    it('should note in the tab session that another device took the account over', () => {
      service.setConnectedUser(makeDefaultAccount('pk-revoked') as any, 'sk');

      service.setReadOnly();

      expect(TestBed.inject(TabSessionService).stored()?.revokedByAnotherDevice).toBeTrue();
    });
  });

  describe('isUnlocked', () => {
    it('should say that a connected account with its key can write', () => {
      service.setConnectedUser(makeDefaultAccount('pk-open') as any, 'open-sk');

      expect(service.isUnlocked()).toBeTrue();
    });

    it('should say that nobody connected is not unlocked', () => {
      expect(service.isUnlocked()).toBeFalse();
    });
  });

  describe('lock', () => {
    it('should forget the unlocked key, in memory and in the tab, but keep the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-locked') as any, 'locked-sk');

      service.lock();

      expect(service.getSecretKey()).toBe('');
      expect(service.getConnectedUser().publickey).toBe('pk-locked');
      expect(TestBed.inject(TabSessionService).stored()?.secretKey).toBeNull();
    });
  });

  describe('unlock', () => {
    const SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';

    let pk: string;

    beforeEach(async () => {
      pk = `pk-${Date.now()}-${Math.random().toString(36).slice(2)}-unlock`;
      const account: any = { ...makeDefaultAccount(pk), secretkey: await encryptSecretKey(SK, 'the-password') };
      await TestBed.inject(LocalDatabaseService).saveUser(account);
      service.setConnectedUser(account, SK);
      service.lock();
      takeBackSpy.calls.reset();
    });

    it('should take the account back, as stored now, once unlocked', async () => {
      await TestBed.inject(LocalDatabaseService).saveUser({
        ...makeDefaultAccount(pk),
        name: 'Stored by another tab',
        secretkey: await encryptSecretKey(SK, 'the-password'),
      });

      await service.unlock('the-password');

      expect(service.getConnectedUser().name).toBe('Stored by another tab');
      expect(takeBackSpy).toHaveBeenCalledWith(pk);
    });

    it('should accept a password changed meanwhile in another tab', async () => {
      await TestBed.inject(LocalDatabaseService).saveUser({
        ...makeDefaultAccount(pk),
        secretkey: await encryptSecretKey(SK, 'the-new-password'),
      });

      expect(await service.unlock('the-new-password')).toBeTrue();
    });

    it('should give the key back to this tab with the right password', async () => {
      expect(await service.unlock('the-password')).toBeTrue();
      expect(service.getSecretKey()).toBe(SK);
      expect(TestBed.inject(TabSessionService).stored()?.secretKey).toBe(SK);
    });

    it('should report, rather than hide as a wrong password, a key that cannot be read', async () => {
      await TestBed.inject(LocalDatabaseService).saveUser({ ...makeDefaultAccount(pk), secretkey: 'not an encrypted key' });

      await expectAsync(service.unlock('the-password')).toBeRejected();
    });

    it('should stay locked with a wrong password', async () => {
      expect(await service.unlock('a-wrong-password')).toBeFalse();
      expect(service.getSecretKey()).toBe('');
    });
  });

  describe('disconnect', () => {
    it('should forget the account, in memory and in the session of this tab', () => {
      service.setConnectedUser(makeDefaultAccount('pk-leaving') as any, 'leaving-sk');

      service.disconnect();

      expect(service.getConnectedUser()).toBeNull();
      expect(service.getSecretKey()).toBe('');
      expect(TestBed.inject(TabSessionService).stored()).toBeNull();
    });
  });

  describe('isReadOnlySession', () => {
    it('should be read-only while another tab holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-held') as any, 'sk');
      accountsInUseElsewhere.add('pk-held');

      expect(service.isReadOnlySession()).toBeTrue();
    });
  });

  describe('readOnlyMessage', () => {
    it('should refuse to explain a read-only state that does not exist', () => {
      service.setConnectedUser(makeDefaultAccount('pk-writable') as any, 'sk');

      expect(() => service.readOnlyMessage()).toThrowError();
    });

    it('should ask for the password when the session is locked', () => {
      service.setConnectedUser(makeDefaultAccount('pk-locked-message') as any, 'sk');
      service.lock();

      expect(service.readOnlyMessage()).toBe('Session verrouillée : entrez votre mot de passe pour continuer.');
    });

    it('should name the other tab when another tab holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-tab-message') as any, 'sk');
      accountsInUseElsewhere.add('pk-tab-message');

      expect(service.readOnlyMessage()).toBe("Compte ouvert dans un autre onglet : celui-ci est en lecture seule.");
    });

    it('should name the other device when another device holds the account', () => {
      service.setConnectedUser(makeDefaultAccount('pk-device-message') as any, 'sk');
      service.setReadOnly();

      expect(service.readOnlyMessage()).toBe('Ce compte est actif sur un autre appareil — lecture seule.');
    });
  });

  describe('markOutOfSync', () => {
    it('should keep this device from changing an account it no longer agrees on with the server', () => {
      service.setConnectedUser(makeDefaultAccount('pk-out-of-sync') as any, 'sk');

      service.markOutOfSync();

      expect(service.readOnlyReason()).toBe('out-of-sync');
      expect(service.readOnlyMessage()).toBe(
        "Ce téléphone et le serveur ne sont plus d'accord sur des paiements : lecture seule, rien n'a été effacé. Contactez l'administrateur de votre serveur.",
      );
    });
  });

  describe('readOnlyReason', () => {
    it('should say that the account is in use in another tab', () => {
      service.setConnectedUser(makeDefaultAccount('pk-tabs') as any, 'sk');
      accountsInUseElsewhere.add('pk-tabs');

      expect(service.readOnlyReason()).toBe('other-tab');
    });

    it('should say that another device took the account over', () => {
      service.setConnectedUser(makeDefaultAccount('pk-device') as any, 'sk');
      service.setReadOnly();

      expect(service.readOnlyReason()).toBe('other-device');
    });

    it('should say that the session is locked, until the password is given again', () => {
      service.setConnectedUser(makeDefaultAccount('pk-idle') as any, 'sk');

      service.lock();

      expect(service.readOnlyReason()).toBe('locked');
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
      service.setConnectedUser({ ...makeDefaultAccount(pk), name: 'Outdated copy' } as any, 'unlocked-sk');
      accountsInUseElsewhere.add(pk);

      await service.useThisTab();

      expect(service.isReadOnlySession()).toBeFalse();
      expect(service.getConnectedUser().name).toBe('Stored by the other tab');
      expect(service.getSecretKey()).toBe('unlocked-sk');
    });

    it('should leave this tab read-only when the account can no longer be read from this device', async () => {
      const pk = `pk-${Date.now()}-gone`;
      service.setConnectedUser(makeDefaultAccount(pk) as any, 'unlocked-sk');
      accountsInUseElsewhere.add(pk);

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
