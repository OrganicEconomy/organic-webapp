import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';



@Component({
  selector: 'app-signup-page',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  public signupForm !: FormGroup
  server = inject(ServerConnexionService);
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
          console.log(res)
        },
        error: (err) => {
          alert("Utilisateur ou mot de passe invalide")
        }
      })
  }
}
