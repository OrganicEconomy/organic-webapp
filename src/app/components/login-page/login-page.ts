import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service'
import { ConnectedUserService } from '../../services/connected-user.service'

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  public loginForm !: FormGroup
  server = inject(ServerConnexionService);
  localDB = inject(LocalDatabaseService)
  userService = inject(ConnectedUserService)
  constructor(private formBuilder: FormBuilder, private router: Router) { }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: [""],
      password: [""],
      stayConnected: false
    })
  }

  login() {
    this.server.login(this.loginForm.value.email, this.loginForm.value.password)
      .subscribe({
        next: (res: any) => {
          console.log(res)
          res.isuptodate = true
          let user = this.localDB.saveUser(res.publickey, res)
          this.userService.setConnectedUser(user)
          this.router.navigate(['/home']);
        },
        error: (err: Error) => {
          alert("Utilisateur ou mot de passe invalide")
        }
      })
  }

}
