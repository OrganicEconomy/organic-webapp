import { Component, inject } from '@angular/core'
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { ServerConnexionService } from '../../services/server-connection.service'
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'


@Component({
  selector: 'app-signup-page',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  public signupForm !: FormGroup
  server = inject(ServerConnexionService)
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)
  constructor(private formBuilder: FormBuilder, private router: Router) { }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      email: [""],
      name: [""],
      password: [""],
      birthdate: [""]
    })
  }

  async signup() {
    const monthIndex = this.signupForm.value.birthdate.slice(2, 4) - 1
    const day = this.signupForm.value.birthdate.slice(0, 2)
    const year = this.signupForm.value.birthdate.slice(4, 8)
    const birthdate = new Date(year, monthIndex, day)

    const res = await this.server.signupNewUser(
      this.signupForm.value.name,
      this.signupForm.value.email,
      this.signupForm.value.password,
      birthdate)
    res.subscribe({
        next: (res) => {
          res.isuptodate = true
          let user = this.localDB.saveUser(res.publickey, res)
          this.userService.setConnectedUser(user)
          this.router.navigate(['/home']);
        },
        error: (err) => {
          alert("Utilisateur ou mot de passe invalide")
        }
      })
  }
}
