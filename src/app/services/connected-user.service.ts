import { Injectable, inject } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { ServerConnexionService } from './server-connection.service';
import { LocalDatabaseService } from './local-database.service';

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private server = inject(ServerConnexionService)
    private localDB = inject(LocalDatabaseService)

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
        this.refreshMyEcosystems()
    }

    /**
     * Refreshes which ecosystems the connected user has a role in — once per
     * app launch (Phase-2.md §5), not on every visit to "Mes écosystèmes".
     * Also called again right after creating an ecosystem, since that changes
     * the founder's roles. Silent on error: whatever was cached stays, which
     * is what keeps the list readable offline between two launches.
     */
    public refreshMyEcosystems(): void {
        const user = this.connectedUser as any
        this.server.getMyEcosystems(user.serverUrl, user.publickey).subscribe({
            next: (myEcosystems) => {
                user.myEcosystems = myEcosystems
                this.localDB.saveUser(user)
            },
            error: () => { /* keep whatever was already cached */ },
        })
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