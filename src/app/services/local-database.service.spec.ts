import { TestBed } from '@angular/core/testing';
import localforage from 'localforage';

import { LocalDatabaseService, LocalReadError, LocalSaveError } from './local-database.service';
import { makeDefaultAccount } from '../models/account';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('LocalDatabaseService', () => {
  let service: LocalDatabaseService;

  let snackBarSpy: jasmine.SpyObj<Pick<MatSnackBar, 'open'>>;

  beforeEach(() => {
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: snackBarSpy }] });
    service = TestBed.inject(LocalDatabaseService);
  });

  function uniquePk(suffix: string): string {
    return `pk-${Date.now()}-${Math.random().toString(36).slice(2)}-${suffix}`
  }

  it('should save and retrieve an account with all schema fields intact', async () => {
    const pk = uniquePk('roundtrip')
    const account = makeDefaultAccount(pk)
    account.name = 'Alice'
    account.serverUrl = 'https://trifouillis.fr'
    account.secretkey = 'encrypted-blob'
    account.devicetoken = 'device-1'

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.publickey).toBe(pk)
    expect(loaded.name).toBe('Alice')
    expect(loaded.serverUrl).toBe('https://trifouillis.fr')
    expect(loaded.secretkey).toBe('encrypted-blob')
    expect(loaded.devicetoken).toBe('device-1')
    expect(loaded.backupPolicy).toBe('every-tx')
    expect(loaded.status).toBe('active')
    expect(loaded.pendingOfflineTx).toEqual([])
    expect(loaded.sentOfflineTx).toEqual([])
  });

  it('should round-trip a non-default membership status (pending-validation)', async () => {
    const pk = uniquePk('pending-status')
    const account = makeDefaultAccount(pk)
    account.status = 'pending-validation'

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.status).toBe('pending-validation')
  });

  it('should round-trip the cached myEcosystems list', async () => {
    const pk = uniquePk('my-ecosystems')
    const account = makeDefaultAccount(pk)
    account.myEcosystems = [{ publickey: 'eco-pk', name: 'Boulangerie', role: 'actor' }]

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.myEcosystems).toEqual([{ publickey: 'eco-pk', name: 'Boulangerie', role: 'actor' }])
  });

  it('should leave out the contact holding the account own key, created at signup by older versions', async () => {
    const pk = uniquePk('self-contact')
    const account = makeDefaultAccount(pk)
    account.contacts = [
      { name: 'moi', pk, url: 'https://trifouillis.fr', type: 'citizen' },
      { name: 'Bob', pk: 'bob-pk', url: 'https://trifouillis.fr', type: 'citizen' },
    ]

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.contacts).toEqual([{ name: 'Bob', pk: 'bob-pk', url: 'https://trifouillis.fr', type: 'citizen' }])
  });

  it('should round-trip the cached corePk', async () => {
    const pk = uniquePk('core-pk')
    const account = makeDefaultAccount(pk)
    account.corePk = 'core-ecosystem-pk'

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.corePk).toBe('core-ecosystem-pk')
  });

  it('should never persist a plaintext password field', async () => {
    const pk = uniquePk('nopassword')
    const account: any = makeDefaultAccount(pk)
    account.password = 'plaintext-should-not-persist'

    await service.saveUser(account)
    const loaded: any = await service.getUser(pk)

    expect(loaded.password).toBeUndefined()
  });

  it('should attach a CitizenBlockchain instance built from the stored blocks', async () => {
    const pk = uniquePk('blockchain')
    await service.saveUser(makeDefaultAccount(pk))

    const loaded: any = await service.getUser(pk)

    expect(loaded.blockchain).toBeDefined()
    expect(typeof loaded.blockchain.getMyPublicKey).toBe('function')
  });

  it('should derive blocks from a given blockchain instance via export()', async () => {
    // Bypasses getUser() on purpose: it reconstructs a real CitizenBlockchain from
    // the stored blocks, which requires a valid chain — irrelevant to what this
    // test checks (that saveUser reads .blockchain.export() over .blocks).
    const pk = uniquePk('export')
    const account: any = makeDefaultAccount(pk)
    account.blocks = [{ should: 'be ignored' }]
    account.blockchain = { export: () => [{ fake: 'block' }] }

    await service.saveUser(account)
    const raw: any = await localforage.getItem(pk)

    expect(raw.blocks).toEqual([{ fake: 'block' }])
  });

  it('should list every saved account', async () => {
    const pk = uniquePk('list')
    await service.saveUser(makeDefaultAccount(pk))

    const list = await service.getUserList()

    expect(list.some((u) => u.publickey === pk)).toBeTrue()
  });

  it('should return null for an unknown account', async () => {
    const loaded = await service.getUser('does-not-exist')

    expect(loaded).toBeNull()
  });

  describe('saveUser', () => {
    it('should fail with a LocalSaveError when the device cannot store the account', async () => {
      spyOn(localforage, 'setItem').and.rejectWith(new DOMException('full', 'QuotaExceededError'));

      await expectAsync(service.saveUser(makeDefaultAccount(uniquePk('full')))).toBeRejectedWithError(LocalSaveError);
    });
  });

  describe('saveUserInBackground', () => {
    it('should warn the citizen when the device cannot store the account', async () => {
      spyOn(localforage, 'setItem').and.rejectWith(new DOMException('full', 'QuotaExceededError'));
      spyOn(console, 'error');

      await service.saveUserInBackground(makeDefaultAccount(uniquePk('full')));

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Cet appareil n'a pas pu enregistrer le compte : libérez de la place, ou quittez la navigation privée.",
        'Fermer',
      );
    });

    it('should let an error that is not a storage failure through, without blaming the storage', async () => {
      const brokenAccount: any = { ...makeDefaultAccount(uniquePk('broken')), blockchain: { export: () => { throw new TypeError('boom'); } } };

      await expectAsync(service.saveUserInBackground(brokenAccount)).toBeRejectedWithError(TypeError);
      expect(snackBarSpy.open).not.toHaveBeenCalled();
    });
  });

  describe('getUserList', () => {
    it('should fail with a LocalReadError when the device cannot read its accounts', async () => {
      spyOn(localforage, 'iterate').and.rejectWith(new DOMException('blocked', 'SecurityError'));

      await expectAsync(service.getUserList()).toBeRejectedWithError(LocalReadError);
    });
  });

  describe('getUser', () => {
    it('should fail with a LocalReadError when the device cannot read the account', async () => {
      spyOn(localforage, 'getItem').and.rejectWith(new DOMException('blocked', 'SecurityError'));

      await expectAsync(service.getUser(uniquePk('blocked'))).toBeRejectedWithError(LocalReadError);
    });
  });

  describe('saveWithNewContacts', () => {
    it('should store the account with the new contacts added to the known ones', async () => {
      const account: any = { ...makeDefaultAccount(uniquePk('contacts')), contacts: [{ name: 'Zoé' }] };

      await service.saveWithNewContacts(account, [{ name: 'Denis' } as any]);

      expect((await service.getUser(account.publickey))?.contacts).toEqual([{ name: 'Zoé' }, { name: 'Denis' }] as any);
      expect(account.contacts).toEqual([{ name: 'Zoé' }, { name: 'Denis' }]);
    });

    it('should leave the contacts as they were when the device cannot store them', async () => {
      spyOn(localforage, 'setItem').and.rejectWith(new DOMException('full', 'QuotaExceededError'));
      const account: any = { ...makeDefaultAccount(uniquePk('contacts-full')), contacts: [{ name: 'Zoé' }] };

      await expectAsync(service.saveWithNewContacts(account, [{ name: 'Denis' } as any])).toBeRejectedWithError(LocalSaveError);
      expect(account.contacts).toEqual([{ name: 'Zoé' }]);
    });
  });
});
