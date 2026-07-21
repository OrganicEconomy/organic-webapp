import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let fixture: ComponentFixture<MainLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    fixture.detectChanges();
  });

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
});
