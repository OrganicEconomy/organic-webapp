import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Blockchain, CitizenBlockchain } from 'organic-money/src/index.js';

const webserverurl = 'https://127.0.0.1:6868/api'

@Injectable({ providedIn: 'root' })
export class ServerConnexionService {

  private http = inject(HttpClient);

  public async signupNewUser(name: string, mail: string, password: string, birthdate: Date) {

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
      secretkey: sk, // user's secret key should be encrypted with password
      blocks: blocks
    })
  }

  public async saveLastBlock(pk: string, block: any) {
    this.http.put<any>(`${webserverurl}/users/save`, { pk, block })
      .subscribe({
        next: res => {
          alert('SAVE SUCCESSFUL');
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }

  public async signLastBlock(pk: string, block: any) {
    this.http.put<any>(`${webserverurl}/users/sign`, { pk, block })
      .subscribe({
        next: res => {
          alert('SIGN SUCCESSFUL');
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }

  public login(mail: string, password: string) {
    return this.http.get(`${webserverurl}/users/login`, {
      params: { mail, password }
    })
  }

  public async sendTransaction(tx: {}) {
    return this.http.put<any>(`${webserverurl}/tx/send`, { tx })
  }

  public async getTransactionList(publickey: string) {
    this.http.get(`${webserverurl}/tx/list`, {
      params: {
        publickey
      }
    })
      .subscribe({
        next: data => {
          alert('LIST SUCCESSFUL');
          alert(data);
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }

  public async cashPapers(paperlist: []) {
    this.http.post<any>(`${webserverurl}/papers/send`, {
      papers: paperlist
    })
      .subscribe({
        next: res => {
          alert('CASHING SUCCESSFUL');
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }
}

export interface User {
  pk: string
  name: string
  sk: string
  blockchain: any
  contacts: any[]
}