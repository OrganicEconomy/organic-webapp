import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-add-contact',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './add-contact.html',
  styleUrl: './add-contact.css',
})
export class AddContact {
  public addcontactForm !: FormGroup
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)

  user = this.userService.getConnectedUser()

  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router) {
    if (this.user === null) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  ngOnInit(): void {
    this.addcontactForm = this.formBuilder.group({
      name: [""],
      pk: [""]
    })
  }

  async addContact() {
    this.user.contacts.push({
      name: this.addcontactForm.value.name,
      pk: this.addcontactForm.value.pk
    })
    await this.localDB.saveUser(this.user)
    this.router.navigate(['/contacts']);
  }
}