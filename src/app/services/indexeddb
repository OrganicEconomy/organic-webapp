import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class IndexedDBService {
    private dbName = 'OrganicMoney';
    private storeName = 'users';
    private db!: IDBDatabase;
    constructor() {
        this.initDB();
    }
    initDB() {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event: any) => {
            this.db = event.target.result;
            if (!this.db.objectStoreNames.contains(this.storeName)) {
                this.db.createObjectStore(this.storeName, { keyPath: 'pk' });
            }
        };
        request.onsuccess = (event: any) => {
            this.db = event.target.result;
            console.log('Database initialized successfully');
        };
        request.onerror = (event: any) => {
            console.error('Error initializing database:', event.target.error);
        };
    }
    addData(data: any): Promise<number> {
        return new Promise((resolve, reject) => {
            const store = this.db.transaction(this.storeName, 'readwrite')
                .objectStore(this.storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result as number);
            request.onerror = () => reject(request.error);
        });
    }
    getAllData(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(this.storeName, 'readonly')
                .objectStore(this.storeName)
                .getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    updateData(data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(this.storeName, 'readwrite')
                .objectStore(this.storeName)
                .put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    deleteData(pk: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(this.storeName, 'readwrite')
                .objectStore(this.storeName)
                .delete(pk);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}