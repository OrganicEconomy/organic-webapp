import { Injectable, inject } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';
import { ServerConnexionService } from './server-connection.service';
import { LocalDatabaseService, LocalReadError } from './local-database.service';
import type { LoadedAccount } from '../models/account';
import { AccountTabsService } from './account-tabs.service';
import { decryptSecretKey, isWrongPasswordError } from './secret-key-crypto.util';
import { TabSession, TabSessionService, hasBeenIdleForTooLong } from './tab-session.service';

export type ReadOnlyReason = 'other-device' | 'out-of-sync' | 'other-tab' | 'locked'

const READ_ONLY_MESSAGES: Record<ReadOnlyReason, string> = {
    'other-device': 'Ce compte est actif sur un autre appareil — lecture seule.',
    'out-of-sync':
        "Cet appareil et le serveur ne sont plus d'accord sur des paiements : lecture seule, rien n'a été effacé. Contacte la personne qui gère ta monnaie locale.",
    'other-tab': 'Compte ouvert dans un autre onglet : celui-ci est en lecture seule.',
    'locked': 'Session verrouillée : saisis ton mot de passe pour continuer.',
}

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
    private outOfSync = false

    public setConnectedUser(user: any, secretKey: string) {
        this.revokedByAnotherDevice = false
        this.outOfSync = false
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

    public markOutOfSync(): void {
        this.outOfSync = true
    }

    public setReadOnly(): void {
        this.revokedByAnotherDevice = true
        this.tabSession.noteRevokedByAnotherDevice()
    }

    private isInUseInAnotherTab(): boolean {
        const user = this.connectedUser as any
        return user !== null && this.tabs.isInUseElsewhere(user.publickey)
    }

    public isUnlocked(): boolean {
        return this.secretKey !== ''
    }

    public isLocked(): boolean {
        return this.connectedUser !== null && this.secretKey === ''
    }

    public readOnlyReason(): ReadOnlyReason | null {
        if (this.revokedByAnotherDevice) {
            return 'other-device'
        }
        if (this.outOfSync) {
            return 'out-of-sync'
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
        const reason = this.readOnlyReason()
        if (reason === null) {
            throw new Error('This session can write: there is no read-only state to explain.')
        }
        return READ_ONLY_MESSAGES[reason]
    }

    public async unlock(password: string): Promise<boolean> {
        const account = await this.storedAccount((this.connectedUser as any).publickey)
        let secretKey: string
        try {
            secretKey = await decryptSecretKey(account.secretkey, password)
        } catch (error) {
            if (isWrongPasswordError(error)) {
                return false
            }
            throw error
        }
        this.setConnectedUser(account, secretKey)
        return true
    }

    public lock(): void {
        this.secretKey = ''
        this.tabSession.forgetSecretKey()
    }

    private isStillUnlocked(session: TabSession): session is TabSession & { secretKey: string } {
        return session.secretKey !== null && !hasBeenIdleForTooLong(session.lastActivityAt)
    }

    private connectLocked(account: LoadedAccount): void {
        this.connectedUser = account as any
        account.blockchain = new CitizenBlockchain(account.blocks)
        this.lock()
    }

    private async resumeFrom(session: TabSession): Promise<void> {
        const account = await this.localDB.getUser(session.publickey)
        if (account === null) {
            this.tabSession.forget()
            return
        }
        if (this.isStillUnlocked(session)) {
            this.setConnectedUser(account, session.secretKey)
        } else {
            this.connectLocked(account)
        }
        if (session.revokedByAnotherDevice) {
            this.setReadOnly()
        }
    }

    public async resumeTabSession(): Promise<void> {
        const session = this.tabSession.stored()
        if (session === null) {
            return
        }
        try {
            await this.resumeFrom(session)
        } catch (error) {
            console.error('The session of this tab cannot be resumed.', error)
        }
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