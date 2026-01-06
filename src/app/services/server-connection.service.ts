import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Blockchain, CitizenBlockchain } from 'organic-money/src/index.js';

import { environment } from '../../../src/environments/environment';

const webserverurl = environment.apiURL

@Injectable({ providedIn: 'root' })
export class ServerConnexionService {

  private http = inject(HttpClient);

  public signupNewUser(name: string, mail: string, password: string, birthdate: Date) {

    const bc = new CitizenBlockchain()
    const sk = Blockchain.randomPrivateKey()
    bc.makeBirthBlock(sk, birthdate, name, new Date())
    const pk = bc.getMyPublicKey()
    const blocks = bc.blocks

    console.log(sk)
    console.log(blocks)

    return this.http.post<any>(`${webserverurl}/users/register`, {
      publickey: pk,
      name: name,
      mail: mail,
      password: password,
      secretkey: sk, // TODO user's secret key should be encrypted with password
      blocks: blocks
    })
  }

  public saveLastBlock(publickey: string, block: any) {
    this.http.put<any>(`${webserverurl}/users/save`, { publickey, block })
      .subscribe({
        next: res => {
          console.log('SAVE SUCCESSFUL');
        },
        error: err => {
          console.log("Something went wrong")
        }
      })
  }

  public signLastBlock(publickey: string, block: any) {
    this.http.put<any>(`${webserverurl}/users/sign`, { publickey, block })
      .subscribe({
        next: res => {
          console.log('SIGN SUCCESSFUL');
        },
        error: err => {
          console.log("Something went wrong")
        }
      })
  }

  public login(mail: string, password: string): any {
    return this.http.get(`${webserverurl}/users/login`, {
      params: { mail, password }
    })
  }

  public async sendTransaction(tx: {}) {
    return this.http.post<any>(`${webserverurl}/tx/send`, { tx })
      .subscribe({
        next: res => {
          console.log('SIGN SUCCESSFUL');
        },
        error: err => {
          console.log("Something went wrong")
        }
      })
  }

  public getTransactionList(publickey: string) {
    return this.http.get(`${webserverurl}/tx/list`, {
      params: { publickey }
    })
  }

  public async cashPapers(paperlist: []) {
    this.http.post<any>(`${webserverurl}/papers/send`, {
      papers: paperlist
    })
      .subscribe({
        next: res => {
          console.log('CASHING SUCCESSFUL');
        },
        error: err => {
          console.log("Something went wrong")
        }
      })
  }
}