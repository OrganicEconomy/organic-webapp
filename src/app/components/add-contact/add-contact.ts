import { Component } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-add-contact',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './add-contact.html',
  styleUrl: './add-contact.css',
})
export class AddContact {
public addcontactForm !: FormGroup
  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.addcontactForm = this.formBuilder.group({
      name: [""],
      pk: [""]
    })
  }

  addContact(): void {
    
  }
}
