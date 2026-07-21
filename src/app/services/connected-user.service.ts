import { Injectable } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private connectedUser = null
    /** Decrypted secret key, in memory for the session only — never persisted. */
    private secretKey = ''

    public setConnectedUser(user: any, secretKey: string) {
        this.connectedUser = user
        this.secretKey = secretKey
        user.blockchain = new CitizenBlockchain(user.blocks)
    }

    public getConnectedUser() : any {
        return this.connectedUser
    }

    public getSecretKey(): string {
        return this.secretKey
    }
}