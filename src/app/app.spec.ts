import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SessionLockService } from './services/session-lock.service';

describe('App', () => {
  let lockServiceSpy: jasmine.SpyObj<Pick<SessionLockService, 'start'>>;

  beforeEach(async () => {
    lockServiceSpy = jasmine.createSpyObj('SessionLockService', ['start']);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SessionLockService, useValue: lockServiceSpy }],
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

      expect(lockServiceSpy.start).toHaveBeenCalled();
    });
  });
});
