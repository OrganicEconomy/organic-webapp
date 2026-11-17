import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { PageReopenerService } from './page-reopener.service';

describe('PageReopenerService', () => {
  describe('reopenCurrentPage', () => {
    it('should leave the current page without changing the address, then open it again', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const router = TestBed.inject(Router);
      const currentPage = router.url;
      const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);

      await TestBed.inject(PageReopenerService).reopenCurrentPage();

      expect(navigateByUrl.calls.allArgs()).toEqual([
        ['/user-selection', { skipLocationChange: true }],
        [currentPage],
      ]);
    });
  });
});
