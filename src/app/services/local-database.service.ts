import { Injectable } from '@angular/core'
import localforage from 'localforage'

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
     * @param data: name, bc, isuptodate, contacts
     */
    public async saveUser(pk: string, data?: any) {
        let user: any
        user = await localforage.getItem(pk)
        if (! user) {
            user = {
                name: "",
                blocks: [],
                isuptodate: false,
                contacts: [],
                secretkey: "",
                password: ""
            }
        }

        if (data.name) { user.name = data.name }
        if (data.blocks) { user.blocks = data.blocks }
        if (data.isuptodate) { user.isuptodate = data.isuptodate }
        if (data.contacts) { user.contacts = data.contacts }
        if (data.secretkey) { user.secretkey = data.secretkey }
        if (data.password) { user.password = data.password }

        try {
            await localforage.setItem(pk, user)
        } catch (err) {
            console.log(err)
        }
        return user
    }

    public async getUser(pk: string): Promise<any> {
        try {
            const user = await localforage.getItem(pk)
            return user
        } catch (err) {
            console.log(err)
            return null
        }
    }
}