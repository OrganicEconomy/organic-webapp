import { Injectable } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private connectedUser = null

    public setConnectedUser(user: any) {
        this.connectedUser = user
    }

    public getConnectedUser() : any {
        return this.connectedUser
    }
}