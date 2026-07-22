import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CashPapers } from './cash-papers';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { ServerConnexionService } from '../../services/server-connection.service';
import { LevelUpService } from '../../services/level-up.service';

let fakeBlockchain: any;
let fakeAccount: any;
let stubConnectedUserService: any;
let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;
let serverDBSpy: jasmine.SpyObj<Pick<ServerConnexionService, 'saveLastBlock' | 'cashPaper'>>;
let levelUpSpy: jasmine.SpyObj<Pick<LevelUpService, 'celebrateIfLevelUp'>>;

describe('CashPapers', () => {
  let component: CashPapers;
  let fixture: ComponentFixture<CashPapers>;

  beforeEach(async () => {
    fakeBlockchain = {
      cashPaper: jasmine.createSpy('cashPaper'),
      getLevel: () => 2,
    };
    fakeAccount = {
      serverUrl: 'https://trifouillis.fr',
      contacts: [],
      blockchain: fakeBlockchain,
    };
    stubConnectedUserService = {
      getConnectedUser: () => fakeAccount,
      getSecretKey: () => 'the-real-sk',
    };
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    serverDBSpy = jasmine.createSpyObj('ServerConnexionService', ['saveLastBlock', 'cashPaper']);
    levelUpSpy = jasmine.createSpyObj('LevelUpService', ['celebrateIfLevelUp']);

    await TestBed.configureTestingModule({
      imports: [CashPapers],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: stubConnectedUserService },
        { provide: LocalDatabaseService, useValue: localDBSpy },
        { provide: ServerConnexionService, useValue: serverDBSpy },
        { provide: LevelUpService, useValue: levelUpSpy },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(CashPapers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should ask LevelUpService to celebrate using the level captured before and after cashing the batch', () => {
    fakeBlockchain.getLevel = jasmine.createSpy('getLevel').and.returnValues(2, 3);
    component.paper_list = [{ hash: 'abc', money: [1, 2] }];

    component.cashPapers();

    expect(levelUpSpy.celebrateIfLevelUp).toHaveBeenCalledWith(2, 3);
  });
});
