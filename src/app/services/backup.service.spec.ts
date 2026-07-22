import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BackupService } from './backup.service';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { ConnectedUserService } from './connected-user.service';

let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveLastBlock'>>;
let userServiceSpy: jasmine.SpyObj<Pick<ConnectedUserService, 'setReadOnly'>>;
let fakeUser: any;

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    fakeUser = { backupPolicy: 'every-tx', lastBackupAt: null, isuptodate: false };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveLastBlock']);
    serverDBSpy.saveLastBlock.and.returnValue(of({}));
    userServiceSpy = jasmine.createSpyObj('ConnectedUserService', ['setReadOnly']);

    TestBed.configureTestingModule({
      providers: [
        BackupService,
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: ConnectedUserService, useValue: userServiceSpy },
      ],
    });

    service = TestBed.inject(BackupService);
  });

  it('recordAutomatic should always save locally', () => {
    service.recordAutomatic(fakeUser, 'sk');
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeUser);
  });

  it('recordAutomatic should push to the server under every-tx', () => {
    fakeUser.backupPolicy = 'every-tx';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveLastBlock).toHaveBeenCalledWith(fakeUser, 'sk');
  });

  it('recordAutomatic should not push to the server under manual or payments-only', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveLastBlock).not.toHaveBeenCalled();

    fakeUser.backupPolicy = 'payments-only';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveLastBlock).not.toHaveBeenCalled();
  });

  it('recordPayment should always push to the server, regardless of policy', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordPayment(fakeUser, 'sk');
    expect(serverDBSpy.saveLastBlock).toHaveBeenCalledWith(fakeUser, 'sk');
  });

  it('should update lastBackupAt and isuptodate on a successful push', () => {
    service.recordPayment(fakeUser, 'sk');
    expect(fakeUser.isuptodate).toBeTrue();
    expect(fakeUser.lastBackupAt).not.toBeNull();
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeUser);
  });

  it('should mark the session read-only on a 409', () => {
    serverDBSpy.saveLastBlock.and.returnValue(throwError(() => ({ status: 409 })));
    service.recordPayment(fakeUser, 'sk');
    expect(userServiceSpy.setReadOnly).toHaveBeenCalled();
  });
});
