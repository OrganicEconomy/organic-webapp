import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatFormField } from "@angular/material/form-field";
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ServerConnexionService } from '../../services/server-connection.service';

@Component({
  selector: 'app-pay',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatInputModule,
    MatCardModule,
    FormsModule
  ],
  templateUrl: './pay.html',
  styleUrl: './pay.css',
})
export class Pay {
  userService = inject(ConnectedUserService)
  localDB = inject(LocalDatabaseService)
  serverDB = inject(ServerConnexionService)
  user = this.userService.getConnectedUser()
  contacts: any = []
  amount = 0;
  max = 0;
  target: string = "";
  validated: boolean = false;

  private _snackBar = inject(MatSnackBar);

  public payForm !: FormGroup

  constructor(private formBuilder: FormBuilder, private router: Router) {
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.max = this.user.blockchain.getAvailableMoneyAmount()
  }

  ngOnInit(): void {
    this.contacts = this.user.contacts
  }

  selectedValue(event: MatSelectChange) {
    this.target = event.value
  }

  pay(): void {
    if (!this.target) {
      this.displayMessage("Le  champs 'Qui est-ce qu'on paye ?' est obligatoire.")
      return;
    }
    if (this.amount <= 0) {
      this.displayMessage("Le montant à payer doit être supérieur à zéro.")
      return;
    }
    if (!this.validated) {
      this.displayMessage("Veuillez cocher la case 'J'ai compris qu'en cliquant sur 'Payer' je ne reviendrai pas en arrière.'")
      return;
    }
    try {
      const tx = this.user.blockchain.pay(this.user.secretkey, this.target, this.amount)
      this.localDB.saveUser(this.user)
      this.serverDB.saveLastBlock(this.user.blockchain.getMyPublicKey(), this.user.blockchain.lastblock)
      this.displayMessage("Paiement enregistré et envoyé avec succès.")
      this.router.navigate(['/home']);
    } catch (err) {
      console.log(err)
      this.displayMessage("Une erreur est survenue oO")
    }
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
