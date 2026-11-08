import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { decodeQr } from 'organic-protocol';

import { AccountDetails } from './account-details';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService, LocalSaveError } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { BackupService } from '../../services/backup.service';
import { decryptSecretKey, encryptSecretKey } from '../../services/secret-key-crypto.util';
import { contactLink } from '../../utils/contact-link.util';

const REAL_SK_HEX = 'ed945716dddb7af2c9774939e9946f1fee31f5ec0a3c6ec96059f119c396912f';

let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser' | 'saveUserInBackground'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'getServerInfo' | 'changePassword'>>;
let backupSpy: jasmine.SpyObj<Pick<BackupService, 'saveNow'>>;

describe('AccountDetails', () => {
  let component: AccountDetails;
  let fixture: ComponentFixture<AccountDetails>;

  beforeEach(async () => {
    fakeAccount = {
      name: 'Alice',
      publickey: 'alice-pk',
      serverUrl: 'https://trifouillis.fr',
      backupPolicy: 'every-tx',
      lastBackupAt: null,
      secretkey: await encryptSecretKey(REAL_SK_HEX, 'old-password'),
      blockchain: {
        blocks: [
          { closedate: new Date(2027, 2, 3) }, // dernier bloc (le plus récent)
          { closedate: new Date(2026, 0, 15) }, // bloc de naissance (le plus ancien)
        ],
      },
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => REAL_SK_HEX,
      isReadOnlySession: () => false,
      readOnlyMessage: () => "Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci.",
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser', 'saveUserInBackground']);
    localDBSpy.saveUser.and.callFake(async (account) => account);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['getServerInfo', 'changePassword']);
    serverDBSpy.getServerInfo.and.returnValue(of({
      protocolVersion: 1, apiVersion: '1', name: 'Serveur de Trifouillis',
      serverPk: 'x', corePk: null, stats: { users: 42 },
    }));
    serverDBSpy.changePassword.and.returnValue(of({}));
    backupSpy = jasmine.createSpyObj('BackupService', ['saveNow']);
    backupSpy.saveNow.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [AccountDetails, RouterTestingModule],
      providers: [
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: BackupService, useValue: backupSpy },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the birth block\'s close date as the inscription date', () => {
    expect(component.inscription_date).toBe(new Date(2026, 0, 15).toLocaleDateString('fr-FR'));
  });

  it('should generate a QR that decodes back to this account\'s contact card', () => {
    const decoded = decodeQr(component.myContactQr);

    expect(decoded.type).toBe('CT');
    if (decoded.type === 'CT') {
      expect(decoded.payload.pk).toBe('alice-pk');
      expect(decoded.payload.url).toBe('https://trifouillis.fr');
      expect(decoded.payload.n).toBe('Alice');
    }
  });

  it('should display the server info once fetched', () => {
    expect(component.serverInfo?.name).toBe('Serveur de Trifouillis');
    expect(component.serverInfo?.stats.users).toBe(42);
  });

  it('updateBackupPolicy() should keep the policy and say why in a read-only session', () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    spyOn(component, 'displayMessage');

    component.updateBackupPolicy('manual');

    expect(fakeAccount.backupPolicy).toBe('every-tx');
    expect(localDBSpy.saveUserInBackground).not.toHaveBeenCalled();
    expect(component.displayMessage).toHaveBeenCalledWith("Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci.");
  });

  it('changePassword() should not change the password from a read-only session', async () => {
    stubConnectedUserService.isReadOnlySession = () => true;
    spyOn(component, 'displayMessage');
    component.oldPassword = 'old-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'new-password';

    await component.changePassword();

    expect(serverDBSpy.changePassword).not.toHaveBeenCalled();
    expect(component.displayMessage).toHaveBeenCalledWith("Compte ouvert dans un autre onglet : rien n'est enregistré dans celui-ci.");
  });

  it('updateBackupPolicy() should persist the new policy locally', () => {
    component.updateBackupPolicy('manual');

    expect(component.backupPolicy).toBe('manual');
    expect(fakeAccount.backupPolicy).toBe('manual');
    expect(localDBSpy.saveUserInBackground).toHaveBeenCalledWith(fakeAccount);
  });

  it('saveNow() should call backupService.saveNow', () => {
    component.saveNow();

    expect(backupSpy.saveNow).toHaveBeenCalledWith(fakeAccount, REAL_SK_HEX);
  });

  it('changePassword() should reject a wrong old password without calling the server', async () => {
    component.oldPassword = 'wrong-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'new-password';

    await component.changePassword();

    expect(serverDBSpy.changePassword).not.toHaveBeenCalled();
  });

  it('changePassword() should re-encrypt the sk and call the server with the right old password', async () => {
    component.oldPassword = 'old-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'new-password';

    await component.changePassword();

    expect(serverDBSpy.changePassword).toHaveBeenCalled();
    const args = serverDBSpy.changePassword.calls.mostRecent().args;
    expect(args[0]).toBe('https://trifouillis.fr');
    expect(args[1]).toBe('alice-pk');
    expect(args[2]).toBe('new-password');
    expect(args[4]).toBe(REAL_SK_HEX);
  });

  it('changePassword() should store the newly encrypted key on this device', async () => {
    component.oldPassword = 'old-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'new-password';

    await component.changePassword();
    await fixture.whenStable();

    const storedKey = localDBSpy.saveUser.calls.mostRecent().args[0].secretkey;
    expect(await decryptSecretKey(storedKey, 'new-password')).toBe(REAL_SK_HEX);
  });

  it('changePassword() should say that this device keeps the old password when it could not store the new one', async () => {
    localDBSpy.saveUser.and.rejectWith(new LocalSaveError('device full'));
    spyOn(component, 'displayMessage');
    spyOn(console, 'error');
    const keyBefore = fakeAccount.secretkey;
    component.oldPassword = 'old-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'new-password';

    await component.changePassword();
    await fixture.whenStable();

    expect(fakeAccount.secretkey).toBe(keyBefore);
    expect(component.displayMessage).toHaveBeenCalledWith(
      "Mot de passe changé sur le serveur, mais cet appareil n'a pas pu l'enregistrer : ici, l'ancien mot de passe reste valable.",
    );
  });

  it('changePassword() should not call the server when the confirmation does not match', async () => {
    component.oldPassword = 'old-password';
    component.newPassword = 'new-password';
    component.newPasswordConfirm = 'something-else';

    await component.changePassword();

    expect(serverDBSpy.changePassword).not.toHaveBeenCalled();
  });

  describe('copyContactLink', () => {
    it('should copy to the clipboard the link that opens the contact form filled with my card', async () => {
      const writeText = spyOn(navigator.clipboard, 'writeText').and.resolveTo();

      await component.copyContactLink();

      expect(writeText).toHaveBeenCalledWith(
        contactLink(document.baseURI, { pk: 'alice-pk', url: 'https://trifouillis.fr', name: 'Alice' }),
      );
    });
  });
});
