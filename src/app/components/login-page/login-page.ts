import { Component, inject } from '@angular/core';
import { FormGroup, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ConnectedUserService } from '../../services/connected-user.service';
import { makeDefaultAccount } from '../../models/account';
import { environment } from '../../../environments/environment';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  public loginForm!: FormGroup;
  public hidePassword = true;

  server = inject(ServerConnexionService);
  localDB = inject(LocalDatabaseService);
  userService = inject(ConnectedUserService);

  constructor(private formBuilder: FormBuilder, private router: Router) { }

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: [""],
      password: [""],
      stayConnected: false
    });
  }

  // TODO(Phase 1 step 5): superseded by restore-account, which will also
  // verify the password locally (decryptSecretKey) instead of trusting the
  // server response as-is.
  login() {
    const serverUrl = environment.serverUrl
    this.server.login(serverUrl, this.loginForm.value.email, this.loginForm.value.password)
      .subscribe({
        next: async (res) => {
          const account = makeDefaultAccount(res.publickey)
          account.name = res.name
          account.serverUrl = serverUrl
          account.blocks = res.blocks
          account.secretkey = res.secretkey
          account.devicetoken = res.devicetoken
          account.isuptodate = true

          const user = await this.localDB.saveUser(account);
          // No decrypted sk here yet — this flow doesn't verify the password
          // locally (see the TODO above). Signing operations won't work until
          // restore-account (step 5) replaces this with a real decrypt step.
          this.userService.setConnectedUser(user, '');
          this.router.navigate(['/home']);
        },
        error: (err: Error) => {
          alert("Utilisateur ou mot de passe invalide");
        }
      });
  }
}