import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatFormField } from "@angular/material/form-field";
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-pay',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatSelectModule
],
  templateUrl: './pay.html',
  styleUrl: './pay.css',
})
export class Pay {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  user = this.userService.getConnectedUser()
  contacts: any = []

  public payForm !: FormGroup

  constructor(private formBuilder: FormBuilder, private router: Router) {
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  ngOnInit(): void {
    this.payForm = this.formBuilder.group({
      target: [""],
      amount: [""],
      validation: false
    })

    this.contacts = this.user.contacts
  }

  pay(): void {
    
  }
}
