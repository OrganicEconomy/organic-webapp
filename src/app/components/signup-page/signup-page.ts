import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http'
import { Component, inject } from '@angular/core'
import { FormGroup, FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { CitizenBlockchain } from 'organic-money/src/index.js'
import type { RegisterBody } from 'organic-protocol'
import { ServerConnexionService } from '../../services/server-connection.service'
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'
import { AccountTabsService } from '../../services/account-tabs.service'
import { encryptSecretKey } from '../../services/secret-key-crypto.util'
import { makeDefaultAccount, markAsBackedUp, type Account } from '../../models/account'
import { environment } from '../../../environments/environment'
import { formatDateInput, parseDateInput } from '../../utils/date-input.util'

// Angular Material imports
import { MatCardModule } from '@angular/material/card'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'


function dateInputValidator(control: AbstractControl): ValidationErrors | null {
  return parseDateInput(control.value) ? null : { invalidDate: true }
}

const NAME_MAX_LENGTH = 100

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
  public signingUp = false
  public readonly nameMaxLength = NAME_MAX_LENGTH

  server = inject(ServerConnexionService)
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)
  private tabs = inject(AccountTabsService)

  constructor(private formBuilder: FormBuilder, private router: Router, private route: ActivatedRoute) { }

  onBirthdateInput(event: Event): void {
    const input = event.target as HTMLInputElement
    this.signupForm.get('birthdate')?.setValue(formatDateInput(input.value))
  }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      email: ["", [Validators.required, Validators.email]],
      name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
      birthdate: ["", [Validators.required, dateInputValidator]],
      password: ["", Validators.required],
    })
  }

  private async trySaveOnDevice(account: Account): Promise<Account | null> {
    try {
      return await this.localDB.saveUser(account)
    } catch (error) {
      console.error(error)
      return null
    }
  }

  private isServerUnreachable(error: HttpErrorResponse): boolean {
    return error.status === 0
  }

  private isLimitingTheAttempts(error: HttpErrorResponse): boolean {
    return error.status === HttpStatusCode.TooManyRequests
  }

  private isMailAlreadyUsed(error: HttpErrorResponse): boolean {
    return error.status === HttpStatusCode.Conflict
  }

  private signupFailureMessage(error: HttpErrorResponse): string {
    if (this.isServerUnreachable(error)) {
      return 'Le serveur ne répond pas : vérifie ta connexion, puis réessaie.'
    }
    if (this.isLimitingTheAttempts(error)) {
      return 'Trop de tentatives depuis ce réseau : réessaie dans une minute.'
    }
    if (this.isMailAlreadyUsed(error)) {
      return "Cette adresse mail est déjà utilisée. Si c'est la tienne, restaure ton compte."
    }
    return "L'inscription a échoué — réessaie plus tard."
  }

  async signup() {
    if (this.signupForm.invalid || this.signingUp) return
    this.signingUp = true

    const { name, email, birthdate, password } = this.signupForm.value
    const serverUrl = this.route.snapshot.queryParamMap.get('server') ?? environment.serverUrl
    const birthdateObj = parseDateInput(birthdate)!

    // The BirthBlock is generated locally: the secret key never exists
    // anywhere but on this device, encrypted, from the very first block.
    const bc = new CitizenBlockchain()
    const sk = bc.makeBirthBlock(name, birthdateObj)
    const publickey = bc.getMyPublicKey()
    const secretkey = await encryptSecretKey(sk, password)

    const body: RegisterBody = {
      publickey,
      name,
      mail: email,
      password,
      birthdate: birthdateObj.toISOString().slice(0, 10),
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
        markAsBackedUp(account)

        this.tabs.takeBack(account.publickey)
        const user = await this.trySaveOnDevice(account)
        if (user === null) {
          alert("Ton compte est créé, mais cet appareil n'a pas pu l'enregistrer. Libère de la place, puis restaure-le.")
          this.router.navigate(['/restore-account'], { queryParams: { server: serverUrl } })
          return
        }
        this.userService.setConnectedUser(user, sk)
        if (res.status !== 'active') {
          this.router.navigate(['/pending-validation']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.signingUp = false
        alert(this.signupFailureMessage(error))
        console.error(error)
      }
    })
  }
}
