import { Injectable } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private connectedUser = null
    /** Decrypted secret key, in memory for the session only — never persisted. */
    private secretKey = ''
    /** Set once a save gets a 409 DEVICE_REVOKED — this account is active on another device. */
    private readOnly = false

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

    public setReadOnly(): void {
        this.readOnly = true
    }

    public isReadOnlySession(): boolean {
        return this.readOnly
    }
}