import { Component } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';



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
  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.signupForm = this.formBuilder.group({
      email: [""],
      name: [""],
      password: [""]
    })
  }

  signup() {
    console.log(this.signupForm.value)
    this.http.post<any>("https://127.0.0.1:3000/register", this.signupForm.value)
      .subscribe({
        next: res => {
          alert('SIGNUP SUCCESSFUL');
          this.signupForm.reset();
          this.router.navigate(["login"])
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }
}
