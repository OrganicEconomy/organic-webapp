import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { signHash, hashTimestampAuth } from 'organic-money/src/crypto.js';
import type {
  RegisterBody, RegisterResponse,
  LoginBody, LoginResponse,
  SaveBlockBody, SignBlockBody,
  PasswordChangeBody,
  TxSendBody, TxListResponse,
  PapersCashBody, IsCashedResponse,
  TxWire,
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

  public signupNewUser(serverUrl: string, body: RegisterBody): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${serverUrl}${API_PATH}/users/register`, body)
  }

  public login(serverUrl: string, mail: string, password: string): Observable<LoginResponse> {
    const body: LoginBody = { mail, password }
    return this.http.post<LoginResponse>(`${serverUrl}${API_PATH}/users/login`, body)
  }

  public saveLastBlock(user: LoadedAccount, sk: string): Observable<unknown> {
    const block = user.blockchain.lastblock
    const headers = blockAuthHeaders(block, sk)
    const body: SaveBlockBody = { publickey: user.blockchain.getMyPublicKey(), block: block.export(), devicetoken: user.devicetoken }
    return this.http.put(`${user.serverUrl}${API_PATH}/users/save`, body, { headers })
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
}
