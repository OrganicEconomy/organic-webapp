import { Component, inject } from '@angular/core'
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { ServerConnexionService } from '../../services/server-connection.service'
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'

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

  constructor(private formBuilder: FormBuilder, private router: Router) { }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      email: [""],
      name: [""],
      password: [""],
    })
  }

  signup() {
    const birthdate = new Date()

    const res = this.server.signupNewUser(
      this.signupForm.value.name,
      this.signupForm.value.email,
      this.signupForm.value.password,
      birthdate)
    res.subscribe({
      next: async (res) => {
        res.isuptodate = true
        res.contacts = [{ name: "moi", pk: res.publickey }]
        let user = await this.localDB.saveUser(res)
        this.userService.setConnectedUser(user)
        this.router.navigate(['/home']);
      },
      error: (err) => {
        alert("Utilisateur ou mot de passe invalide")
      }
    })
  }
}
