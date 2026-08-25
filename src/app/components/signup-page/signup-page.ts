import { Component, inject } from '@angular/core'
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { CitizenBlockchain } from 'organic-money/src/index.js'
import type { RegisterBody } from 'organic-protocol'
import { ServerConnexionService } from '../../services/server-connection.service'
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'
import { encryptSecretKey } from '../../services/secret-key-crypto.util'
import { makeDefaultAccount } from '../../models/account'
import { environment } from '../../../environments/environment'

// Angular Material imports
import { MatCardModule } from '@angular/material/card'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'


@Component({
  selector: 'app-signup-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  public signupForm !: FormGroup
  public hidePassword = true

  server = inject(ServerConnexionService)
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)

  constructor(private formBuilder: FormBuilder, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      email: [""],
      name: [""],
      birthdate: [""],
      password: [""],
    })
  }

  async signup() {
    const { name, email, birthdate, password } = this.signupForm.value
    const serverUrl = this.route.snapshot.queryParamMap.get('server') ?? environment.serverUrl

    // The BirthBlock is generated locally: the secret key never exists
    // anywhere but on this device, encrypted, from the very first block.
    const bc = new CitizenBlockchain()
    const sk = bc.makeBirthBlock(name, new Date(birthdate))
    const publickey = bc.getMyPublicKey()
    const secretkey = await encryptSecretKey(sk, password)

    const body: RegisterBody = {
      publickey,
      name,
      mail: email,
      password,
      birthdate,
      secretkey,
      blocks: bc.export(),
    }

    this.server.signupNewUser(serverUrl, body).subscribe({
      next: async (res) => {
        const account = makeDefaultAccount(res.publickey)
        account.name = name
        account.serverUrl = serverUrl
        account.blocks = res.blocks
        account.secretkey = secretkey
        account.devicetoken = res.devicetoken
        account.status = res.status
        account.contacts = [{ name: 'moi', pk: res.publickey, url: serverUrl, type: 'citizen' }]

        const user = await this.localDB.saveUser(account)
        this.userService.setConnectedUser(user, sk)
        this.router.navigate(['/home']);
      },
      error: (err) => {
        alert("Utilisateur ou mot de passe invalide")
        console.log(err)
      }
    })
  }
}
