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
        // First time this account is loaded with the field unset (just
        // registered/logged in, or an account that predates this field):
        // whatever the chain currently holds is, as far as we know, what the
        // server just confirmed — a safe baseline for BackupService's catch-up.
        if (user.lastSavedBlockSignature == null && user.blocks.length > 0) {
            user.lastSavedBlockSignature = user.blockchain.lastblock.signature
        }
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