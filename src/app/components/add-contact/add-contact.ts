import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { decodeQr } from 'organic-protocol';
import type { Contact } from '../../models/account';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { QrScanner } from '../qr-scanner/qr-scanner';

@Component({
  selector: 'app-add-contact',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    QrScanner,
  ],
  templateUrl: './add-contact.html',
  styleUrl: './add-contact.css',
})
export class AddContact {
  public addcontactForm !: FormGroup
  public scanError = ''
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)

  user = this.userService.getConnectedUser()
  private scannedIsEcosystem = false

  constructor(private formBuilder: FormBuilder, private router: Router) {
    if (this.user === null) {
      this.router.navigate(['/user-selection']);
      return
    }
  }

  ngOnInit(): void {
    this.addcontactForm = this.formBuilder.group({
      name: [""],
      pk: [""],
      url: [""],
    })
  }

  scanSuccessHandler(result: string) {
    this.scanError = ''
    let decoded
    try {
      decoded = decodeQr(result)
    } catch {
      this.scanError = "Ce QR n'est pas reconnu."
      return
    }
    if (decoded.type !== 'CT') {
      this.scanError = "Ce QR n'est pas une carte de contact."
      return
    }
    this.scannedIsEcosystem = !!decoded.payload.e
    this.addcontactForm.patchValue({
      name: decoded.payload.n,
      pk: decoded.payload.pk,
      url: decoded.payload.url,
    })
  }

  async addContact() {
    const contact: Contact = {
      name: this.addcontactForm.value.name,
      pk: this.addcontactForm.value.pk,
      url: this.addcontactForm.value.url,
      type: this.scannedIsEcosystem ? 'ecosystem' : 'citizen',
    }
    this.user.contacts.push(contact)
    await this.localDB.saveUser(this.user)
    this.router.navigate(['/contacts']);
  }
}