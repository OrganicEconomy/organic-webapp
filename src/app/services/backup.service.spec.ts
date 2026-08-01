import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { BackupService } from './backup.service';
import { LocalDatabaseService } from './local-database.service';
import { ServerConnexionService } from './server-connection.service';
import { ConnectedUserService } from './connected-user.service';

let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveBlock'>>;
let userServiceSpy: jasmine.SpyObj<Pick<ConnectedUserService, 'setReadOnly'>>;
let fakeUser: any;

// A fake "block": just enough shape for blocksNeedingSync's findIndex/isSigned/signature use.
function fakeBlock(signature: string, signed = true): any {
  return { signature, isSigned: () => signed };
}

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    const currentBlock = fakeBlock('sig-current', false);
    fakeUser = {
      backupPolicy: 'every-tx',
      lastBackupAt: null,
      isuptodate: false,
      // The server already has this exact block as its last one — no backlog.
      lastSavedBlockSignature: 'sig-current',
      blockchain: {
        blocks: [currentBlock],
        getMyPublicKey: () => 'pk',
      },
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveBlock']);
    serverDBSpy.saveBlock.and.returnValue(of({}));
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
    expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(fakeUser, 'sk', fakeUser.blockchain.blocks[0]);
  });

  it('recordAutomatic should not push to the server under manual or payments-only', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();

    fakeUser.backupPolicy = 'payments-only';
    service.recordAutomatic(fakeUser, 'sk');
    expect(serverDBSpy.saveBlock).not.toHaveBeenCalled();
  });

  it('recordPayment should always push to the server, regardless of policy', () => {
    fakeUser.backupPolicy = 'manual';
    service.recordPayment(fakeUser, 'sk').subscribe();
    expect(serverDBSpy.saveBlock).toHaveBeenCalledWith(fakeUser, 'sk', fakeUser.blockchain.blocks[0]);
  });

  it('should update lastBackupAt and isuptodate on a successful push', () => {
    service.recordPayment(fakeUser, 'sk').subscribe();
    expect(fakeUser.isuptodate).toBeTrue();
    expect(fakeUser.lastBackupAt).not.toBeNull();
    expect(localDBSpy.saveUser).toHaveBeenCalledWith(fakeUser);
  });

  it('should mark the session read-only on a 409', () => {
    serverDBSpy.saveBlock.and.returnValue(throwError(() => ({ status: 409 })));
    service.recordPayment(fakeUser, 'sk').subscribe({ error: () => {} });
    expect(userServiceSpy.setReadOnly).toHaveBeenCalled();
  });

  it('recordPayment should not issue a second server request when the caller subscribes to the returned observable', () => {
    let subscribeCount = 0;
    serverDBSpy.saveBlock.and.returnValue(new Observable((subscriber) => {
      subscribeCount++;
      subscriber.next({});
      subscriber.complete();
    }));

    // Mirrors real usage in pay.ts: the caller subscribes to what recordPayment returns.
    service.recordPayment(fakeUser, 'sk').subscribe();

    expect(subscribeCount).toBe(1);
  });

  it('should catch up on blocks closed locally since the last confirmed save, oldest first, before the current one', () => {
    const oldSaved = fakeBlock('sig-old-saved');
    const closedA = fakeBlock('sig-a');
    const closedB = fakeBlock('sig-b');
    const current = fakeBlock('sig-current', false);
    // Newest-first, as Blockchain.blocks is ordered — closedA/closedB were
    // closed locally but never made it to the server (e.g. offline).
    fakeUser.blockchain.blocks = [current, closedB, closedA, oldSaved];
    fakeUser.lastSavedBlockSignature = 'sig-old-saved';

    const sentBlocks: any[] = [];
    serverDBSpy.saveBlock.and.callFake((_user: any, _sk: any, block: any) => {
      sentBlocks.push(block);
      return of({});
    });

    service.recordPayment(fakeUser, 'sk').subscribe();

    expect(sentBlocks).toEqual([closedA, closedB, current]);
  });

  it('should update lastSavedBlockSignature to the newest signed block actually confirmed by the server', () => {
    const oldKnown = fakeBlock('sig-old-known');
    const closedA = fakeBlock('sig-a');
    const current = fakeBlock('sig-current', false);
    fakeUser.blockchain.blocks = [current, closedA, oldKnown];
    fakeUser.lastSavedBlockSignature = 'sig-old-known';

    service.recordPayment(fakeUser, 'sk').subscribe();

    // closedA is signed (its signature is now confirmed server-side); the
    // still-open current block has no stable signature to point to.
    expect(fakeUser.lastSavedBlockSignature).toBe('sig-a');
  });

  it('should stop and not send later blocks once one save in the sequence fails', () => {
    const oldKnown = fakeBlock('sig-old-known');
    const closedA = fakeBlock('sig-a');
    const current = fakeBlock('sig-current', false);
    fakeUser.blockchain.blocks = [current, closedA, oldKnown];
    fakeUser.lastSavedBlockSignature = 'sig-old-known';

    let callCount = 0;
    serverDBSpy.saveBlock.and.callFake(() => {
      callCount++;
      return throwError(() => ({ status: 500 }));
    });

    service.recordPayment(fakeUser, 'sk').subscribe({ error: () => {} });

    expect(callCount).toBe(1);
  });
});
