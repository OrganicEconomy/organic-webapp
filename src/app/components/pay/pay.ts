import { Component } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-pay',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './pay.html',
  styleUrl: './pay.css',
})
export class Pay {
  public payForm !: FormGroup
  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.payForm = this.formBuilder.group({
      target: [""],
      amount: [""],
      validation: false
    })
  }

  pay(): void {
    
  }
}
