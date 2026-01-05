import { Injectable } from '@angular/core'
import { CitizenBlockchain } from 'organic-money/src/index.js';

@Injectable({
    providedIn: 'root',
})
export class ConnectedUserService {
    private connectedUser = null

    public setConnectedUser(user: any) {
        this.connectedUser = user
        user.blockchain = new CitizenBlockchain(user.blocks)
    }

    public getConnectedUser() : any {
        return this.connectedUser
    }
}