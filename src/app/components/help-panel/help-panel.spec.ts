import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { HelpPanel } from './help-panel';

@Component({
  imports: [HelpPanel],
  template: `<app-help-panel><p>Each day, you receive as many units as your level.</p></app-help-panel>`,
})
class PageWithHelp {}

describe('HelpPanel', () => {
  let fixture: ComponentFixture<PageWithHelp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageWithHelp],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(PageWithHelp);
    fixture.detectChanges();
  });

  describe('template', () => {
    it('should offer to explain how the page works', () => {
      expect(fixture.nativeElement.textContent).toContain('Comment ça marche\u00a0?');
    });
  });
});
