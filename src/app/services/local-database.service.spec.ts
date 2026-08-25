import { TestBed } from '@angular/core/testing';
import localforage from 'localforage';

import { LocalDatabaseService } from './local-database.service';
import { makeDefaultAccount } from '../models/account';

describe('LocalDatabaseService', () => {
  let service: LocalDatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
});
