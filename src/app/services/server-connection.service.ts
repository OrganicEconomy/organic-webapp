import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CitizenBlockchain } from 'organic-money/src/index.js';

const webserverurl = 'https://127.0.0.1:6868/api'

@Injectable({
  providedIn: 'root',
})
export class ServerConnexion {

  private http = inject(HttpClient);
  
  public async signupNewUser(name: string, mail: string, password: string) {

    const bc = new CitizenBlockchain()
    //bc.

    this.http.post<any>(`${ webserverurl }/register`, {})
      .subscribe({
        next: res => {
          alert('SIGNUP SUCCESSFUL');
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }

  public async saveLastBlock(blocks: []) {

  }

  public async signLastBlock(blocks: []) {

  }

  public async login(mail: string, password: string) {

  }

  public async sendTransaction(tx: {}) {

  }

  public async getTransactionList(publickey: string) {

  }

  public async cashPapers(paperlist: []) {

  }
}

export interface User {
  pk: string
  name: string
  sk: string
  blockchain: any
  contacts: any[]
}