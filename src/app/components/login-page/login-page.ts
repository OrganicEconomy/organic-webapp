import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  public loginForm !: FormGroup
  server = inject(ServerConnexionService);
  constructor(private formBuilder: FormBuilder, private router: Router) { }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: [""],
      password: [""],
      stayConnected: false
    })
  }

  async login() {
    this.server.login(this.loginForm.value.email, this.loginForm.value.password)
      .subscribe({
        next: (res) => {
          console.log(res)
        },
        error: (err) => {
          alert("Utilisateur ou mot de passe invalide")
        }
      })

  }

}
