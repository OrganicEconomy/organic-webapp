import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MainLayout } from './main-layout';
import { ConnectedUserService, ReadOnlyReason } from '../../services/connected-user.service';

describe('MainLayout', () => {
  let fixture: ComponentFixture<MainLayout>;
  let readOnlyReason: ReadOnlyReason | null;
  let takeTheAccountBack: jasmine.Spy;
  let snackBarSpy: jasmine.SpyObj<Pick<MatSnackBar, 'open'>>;

  beforeEach(async () => {
    readOnlyReason = null;
    takeTheAccountBack = jasmine.createSpy('useThisTab').and.resolveTo();
    snackBarSpy = jasmine.createSpyObj('MatSnackBar', ['open']);
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: { readOnlyReason: () => readOnlyReason, useThisTab: takeTheAccountBack } },
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
  });

  function otherTabBanner(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.other-tab-banner');
  }

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show the four permanent tabs (Phase-1.md §7 navigation card)', () => {
    const links = fixture.debugElement.queryAll(By.css('nav.bottom-nav a'))
    const hrefs = links.map((link) => link.nativeElement.getAttribute('href'))
    expect(links.length).toBe(4)
    expect(hrefs).toContain('/home')
    expect(hrefs).toContain('/pay')
    expect(hrefs).toContain('/contacts')
    expect(hrefs).toContain('/account')
  });

  describe('template', () => {
    it('should say on every page that another tab took the account over', () => {
      readOnlyReason = 'other-tab';
      fixture.detectChanges();

      expect(otherTabBanner()?.textContent).toContain('Compte ouvert dans un autre onglet');
    });

    it('should show no such banner while this tab holds the account', () => {
      expect(otherTabBanner()).toBeNull();
    });
  });

  describe('useThisTab', () => {
    it('should take the account back, then reopen the current page with it', async () => {
      const router = TestBed.inject(Router);
      const currentPage = router.url;
      const navigateByUrl = spyOn(router, 'navigateByUrl').and.resolveTo(true);

      await fixture.componentInstance.useThisTab();

      expect(takeTheAccountBack).toHaveBeenCalledBefore(navigateByUrl);
      expect(navigateByUrl.calls.allArgs()).toEqual([
        ['/user-selection', { skipLocationChange: true }],
        [currentPage],
      ]);
    });

    it('should say that the account could not be taken back, and stay on the page', async () => {
      takeTheAccountBack.and.rejectWith(new Error('unreadable'));
      spyOn(console, 'error');
      const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl');

      await fixture.componentInstance.useThisTab();

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        "Impossible de reprendre le compte dans cet onglet : reconnectez-vous depuis l'écran de connexion.",
        'Fermer',
      );
      expect(navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
