import { Injectable } from '@angular/core';
import localforage from 'localforage';

@Injectable({
    providedIn: 'root',
})
export class IndexedDBService {
    private dbName = 'OrganicMoney';
    constructor() {
        this.initDB();
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
                result.push([key, value]);
            })
        } catch (err) {
            console.log(err);
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
        try {
            user = await localforage.getItem(pk)
        } catch (err) {
            console.log(err);
        }

        if (data.name) { user.name = data.name }
        if (data.bc) { user.bc = data.bc }
        if (data.isuptodate) { user.isuptodate = data.isuptodate }
        if (data.contacts) { user.contacts = data.contacts }

        try {
            await localforage.setItem(pk, user)
        } catch (err) {
            console.log(err);
        }
    }
}