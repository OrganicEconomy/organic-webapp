import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { signHash, hashTimestampAuth } from 'organic-money/src/crypto.js';
import type {
  InfoResponse, ServersResponse,
  RegisterBody, RegisterResponse,
  LoginBody, LoginResponse,
  SaveBlockBody, SignBlockBody,
  PasswordChangeBody,
  TxSendBody, TxListResponse,
  TxVerifyBody, TxVerifyResponse,
  PapersCashBody, IsCashedResponse,
  TxWire,
  EcosystemInfoResponse, ValidationStatusResponse, MyEcosystemsResponse, EcosystemListResponse,
  EcosystemTxBody, EcosystemDistributeBody,
  EcosystemCreateBody, EcosystemCreateResponse, EcosystemMetaUpdateBody,
  ValidationListResponse, ValidationDetailResponse, ValidationRejectBody, ValidationApproveBody,
} from 'organic-protocol';
import type { LoadedAccount } from '../models/account';

const API_PATH = '/api/v1'

function blockAuthHeaders(block: any, sk: string): HttpHeaders {
  block.merkle()
  return new HttpHeaders({ 'x-signature': signHash(block.hash(), sk) })
}

function timestampAuthHeaders(publickey: string, sk: string): { headers: HttpHeaders; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000)
  const headers = new HttpHeaders({ 'x-signature': signHash(hashTimestampAuth(publickey, timestamp), sk) })
  return { headers, timestamp }
}

@Injectable({ providedIn: 'root' })
export class ServerConnexionService {

  private http = inject(HttpClient);

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
    const headers = blockAuthHeaders(block, sk)
    const body: SaveBlockBody = { publickey: user.blockchain.getMyPublicKey(), block: block.export(), devicetoken: user.devicetoken }
    return this.http.put(`${user.serverUrl}${API_PATH}/users/save`, body, { headers })
  }

  public saveLastBlock(user: LoadedAccount, sk: string): Observable<unknown> {
    return this.saveBlock(user, sk, user.blockchain.lastblock)
  }

  public signLastBlock(user: LoadedAccount, sk: string): Observable<unknown> {
    const block = user.blockchain.lastblock
    const headers = blockAuthHeaders(block, sk)
    const body: SignBlockBody = { publickey: user.blockchain.getMyPublicKey(), block: block.export() }
    return this.http.put(`${user.serverUrl}${API_PATH}/users/sign`, body, { headers })
  }

  public changePassword(serverUrl: string, publickey: string, newpassword: string, secretkey: string, sk: string): Observable<unknown> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    const body: PasswordChangeBody = { publickey, timestamp, newpassword, secretkey }
    return this.http.post(`${serverUrl}${API_PATH}/users/password`, body, { headers })
  }

  public sendTransaction(serverUrl: string, tx: TxWire): Observable<unknown> {
    const body: TxSendBody = { tx }
    return this.http.post(`${serverUrl}${API_PATH}/tx/send`, body)
  }

  public getTransactionList(serverUrl: string, publickey: string, sk: string): Observable<TxListResponse> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    return this.http.get<TxListResponse>(`${serverUrl}${API_PATH}/tx/list`, {
      headers,
      params: { publickey, timestamp },
    })
  }

  /** tx is the full PAPER transaction (wire format) — the server requires proof, not a bare hash. */
  public cashPaper(serverUrl: string, tx: TxWire): Observable<unknown> {
    const body: PapersCashBody = { tx }
    return this.http.post(`${serverUrl}${API_PATH}/papers/cash`, body)
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
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    const body: EcosystemDistributeBody = { publickey, timestamp }
    return this.http.post(`${serverUrl}${API_PATH}/ecosystems/${ecosystemPk}/distribute`, body, { headers })
  }

  public createEcosystem(serverUrl: string, founderPk: string, sk: string, name: string, description?: string, lat?: number, lng?: number): Observable<EcosystemCreateResponse> {
    const { headers, timestamp } = timestampAuthHeaders(founderPk, sk)
    const body: EcosystemCreateBody = { founderPk, timestamp, name, description, lat, lng }
    return this.http.post<EcosystemCreateResponse>(`${serverUrl}${API_PATH}/ecosystems`, body, { headers })
  }

  public updateEcosystemMeta(serverUrl: string, ecosystemPk: string, publickey: string, sk: string, updates: { name?: string; description?: string; lat?: number; lng?: number }): Observable<unknown> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    const body: EcosystemMetaUpdateBody = { publickey, timestamp, ...updates }
    return this.http.put(`${serverUrl}${API_PATH}/ecosystems/${ecosystemPk}/meta`, body, { headers })
  }

  public getValidationList(serverUrl: string, publickey: string, sk: string): Observable<ValidationListResponse> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    return this.http.get<ValidationListResponse>(`${serverUrl}${API_PATH}/validations`, {
      headers,
      params: { publickey, timestamp },
    })
  }

  public getValidationDetail(serverUrl: string, candidatePk: string, publickey: string, sk: string): Observable<ValidationDetailResponse> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    return this.http.get<ValidationDetailResponse>(`${serverUrl}${API_PATH}/validations/${candidatePk}`, {
      headers,
      params: { publickey, timestamp },
    })
  }

  public rejectValidation(serverUrl: string, candidatePk: string, publickey: string, sk: string, reason?: string): Observable<unknown> {
    const { headers, timestamp } = timestampAuthHeaders(publickey, sk)
    const body: ValidationRejectBody = { publickey, timestamp, reason }
    return this.http.post(`${serverUrl}${API_PATH}/validations/${candidatePk}/reject`, body, { headers })
  }

  public approveValidation(serverUrl: string, candidatePk: string, publickey: string, sk: string, block: any): Observable<unknown> {
    const headers = blockAuthHeaders(block, sk)
    const body: ValidationApproveBody = { publickey, block: block.export() }
    return this.http.post(`${serverUrl}${API_PATH}/validations/${candidatePk}/approve`, body, { headers })
  }
}
