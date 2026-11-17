import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConnectedUserService } from '../../services/connected-user.service';
import { MatFormField } from "@angular/material/form-field";
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';
import { BackupService, UndoNotStoredError } from '../../services/backup.service';
import { LocalSaveError } from '../../services/local-database.service';
import { isDeviceRevoked } from '../../services/server-error.util';
import { toDisplayRow, getContactName } from '../../utils/transaction-display.util';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Observable, catchError, finalize, map, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { lookupFailure } from '../../utils/lookup-failure.util';
import { MALFORMED_PUBLIC_KEY_MESSAGE, isWellFormedPublicKey } from '../../utils/public-key.util';

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

@Component({
  selector: 'app-pay',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatSelectModule,
    MatSliderModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    FormsModule
  ],
  templateUrl: './pay.html',
  styleUrl: './pay.css',
})
export class Pay {
  userService = inject(ConnectedUserService)
  serverDB = inject(ServerConnexionService)
  levelUp = inject(LevelUpService)
  backupService = inject(BackupService)
  user = this.userService.getConnectedUser()
  contacts: any = []
  amount = 0;
  max = 0;
  target: string = "";
  recentTransactions: any[] = []
  checkingRecipient = false
  paying = false

  private _snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  public payForm !: FormGroup

  constructor(private formBuilder: FormBuilder, private router: Router) {
    if (!this.user) {
      this.router.navigate(['/user-selection']);
      return
    }
    this.max = this.user.blockchain.getAvailableMoneyAmount()

    const bc = this.user.blockchain
    this.recentTransactions = bc.getHistory().slice(0, 5)
      .map((tx: any) => toDisplayRow(tx, bc.getMyPublicKey(), this.user.contacts))
  }

  ngOnInit(): void {
    this.contacts = this.user.contacts
  }

  selectedValue(event: MatSelectChange) {
    this.target = event.value
  }

  itIsMe(pk: string) {
    return pk === this.user.blockchain.getMyPublicKey()
  }

