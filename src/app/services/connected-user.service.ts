import { Injectable } from '@angular/core'

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