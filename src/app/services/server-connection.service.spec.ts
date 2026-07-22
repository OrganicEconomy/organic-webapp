import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import type { RegisterBody, RegisterResponse, LoginResponse, InfoResponse, ServersResponse } from 'organic-protocol';
import { BlockMaker } from 'organic-money/src/index.js';
import { verifySignature } from 'organic-money/src/crypto.js';

import { ServerConnexionService } from './server-connection.service';

const SERVER_URL = 'https://trifouillis.fr'
// A real signed block, taken from organic-money's own test fixtures — needed because
// saveLastBlock/signLastBlock call block.merkle()/block.hash() on it, which only work
// on a real BlockMaker.make() instance.
const TEST_SK = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f'
const TEST_PK = '02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3'

describe('ServerConnexionService', () => {
  let service: ServerConnexionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServerConnexionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function makeBlock(): any {
    return BlockMaker.make({
      v: 1, d: 20260101, p: 'c1a551ca1c0deea5efea51b1e1dea112ed1dea0a5150f5e11ab1e50c1a15eed5',
      s: TEST_PK, r: '', m: '', i: '', t: 0, h: '', x: [],
    })
  }

  function makeLoadedAccount(devicetoken = 'device-1'): any {
    const lastblock = makeBlock()
    return {
      serverUrl: SERVER_URL,
      devicetoken,
      blockchain: {
        lastblock,
        getMyPublicKey: () => TEST_PK,
      },
    }
  }

  it('getServerInfo: GETs /v1/info (public, no auth)', () => {
    let result: InfoResponse | undefined
    service.getServerInfo(SERVER_URL).subscribe((res) => (result = res))

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/info`)
    expect(req.request.method).toBe('GET')
    expect(req.request.headers.has('x-signature')).toBeFalse()
    req.flush({ protocolVersion: 1, apiVersion: '1', name: 'Serveur de Trifouillis', serverPk: TEST_PK, corePk: null, stats: { users: 42 } })

    expect(result?.name).toBe('Serveur de Trifouillis')
    expect(result?.stats.users).toBe(42)
  });

  it('getKnownServers: GETs /v1/servers (public, no auth)', () => {
    let result: ServersResponse | undefined
    service.getKnownServers(SERVER_URL).subscribe((res) => (result = res))

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/servers`)
    expect(req.request.method).toBe('GET')
    req.flush([{ name: 'Serveur de Trifouillis', url: SERVER_URL }])

    expect(result?.length).toBe(1)
    expect(result?.[0].name).toBe('Serveur de Trifouillis')
  });

  it('signupNewUser: POSTs to /api/v1/users/register with the given body', () => {
    const body: RegisterBody = {
      publickey: TEST_PK, name: 'Alice', mail: 'alice@ex.fr', password: 'pw',
      birthdate: '1990-03-15', secretkey: 'encrypted-blob', blocks: [],
    }
    let result: RegisterResponse | undefined
    service.signupNewUser(SERVER_URL, body).subscribe((res) => (result = res))

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/register`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(body)
    req.flush({ publickey: TEST_PK, blocks: [], devicetoken: 'dt-1' })

    expect(result?.devicetoken).toBe('dt-1')
  });

  it('login: POSTs mail/password in the body, never in the URL', () => {
    let result: LoginResponse | undefined
    service.login(SERVER_URL, 'alice@ex.fr', 'pw').subscribe((res) => (result = res))

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/login`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual({ mail: 'alice@ex.fr', password: 'pw' })
    expect(req.request.urlWithParams).not.toContain('pw')
    req.flush({ publickey: TEST_PK, name: 'Alice', mail: 'alice@ex.fr', secretkey: 'blob', blocks: [], devicetoken: 'dt-2' })

    expect(result?.devicetoken).toBe('dt-2')
  });

  it('saveLastBlock: PUTs with a valid x-signature header and the exported block', () => {
    const user = makeLoadedAccount()
    service.saveLastBlock(user, TEST_SK).subscribe()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/save`)
    expect(req.request.method).toBe('PUT')
    expect(req.request.headers.has('x-signature')).toBeTrue()
    expect(req.request.body.publickey).toBe(TEST_PK)
    expect(req.request.body.devicetoken).toBe('device-1')

    // x-signature proves the *request* comes from the block's owner — it is
    // distinct from the block's own .h field, which stays empty for an open
    // (not yet closed/signed) block; that's the normal case for a save.
    const reconstructed = BlockMaker.make(req.request.body.block)
    reconstructed.merkle()
    const signature = req.request.headers.get('x-signature')
    expect(signature).toBeTruthy()
    expect(verifySignature(reconstructed.hash(), signature!, TEST_PK)).toBeTrue()

    req.flush({ message: 'ok' })
  });

  it('signLastBlock: PUTs to /users/sign with a valid x-signature, no devicetoken field', () => {
    const user = makeLoadedAccount()
    service.signLastBlock(user, TEST_SK).subscribe()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/sign`)
    expect(req.request.method).toBe('PUT')
    expect(req.request.headers.has('x-signature')).toBeTrue()
    expect(req.request.body.devicetoken).toBeUndefined()

    req.flush({ message: 'ok' })
  });

  it('changePassword: POSTs to /users/password with a timestamp-auth x-signature', () => {
    service.changePassword(SERVER_URL, TEST_PK, 'newpw', 'new-encrypted-blob', TEST_SK).subscribe()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/users/password`)
    expect(req.request.method).toBe('POST')
    expect(req.request.headers.has('x-signature')).toBeTrue()
    expect(req.request.body.newpassword).toBe('newpw')
    expect(req.request.body.secretkey).toBe('new-encrypted-blob')
    expect(typeof req.request.body.timestamp).toBe('number')

    req.flush({ message: 'ok' })
  });

  it('sendTransaction: POSTs { tx } to /tx/send', () => {
    const tx: any = { v: 1, d: 20260101, t: 3, p: 'target', s: TEST_PK, m: '', i: '', h: 'sig' }
    service.sendTransaction(SERVER_URL, tx).subscribe()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/tx/send`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual({ tx })
    req.flush({ message: 'ok' })
  });

  it('getTransactionList: GETs /tx/list with a timestamp-auth x-signature', () => {
    service.getTransactionList(SERVER_URL, TEST_PK, TEST_SK).subscribe()

    const req = httpMock.expectOne((r) => r.url === `${SERVER_URL}/api/v1/tx/list`)
    expect(req.request.method).toBe('GET')
    expect(req.request.headers.has('x-signature')).toBeTrue()
    expect(req.request.params.get('publickey')).toBe(TEST_PK)
    req.flush([])
  });

  it('cashPaper: POSTs the full tx (not a bare hash) to /papers/cash', () => {
    const tx: any = { v: 1, d: 20260101, t: 5, p: 'referent', s: TEST_PK, m: '', i: '', h: 'sig' }
    service.cashPaper(SERVER_URL, tx).subscribe()

    const req = httpMock.expectOne(`${SERVER_URL}/api/v1/papers/cash`)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual({ tx })
    req.flush({ message: 'ok' })
  });

  it('isPaperAlreadyCashed: GETs /papers/isCashed with the hash as a query param', () => {
    service.isPaperAlreadyCashed(SERVER_URL, 'a-paper-hash').subscribe()

    const req = httpMock.expectOne((r) => r.url === `${SERVER_URL}/api/v1/papers/isCashed`)
    expect(req.request.method).toBe('GET')
    expect(req.request.params.get('hash')).toBe('a-paper-hash')
    req.flush({ id: 1 })
  });
});
