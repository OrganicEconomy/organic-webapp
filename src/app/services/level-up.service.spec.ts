import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { LevelUpService } from './level-up.service';
import { LevelUpDialog } from '../components/level-up-dialog/level-up-dialog';

describe('LevelUpService', () => {
  let service: LevelUpService;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      providers: [
        LevelUpService,
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    service = TestBed.inject(LevelUpService);
  });

  it('should not open a dialog when the level did not increase', () => {
    service.celebrateIfLevelUp(3, 3);
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should open the LevelUpDialog with the old and new level when the level increased', () => {
    service.celebrateIfLevelUp(3, 4);
    expect(dialogSpy.open).toHaveBeenCalledWith(LevelUpDialog, { data: { oldLevel: 3, newLevel: 4 } });
  });
});
