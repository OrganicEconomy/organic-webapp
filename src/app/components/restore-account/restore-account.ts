import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { decryptSecretKey } from '../../services/secret-key-crypto.util';
import { makeDefaultAccount } from '../../models/account';
import { environment } from '../../../environments/environment';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-restore-account',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './restore-account.html',
  styleUrl: './restore-account.css',
})
export class RestoreAccount {
  private server = inject(ServerConnexionService)
  private localDB = inject(LocalDatabaseService)
  private userService = inject(ConnectedUserService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  public restoreForm: FormGroup
  public hidePassword = true
  public restoring = false
  public error = ''

  constructor(formBuilder: FormBuilder) {
    const serverFromQuery = this.route.snapshot.queryParamMap.get('server')
    this.restoreForm = formBuilder.group({
      serverUrl: [serverFromQuery ?? environment.serverUrl],
      email: [''],
      password: [''],
    })
  }

  restore(): void {
    this.error = ''
    this.restoring = true
    const { serverUrl, email, password } = this.restoreForm.value

    this.server.login(serverUrl, email, password).subscribe({
      next: async (res) => {
        const sk = await this.tryUnlock(res.secretkey, password)
        if (sk === null) {
          this.error = "Mot de passe incorrect."
          this.restoring = false
          return
        }

        const account = makeDefaultAccount(res.publickey)
        account.name = res.name
        account.serverUrl = serverUrl
        account.blocks = res.blocks
        account.secretkey = res.secretkey
        account.devicetoken = res.devicetoken
        account.isuptodate = true

        const user = await this.localDB.saveUser(account)
        this.userService.setConnectedUser(user, sk)
        this.restoring = false
        this.router.navigate(['/home'])
      },
      error: () => {
        this.error = "Identifiants invalides ou serveur injoignable."
        this.restoring = false
      },
    })
  }

  /**
   * The server response is not trusted blindly: the password must actually
   * decrypt the fetched secretkey. A wrong password makes decryptSecretKey
   * throw — that failure is the only signal, never a direct comparison.
   */
  private async tryUnlock(secretkey: string, password: string): Promise<string | null> {
    try {
      return await decryptSecretKey(secretkey, password)
    } catch {
      return null
    }
  }
}