  pay(): void {
    if (this.checkingRecipient || this.paying) {
      return;
    }
    if (!this.target) {
      this.displayMessage("Le  champs 'Qui est-ce qu'on paye ?' est obligatoire.")
      return;
    }
    if (!isWellFormedPublicKey(this.target)) {
      this.displayMessage(MALFORMED_PUBLIC_KEY_MESSAGE)
      return;
    }
    if (this.isOnAnotherServer(this.targetContact())) {
      this.displayMessage("Ce contact est inscrit sur un autre serveur : les paiements entre serveurs ne sont pas encore possibles.")
      return;
    }
    if (this.amount <= 0) {
      this.displayMessage("Le montant à payer doit être supérieur à zéro.")
      return;
    }
    if (this.userService.isReadOnlySession()) {
      this.displayMessage("Ce compte est actif sur un autre appareil — lecture seule.")
      return;
    }

    if (this.itIsMe(this.target)) {
      this.confirmPayment()
      return
    }
    this.checkingRecipient = true
    this.recipientRefusal()
      .pipe(
        finalize(() => this.checkingRecipient = false),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((refusal) => refusal ? this.displayMessage(refusal) : this.confirmPayment())
  }

  private recipientRefusal(): Observable<string | null> {
    return this.targetContact()?.type === 'ecosystem'
      ? this.ecosystemRefusal()
      : this.citizenRefusal()
  }

  private ecosystemRefusal(): Observable<string | null> {
    return this.serverDB.getEcosystemInfo(this.user.serverUrl, this.target).pipe(
      map(() => null),
      catchError((error) => of(this.lookupRefusal(error, "Cet écosystème n'existe pas sur ton serveur."))),
    )
  }

  private citizenRefusal(): Observable<string | null> {
    return this.serverDB.getValidationStatus(this.user.serverUrl, this.target).pipe(
      map(({ status }) => status === 'active' ? null : "Ce destinataire n'est pas un citoyen actif."),
      catchError((error) => of(this.lookupRefusal(error, "Ce destinataire n'est pas inscrit sur ton serveur."))),
    )
  }

  private lookupRefusal(error: HttpErrorResponse, unknownRecipientMessage: string): string {
    switch (lookupFailure(error)) {
      case 'unknown':
        return unknownRecipientMessage
      case 'unreachable':
        return 'Impossible de vérifier le destinataire : pas de connexion au serveur.'
      case 'server-error':
        return 'Impossible de vérifier le destinataire : le serveur ne répond pas correctement.'
    }
  }

  private confirmPayment(): void {
    const recipient = getContactName(this.target, this.user.blockchain.getMyPublicKey(), this.contacts)
    const dialogRef = this.dialog.open(ConfirmDialog, {
      data: { title: 'Payer', message: `Payer ${this.amount} à ${recipient} ? Cette action est irréversible.` },
    });
    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.executePayment();
    });
  }

  private targetContact(): any {
    return this.contacts.find((contact: any) => contact.pk === this.target)
  }

  private isOnAnotherServer(contact: any): boolean {
    return !!contact?.url && originOf(contact.url) !== originOf(this.user.serverUrl)
  }

  private executePayment(): void {
    const sk = this.userService.getSecretKey()
    const oldLevel = this.user.blockchain.getLevel()
    if (this.itIsMe(this.target)) {
      this.payMyself(sk, oldLevel)
    } else {
      this.paySomeoneElse(sk, oldLevel)
    }
  }

  private async payMyself(sk: string, oldLevel: number): Promise<void> {
    try {
      await this.backupService.applyAndRecord(this.user, sk, () => this.user.blockchain.pay(sk, this.target, this.amount))
    } catch (err) {
      console.error(err)
      this.displayMessage(this.cancelledPaymentMessage(err))
      return
    }
    this.displayMessage("Paiement enregistré avec succès.")
    this.finishPayment(oldLevel)
  }

  private paySomeoneElse(sk: string, oldLevel: number): void {
    this.paying = true
    this.backupService.applyAndSave(this.user, sk, () => this.user.blockchain.pay(sk, this.target, this.amount))
      .subscribe({
        next: (tx) => this.send(tx, oldLevel),
        error: (err) => {
          this.paying = false
          console.log(err)
          this.displayMessage(this.cancelledPaymentMessage(err))
        },
      })
  }

  private cancelledPaymentMessage(err: any): string {
    if (err instanceof UndoNotStoredError) {
      return err.message
    }
    if (err instanceof LocalSaveError) {
      return "Paiement annulé : cet appareil n'a pas pu l'enregistrer. Rien n'a été débité."
    }
    if (!(err instanceof HttpErrorResponse)) {
      return "Une erreur est survenue oO"
    }
    if (isDeviceRevoked(err)) {
      return "Ce compte est actif sur un autre appareil : paiement annulé, rien n'a été débité."
    }
    return "Paiement annulé : il n'a pas pu être enregistré sur le serveur. Rien n'a été débité."
  }

  private send(tx: any, oldLevel: number): void {
    const sending = this.targetContact()?.type === 'ecosystem'
      ? this.serverDB.sendEcosystemTx(this.user.serverUrl, this.target, tx.export())
      : this.serverDB.sendTransaction(this.user.serverUrl, tx.export())
    sending.subscribe({
      next: () => {
        this.displayMessage("Paiement enregistré et envoyé avec succès.")
        this.finishPayment(oldLevel)
      },
      error: (err) => {
        this.paying = false
        console.log(err)
        this.displayMessage("Paiement enregistré mais non transmis au destinataire — réessayez plus tard.")
      },
    })
  }

  private finishPayment(oldLevel: number): void {
    this.levelUp.celebrateIfLevelUp(oldLevel, this.user.blockchain.getLevel())
    this.router.navigate(['/home']);
  }

  displayMessage(message: string) {
    this._snackBar.open(message, 'Fermer', { duration: 3000 });
  }
}
