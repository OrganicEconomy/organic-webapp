import { Injectable, inject } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { ServerConnexionService } from './server-connection.service';
import { LocalDatabaseService, LocalReadError } from './local-database.service';
import type { LoadedAccount } from '../models/account';
import { AccountTabsService } from './account-tabs.service';
import { decryptSecretKey } from './secret-key-crypto.util';
import { SESSION_LIFETIME_MS, TabSession, TabSessionService } from './tab-session.service';

export type ReadOnlyReason = 'other-device' | 'other-tab' | 'locked'

const READ_ONLY_MESSAGES: Record<ReadOnlyReason, string> = {
    'other-device': 'Ce compte est actif sur un autre appareil — lecture seule.',
    'other-tab': "Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci.",
    'locked': 'Session verrouillée : entrez votre mot de passe pour continuer.',
}

export type TabSessionResumption = 'unlocked' | 'locked' | 'none'

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private server = inject(ServerConnexionService)
    private localDB = inject(LocalDatabaseService)
    private tabs = inject(AccountTabsService)
    private tabSession = inject(TabSessionService)

    private connectedUser = null
    private secretKey = ''
    /** Set once a save gets a 409 DEVICE_REVOKED — this account is active on another device. */
    private revokedByAnotherDevice = false

    public setConnectedUser(user: any, secretKey: string) {
        this.tabSession.remember(user.publickey, secretKey)
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

    private isInUseInAnotherTab(): boolean {
        const user = this.connectedUser as any
        return user !== null && this.tabs.isInUseElsewhere(user.publickey)
    }

    public isLocked(): boolean {
        return this.connectedUser !== null && this.secretKey === ''
    }

    public readOnlyReason(): ReadOnlyReason | null {
        if (this.revokedByAnotherDevice) {
            return 'other-device'
        }
        if (this.isInUseInAnotherTab()) {
            return 'other-tab'
        }
        if (this.isLocked()) {
            return 'locked'
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
        return READ_ONLY_MESSAGES[this.readOnlyReason() ?? 'other-device']
    }

    public async unlock(password: string): Promise<boolean> {
        const user = this.connectedUser as any
        try {
            this.secretKey = await decryptSecretKey(user.secretkey, password)
        } catch {
            return false
        }
        this.tabSession.remember(user.publickey, this.secretKey)
        return true
    }

    public lock(): void {
        this.secretKey = ''
        this.tabSession.forgetSecretKey()
    }

    private isStillUnlocked(session: TabSession): session is TabSession & { secretKey: string } {
        return session.secretKey !== null && Date.now() - session.lastActivityAt < SESSION_LIFETIME_MS
    }

    private async accountOfTheTabSession(session: TabSession): Promise<LoadedAccount | null> {
        try {
            return await this.localDB.getUser(session.publickey)
        } catch (error) {
            console.error('The session of this tab cannot be resumed: its account cannot be read.', error)
            return null
        }
    }

    public async resumeTabSession(): Promise<TabSessionResumption> {
        const session = this.tabSession.stored()
        if (session === null) {
            return 'none'
        }
        const account = await this.accountOfTheTabSession(session)
        if (account === null) {
            this.tabSession.forget()
            return 'none'
        }
        if (this.isStillUnlocked(session)) {
            this.setConnectedUser(account, session.secretKey)
            return 'unlocked'
        }
        this.setConnectedUser(account, '')
        this.lock()
        return 'locked'
    }

    public disconnect(): void {
        this.connectedUser = null
        this.secretKey = ''
        this.tabSession.forget()
    }

    public isReadOnlySession(): boolean {
        return this.readOnlyReason() !== null
    }
}