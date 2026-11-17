import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

const DETOUR_PAGE = '/user-selection';

@Injectable({ providedIn: 'root' })
export class PageReopenerService {
  private router = inject(Router);

  async reopenCurrentPage(): Promise<void> {
    const currentPage = this.router.url;
    await this.router.navigateByUrl(DETOUR_PAGE, { skipLocationChange: true });
    await this.router.navigateByUrl(currentPage);
  }
}
