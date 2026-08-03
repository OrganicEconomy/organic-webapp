import { Injectable } from '@angular/core'
import localforage from 'localforage'
import { CitizenBlockchain } from 'organic-money/src/index.js'
import type { Account, LoadedAccount } from '../models/account'

@Injectable({
    providedIn: 'root',
})
export class LocalDatabaseService {
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
        } catch (err) {
            console.log(err)
        }
        return result
    }

    /**
     * Persists a complete account record. Callers pass the full Account shape
     * (typically `this.user`, as loaded by getUser and mutated in place) —
     * there is no partial merge, so every field must be present. A `blockchain`
     * instance (as getUser attaches) is accepted in place of `blocks`.
     */
    public async saveUser(data: Account & { blockchain?: { export(): unknown } }): Promise<Account> {
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
        }

        try {
            await localforage.setItem(account.publickey, account)
        } catch (err) {
            console.log(err)
        }
        return account
    }

    public async getUser(pk: string): Promise<LoadedAccount | null> {
        try {
            const account = await localforage.getItem<Account>(pk)
            if (!account) return null
            return { ...account, blockchain: new CitizenBlockchain(account.blocks) }
        } catch (err) {
            console.log(err)
            return null
        }
    }
}
