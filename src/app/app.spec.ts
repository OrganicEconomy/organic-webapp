import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SessionLockService } from './services/session-lock.service';
import { ChainSyncService } from './services/chain-sync.service';

describe('App', () => {
  let lockServiceSpy: jasmine.SpyObj<Pick<SessionLockService, 'startWatchingIdleness'>>;
  let chainSyncSpy: jasmine.SpyObj<Pick<ChainSyncService, 'startSyncingWhenBackOnline'>>;

  beforeEach(async () => {
    lockServiceSpy = jasmine.createSpyObj('SessionLockService', ['startWatchingIdleness']);
    chainSyncSpy = jasmine.createSpyObj('ChainSyncService', ['startSyncingWhenBackOnline']);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SessionLockService, useValue: lockServiceSpy },
        { provide: ChainSyncService, useValue: chainSyncSpy },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('constructor', () => {
    it('should start watching for idleness, to lock the session after a while', () => {
      TestBed.createComponent(App);

      expect(lockServiceSpy.startWatchingIdleness).toHaveBeenCalled();
    });

    it('should start syncing with the server each time the network comes back', () => {
      TestBed.createComponent(App);

      expect(chainSyncSpy.startSyncingWhenBackOnline).toHaveBeenCalled();
    });
  });
});
