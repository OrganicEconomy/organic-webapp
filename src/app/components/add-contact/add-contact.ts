import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';

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
