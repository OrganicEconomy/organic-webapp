import { Component } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {signal} from '@angular/core';

const userBlockchain = signal('userBlockchain');

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
  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: [""],
      password: [""],
      stayConnected: false
    })
  }

  login() {
    this.http.get<any>("http://127.0.0.1:3000/signupUsersList")
      .subscribe({
        next: res => {
          const user = res.find((a:any)=>{
            return a.email === this.loginForm.value.email && a.password === this.loginForm.value.password 
          });
          if(user){
            alert('Login Succesful')
            this.loginForm.reset()
            this.router.navigate(["home"])
          } else {
            alert("user not found")
          }
        },
        error: err => {
          alert("Something went wrong")
        }
      })
  }

}
