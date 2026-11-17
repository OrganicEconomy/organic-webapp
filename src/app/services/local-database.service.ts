import { Injectable, inject } from '@angular/core'
import { MatSnackBar } from '@angular/material/snack-bar'
import localforage from 'localforage'
import { CitizenBlockchain } from 'organic-money/src/index.js'
import type { Account, Contact, LoadedAccount } from '../models/account'

export class LocalSaveError extends Error {}

export class LocalReadError extends Error {}

export const ACCOUNT_NOT_STORED_MESSAGE =
    "Cet appareil n'a pas pu enregistrer le compte : libérez de la place, ou quittez la navigation privée."

export const CONTACT_NOT_STORED_MESSAGE = "Cet appareil n'a pas pu enregistrer ce contact."

export type StorableAccount = Account & { blockchain?: { export(): unknown } }

@Injectable({
    providedIn: 'root',
})
export class LocalDatabaseService {
    private snackBar = inject(MatSnackBar)
    private dbName = 'OrganicMoney'
    constructor() {
        this.initDB()
    }

    private initDB() {
        localforage.config({
            name: this.dbName
        });
    }

    public async getUserList(): Promise<Account[]> {
        const result: Account[] = []
        try {
            await localforage.iterate((value: Account) => {
                result.push(value)
            })
        } catch (error) {
            throw new LocalReadError('Could not read the accounts stored on this device.', { cause: error })
        }
        return result
    }

    /**
     * Persists a complete account record. Callers pass the full Account shape
     * (typically `this.user`, as loaded by getUser and mutated in place) —
     * there is no partial merge, so every field must be present. A `blockchain`
     * instance (as getUser attaches) is accepted in place of `blocks`.
     */
    public async saveUser(data: StorableAccount): Promise<Account> {
        const account: Account = {
            publickey: data.publickey,
            name: data.name,
            serverUrl: data.serverUrl,
            blocks: data.blockchain ? (data.blockchain.export() as Account['blocks']) : data.blocks,
            secretkey: data.secretkey,
            contacts: data.contacts,
            backupPolicy: data.backupPolicy,
            lastBackupAt: data.lastBackupAt,
            isuptodate: data.isuptodate,
            pendingOfflineTx: data.pendingOfflineTx,
            sentOfflineTx: data.sentOfflineTx,
            status: data.status,
            devicetoken: data.devicetoken,
            lastSavedBlockSignature: data.lastSavedBlockSignature,
            myEcosystems: data.myEcosystems,
            corePk: data.corePk,
        }

        try {
            await localforage.setItem(account.publickey, account)
        } catch (error) {
            throw new LocalSaveError('Could not store the account on this device.', { cause: error })
        }
        return account
    }

    public async saveUserInBackground(data: StorableAccount): Promise<void> {
        try {
            await this.saveUser(data)
        } catch (error) {
            if (!(error instanceof LocalSaveError)) {
                throw error
            }
            console.error(error)
            this.snackBar.open(ACCOUNT_NOT_STORED_MESSAGE, 'Fermer')
        }
    }

    public async saveWithNewContacts(user: LoadedAccount, newContacts: Contact[]): Promise<void> {
        const contacts = [...user.contacts, ...newContacts]
        await this.saveUser({ ...user, contacts })
        user.contacts = contacts
    }

    public async getUser(pk: string): Promise<LoadedAccount | null> {
        try {
            const account = await localforage.getItem<Account>(pk)
            if (!account) return null
            return {
                ...account,
                contacts: this.withoutOwnContact(account),
                blockchain: new CitizenBlockchain(account.blocks),
            }
        } catch (error) {
            throw new LocalReadError('Could not read the account stored on this device.', { cause: error })
        }
    }

    private withoutOwnContact(account: Account): Contact[] {
        return account.contacts.filter((contact) => contact.pk !== account.publickey)
    }
}
