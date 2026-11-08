import { Injectable, inject } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { ServerConnexionService } from './server-connection.service';
import { LocalDatabaseService, LocalReadError } from './local-database.service';
import type { LoadedAccount } from '../models/account';
import { AccountTabsService } from './account-tabs.service';

export type ReadOnlyReason = 'other-device' | 'other-tab'

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private server = inject(ServerConnexionService)
    private localDB = inject(LocalDatabaseService)
    private tabs = inject(AccountTabsService)

    private connectedUser = null
    /** Decrypted secret key, in memory for the session only — never persisted. */
    private secretKey = ''
    /** Set once a save gets a 409 DEVICE_REVOKED — this account is active on another device. */
    private revokedByAnotherDevice = false

    public setConnectedUser(user: any, secretKey: string) {
        this.tabs.takeBack(user.publickey)
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
        this.refreshCorePk()
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
                this.localDB.saveUserInBackground(user)
            },
            error: () => { /* keep whatever was already cached */ },
        })
    }

    public refreshCorePk(): void {
        const user = this.connectedUser as any
        this.server.getServerInfo(user.serverUrl).subscribe({
            next: (info) => {
                user.corePk = info.corePk
                this.localDB.saveUserInBackground(user)
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
        this.revokedByAnotherDevice = true
    }

    private isTakenOverByAnotherTab(): boolean {
        const user = this.connectedUser as any
        return user !== null && this.tabs.isStale(user.publickey)
    }

    public readOnlyReason(): ReadOnlyReason | null {
        if (this.revokedByAnotherDevice) {
            return 'other-device'
        }
        if (this.isTakenOverByAnotherTab()) {
            return 'other-tab'
        }
        return null
    }

    private async storedAccount(publickey: string): Promise<LoadedAccount> {
        const account = await this.localDB.getUser(publickey)
        if (account === null) {
            throw new LocalReadError('The account to take back is no longer on this device.')
        }
        return account
    }

    public async useThisTab(): Promise<void> {
        const account = await this.storedAccount((this.connectedUser as any).publickey)
        this.setConnectedUser(account, this.secretKey)
    }

    public readOnlyMessage(): string {
        return this.readOnlyReason() === 'other-tab'
            ? "Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci."
            : 'Ce compte est actif sur un autre appareil — lecture seule.'
    }

    public isReadOnlySession(): boolean {
        return this.readOnlyReason() !== null
    }
}