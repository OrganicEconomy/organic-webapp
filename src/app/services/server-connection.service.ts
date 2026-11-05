import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, switchMap } from 'rxjs';
import { signHash } from 'organic-money/src/crypto.js';
import { hashRequestAuth, REQUEST_AUTH_HEADERS, type RequestAuthFields } from 'organic-protocol';
import type {
  InfoResponse, ServersResponse,
  RegisterBody, RegisterResponse,
  LoginBody, LoginResponse,
  SaveBlockBody, SignBlockBody,
  PasswordChangeBody,
  TxSendBody, TxListResponse,
  TxVerifyBody, TxVerifyResponse,
  IsCashedResponse,
  TxWire,
  EcosystemInfoResponse, ValidationStatusResponse, MyValidationResponse, MyEcosystemsResponse, EcosystemListResponse,
  EcosystemTxBody,
  EcosystemCreateBody, EcosystemCreateResponse, EcosystemMetaUpdateBody,
  ValidationListResponse, ValidationDetailResponse, ValidationRejectBody, ValidationApproveBody,
} from 'organic-protocol';
import type { LoadedAccount } from '../models/account';

const API_PATH = '/api/v1'

type AuthenticatedMethod = 'GET' | 'POST' | 'PUT'

function requestAuthHeaders(fields: RequestAuthFields, sk: string): HttpHeaders {
  return new HttpHeaders({
    'Content-Type': 'application/json',
    [REQUEST_AUTH_HEADERS.publickey]: fields.publickey,
    [REQUEST_AUTH_HEADERS.timestamp]: String(fields.timestamp),
    [REQUEST_AUTH_HEADERS.nonce]: fields.nonce,
    [REQUEST_AUTH_HEADERS.signature]: signHash(hashRequestAuth(fields), sk),
  })
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

@Injectable({ providedIn: 'root' })
export class ServerConnexionService {

  private http = inject(HttpClient);
  private serverPks = new Map<string, Observable<string>>();

  /** Public identity card of a server — used by server-selection to verify a URL before use. */
  public getServerInfo(serverUrl: string): Observable<InfoResponse> {
    return this.http.get<InfoResponse>(`${serverUrl}${API_PATH}/info`)
  }

  /** Directory of servers known to serverUrl, maintained by its operator. */
  public getKnownServers(serverUrl: string): Observable<ServersResponse> {
    return this.http.get<ServersResponse>(`${serverUrl}${API_PATH}/servers`)
  }

  public signupNewUser(serverUrl: string, body: RegisterBody): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${serverUrl}${API_PATH}/users/register`, body)
  }

  public login(serverUrl: string, mail: string, password: string): Observable<LoginResponse> {
    const body: LoginBody = { mail, password }
    return this.http.post<LoginResponse>(`${serverUrl}${API_PATH}/users/login`, body)
  }

  /** Saves one specific block — not necessarily the current one, see BackupService.blocksNeedingSync. */
  public saveBlock(user: LoadedAccount, sk: string, block: any): Observable<unknown> {
    const body: SaveBlockBody = { block: block.export(), devicetoken: user.devicetoken }
    return this.authenticatedRequest('PUT', user.serverUrl, '/users/save', user.blockchain.getMyPublicKey(), sk, body)
  }

  public saveLastBlock(user: LoadedAccount, sk: string): Observable<unknown> {
    return this.saveBlock(user, sk, user.blockchain.lastblock)
  }

  public signLastBlock(user: LoadedAccount, sk: string): Observable<unknown> {
    const body: SignBlockBody = { block: user.blockchain.lastblock.export(), devicetoken: user.devicetoken }
    return this.authenticatedRequest('PUT', user.serverUrl, '/users/sign', user.blockchain.getMyPublicKey(), sk, body)
  }

  public changePassword(serverUrl: string, publickey: string, newpassword: string, secretkey: string, sk: string): Observable<unknown> {
    const body: PasswordChangeBody = { newpassword, secretkey }
    return this.authenticatedRequest('POST', serverUrl, '/users/password', publickey, sk, body)
  }

  public sendTransaction(serverUrl: string, tx: TxWire): Observable<unknown> {
    const body: TxSendBody = { tx }
    return this.http.post(`${serverUrl}${API_PATH}/tx/send`, body)
  }

  public getTransactionList(serverUrl: string, publickey: string, sk: string): Observable<TxListResponse> {
    return this.authenticatedRequest<TxListResponse>('GET', serverUrl, '/tx/list', publickey, sk)
  }

  public isPaperAlreadyCashed(serverUrl: string, hash: string): Observable<IsCashedResponse> {
    return this.http.get<IsCashedResponse>(`${serverUrl}${API_PATH}/papers/isCashed`, {
      params: { hash },
    })
  }

  /** Deferred verification of an offline-received payment — public, read-only. */
  public verifyTransaction(serverUrl: string, tx: TxWire): Observable<TxVerifyResponse> {
    const body: TxVerifyBody = { tx }
    return this.http.post<TxVerifyResponse>(`${serverUrl}${API_PATH}/tx/verify`, body)
  }

  public getEcosystemInfo(serverUrl: string, publickey: string): Observable<EcosystemInfoResponse> {
    return this.http.get<EcosystemInfoResponse>(`${serverUrl}${API_PATH}/ecosystems/${publickey}`)
  }

  public getValidationStatus(serverUrl: string, publickey: string): Observable<ValidationStatusResponse> {
    return this.http.get<ValidationStatusResponse>(`${serverUrl}${API_PATH}/validations/status/${publickey}`)
  }

  public getMyValidation(serverUrl: string, publickey: string, sk: string): Observable<MyValidationResponse> {
    return this.authenticatedRequest<MyValidationResponse>('GET', serverUrl, '/validations/mine', publickey, sk)
  }

  public getMyEcosystems(serverUrl: string, publickey: string): Observable<MyEcosystemsResponse> {
    return this.http.get<MyEcosystemsResponse>(`${serverUrl}${API_PATH}/ecosystems/mine`, {
      params: { publickey },
    })
  }

  public getEcosystemList(serverUrl: string, lat?: number, lng?: number, radiusKm?: number): Observable<EcosystemListResponse> {
    let params = new HttpParams()
    if (lat !== undefined) params = params.set('lat', lat)
    if (lng !== undefined) params = params.set('lng', lng)
    if (radiusKm !== undefined) params = params.set('radiusKm', radiusKm)
    return this.http.get<EcosystemListResponse>(`${serverUrl}${API_PATH}/ecosystems`, { params })
  }

  public sendEcosystemTx(serverUrl: string, ecosystemPk: string, tx: TxWire): Observable<unknown> {
    const body: EcosystemTxBody = { tx }
    return this.http.post(`${serverUrl}${API_PATH}/ecosystems/${ecosystemPk}/tx`, body)
  }

  public distributeSalary(serverUrl: string, ecosystemPk: string, publickey: string, sk: string): Observable<unknown> {
    return this.authenticatedRequest('POST', serverUrl, `/ecosystems/${ecosystemPk}/distribute`, publickey, sk)
  }

  public createEcosystem(serverUrl: string, founderPk: string, sk: string, name: string, description?: string, lat?: number, lng?: number): Observable<EcosystemCreateResponse> {
    const body: EcosystemCreateBody = { name, description, lat, lng }
    return this.authenticatedRequest<EcosystemCreateResponse>('POST', serverUrl, '/ecosystems', founderPk, sk, body)
  }

  public updateEcosystemMeta(serverUrl: string, ecosystemPk: string, publickey: string, sk: string, updates: { name?: string; description?: string; lat?: number; lng?: number }): Observable<unknown> {
    const body: EcosystemMetaUpdateBody = updates
    return this.authenticatedRequest('PUT', serverUrl, `/ecosystems/${ecosystemPk}/meta`, publickey, sk, body)
  }

  public getValidationList(serverUrl: string, publickey: string, sk: string): Observable<ValidationListResponse> {
    return this.authenticatedRequest<ValidationListResponse>('GET', serverUrl, '/validations', publickey, sk)
  }

  public getValidationDetail(serverUrl: string, candidatePk: string, publickey: string, sk: string): Observable<ValidationDetailResponse> {
    return this.authenticatedRequest<ValidationDetailResponse>('GET', serverUrl, `/validations/${candidatePk}`, publickey, sk)
  }

  public rejectValidation(serverUrl: string, candidatePk: string, publickey: string, sk: string, reason?: string): Observable<unknown> {
    const body: ValidationRejectBody = { reason }
    return this.authenticatedRequest('POST', serverUrl, `/validations/${candidatePk}/reject`, publickey, sk, body)
  }

  public approveValidation(serverUrl: string, candidatePk: string, publickey: string, sk: string, block: any): Observable<unknown> {
    const body: ValidationApproveBody = { block: block.export() }
    return this.authenticatedRequest('POST', serverUrl, `/validations/${candidatePk}/approve`, publickey, sk, body)
  }

  private authenticatedRequest<T>(method: AuthenticatedMethod, serverUrl: string, route: string, publickey: string, sk: string, body?: object): Observable<T> {
    const path = `${API_PATH}${route}`
    const json = body === undefined ? '' : JSON.stringify(body)
    return this.serverPkOf(serverUrl).pipe(
      switchMap((serverPk) => {
        const fields = { method, path, timestamp: Math.floor(Date.now() / 1000), nonce: randomNonce(), body: json, serverPk, publickey }
        return this.http.request<T>(method, `${serverUrl}${path}`, {
          body: body === undefined ? undefined : json,
          headers: requestAuthHeaders(fields, sk),
        })
      }),
    )
  }

  private serverPkOf(serverUrl: string): Observable<string> {
    if (!this.serverPks.has(serverUrl)) {
      this.serverPks.set(serverUrl, this.getServerInfo(serverUrl).pipe(map((info) => info.serverPk), shareReplay(1)))
    }
    return this.serverPks.get(serverUrl)!
  }
}
