import { Injectable } from '@angular/core'
import localforage from 'localforage'
import { CitizenBlockchain } from 'organic-money/src/index.js';

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

    public async getUserList(): Promise<[]> {
        const result: any = []
        try {
            await localforage.iterate((value, key, iterationNumber) => {
                result.push(value)
            })
        } catch (err) {
            console.log(err)
        }
        return result
    }

    /**
     * 
     * @param pk 
     * @param data: publickey, name, blocks, isuptodate, contacts, secretkey, password
     */
    public async saveUser(data: any) {
        let user: any
        user = await localforage.getItem(data.publickey)
        if (! user) {
            user = {
                publickey: data.publickey,
                name: "",
                blocks: [],
                isuptodate: false,
                contacts: [],
                secretkey: "",
                password: ""
            }
        }

        if (data.name) { user.name = data.name }
        if (data.isuptodate) { user.isuptodate = data.isuptodate }
        if (data.contacts) { user.contacts = data.contacts }
        if (data.secretkey) { user.secretkey = data.secretkey }
        if (data.password) { user.password = data.password }
        if (data.blockchain) {
            user.blocks = data.blockchain.blocks
        } else if (data.blocks) {
            user.blocks = data.blocks
        }

        try {
            await localforage.setItem(user.publickey, user)
        } catch (err) {
            console.log(err)
        }
        return user
    }

    public async getUser(pk: string): Promise<any> {
        try {
            const user: any = await localforage.getItem(pk)
            user.blockchain = new CitizenBlockchain(user.blocks)
            return user
        } catch (err) {
            console.log(err)
            return null
        }
    }
}