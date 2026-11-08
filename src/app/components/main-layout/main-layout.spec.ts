import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MainLayout } from './main-layout';
import { ConnectedUserService, ReadOnlyReason } from '../../services/connected-user.service';

describe('MainLayout', () => {
  let fixture: ComponentFixture<MainLayout>;
  let readOnlyReason: ReadOnlyReason | null;
  let useThisTab: jasmine.Spy;

  beforeEach(async () => {
    readOnlyReason = null;
    useThisTab = jasmine.createSpy('useThisTab').and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        { provide: ConnectedUserService, useValue: { readOnlyReason: () => readOnlyReason, useThisTab } },
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
    it('should take the account back and reopen the current page with it', async () => {
      readOnlyReason = 'other-tab';
      const navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

      await fixture.componentInstance.useThisTab();

      expect(useThisTab).toHaveBeenCalled();
      expect(navigateByUrl.calls.mostRecent().args[0]).toBe(TestBed.inject(Router).url);
    });
  });
});
