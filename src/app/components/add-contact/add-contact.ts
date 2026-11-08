import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { ContactCheckService } from '../../services/contact-check.service';
import { decodeQr } from 'organic-protocol';
import type { ServerListEntry } from 'organic-protocol';
import type { Contact } from '../../models/account';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { QrScanner } from '../qr-scanner/qr-scanner';

@Component({
  selector: 'app-add-contact',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatAutocompleteModule,
    QrScanner,
  ],
  templateUrl: './add-contact.html',
  styleUrl: './add-contact.css',
})
export class AddContact {
  public addcontactForm !: FormGroup
  public scanError = ''
  public formError = ''
  public recognizedContactName: string | null = null
  public knownServers: ServerListEntry[] = []
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  server = inject(ServerConnexionService)
  contactCheck = inject(ContactCheckService)

  user = this.userService.getConnectedUser()
  private scannedIsEcosystem = false

  constructor(private formBuilder: FormBuilder, private router: Router, private route: ActivatedRoute) {
    if (this.user === null) {
      this.router.navigate(['/user-selection'], { queryParams: { next: this.thisPageUrl() } });
      return
    }
  }

  private thisPageUrl(): string {
    const thisPage = this.router.createUrlTree(['/addcontact'], { queryParams: this.route.snapshot.queryParams })
    return this.router.serializeUrl(thisPage)
  }

  ngOnInit(): void {
    const sharedContact = this.route.snapshot.queryParamMap
    this.addcontactForm = this.formBuilder.group({
      name: [sharedContact.get('name') ?? ""],
      pk: [sharedContact.get('pk') ?? ""],
      url: [sharedContact.get('server') ?? this.user?.serverUrl ?? ""],
    })
    if (this.user) {
      this.loadKnownServers()
    }
  }

  private loadKnownServers(): void {
    this.server.getKnownServers(this.user.serverUrl).subscribe({
      next: (servers) => this.knownServers = servers,
      error: () => this.knownServers = [],
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
    this.recognizedContactName = decoded.payload.n
    this.formError = ''
    this.addcontactForm.patchValue({
      name: decoded.payload.n,
      pk: decoded.payload.pk,
      url: decoded.payload.url,
    })
  }

  scanAgain() {
    this.recognizedContactName = null
  }

  async addContact() {
    const contact = this.contactFromForm()
    const refusal = await this.contactCheck.refusal(contact, this.user)
    if (refusal) {
      this.formError = refusal
      return
    }
    this.user.contacts.push(contact)
    await this.localDB.saveUser(this.user)
    this.router.navigate(['/contacts']);
  }

  private contactFromForm(): Contact {
    return {
      name: this.addcontactForm.value.name.trim(),
      pk: this.addcontactForm.value.pk.trim(),
      url: this.addcontactForm.value.url,
      type: this.scannedIsEcosystem ? 'ecosystem' : 'citizen',
    }
  }
}
