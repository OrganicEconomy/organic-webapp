import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionAmounts } from './transaction-amounts';
import type { Amounts, Engagement } from '../../utils/transaction-display.util';

describe('TransactionAmounts', () => {
  let fixture: ComponentFixture<TransactionAmounts>;

  const NO_AMOUNTS: Amounts = { money: 0, invests: 0, experience: 0 };

  function showAmounts(amounts: Amounts, engagement: Engagement | null = null): HTMLElement {
    fixture = TestBed.createComponent(TransactionAmounts);
    fixture.componentRef.setInput('amounts', amounts);
    fixture.componentRef.setInput('engagement', engagement);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  describe('template', () => {
    it('should show money spent as a signed spending', () => {
      const shown = showAmounts({ money: -2, invests: 0, experience: 0 });

      expect(shown.querySelector('.spending')?.textContent).toContain('−2');
    });

    it('should write a single invest in the singular', () => {
      const shown = showAmounts({ money: 0, invests: 1, experience: 0 });

      expect(shown.querySelector('.gain')?.textContent?.trim()).toBe('+1 investissement');
    });

    it('should show an engagement as the invests it holds back per day, without any sign', () => {
      const shown = showAmounts(NO_AMOUNTS, { invests: 10, days: 5, isSpreadEvenly: true });

      expect(shown.querySelector('.engagement')?.textContent?.trim()).toBe('2 investissements/jour pendant 5 jours');
    });

    it('should write a single invest held back for a single day in the singular', () => {
      const shown = showAmounts(NO_AMOUNTS, { invests: 1, days: 1, isSpreadEvenly: true });

      expect(shown.querySelector('.engagement')?.textContent?.trim()).toBe('1 investissement/jour pendant 1 jour');
    });

    it('should show an engagement spread unevenly over its days as its total, without a rounded daily count', () => {
      const shown = showAmounts(NO_AMOUNTS, { invests: 4, days: 2, isSpreadEvenly: false });

      expect(shown.querySelector('.engagement')?.textContent?.trim()).toBe('4 investissements sur 2 jours');
    });

    it('should show the money and invests of a creation as gains', () => {
      const shown = showAmounts({ money: 3, invests: 3, experience: 0 });

      const gains = Array.from(shown.querySelectorAll('.gain')).map((gain) => gain.textContent?.trim());
      expect(gains).toEqual(['+3', '+3 investissements']);
    });

    it('should show the experience gained as a badge', () => {
      const shown = showAmounts({ money: -1, invests: 0, experience: 1 });

      expect(shown.querySelector('.experience-badge')?.textContent?.trim()).toBe('+1 XP');
    });

    it('should show nothing for a transaction that moves no amount', () => {
      const shown = showAmounts(NO_AMOUNTS);

      expect(shown.textContent?.trim()).toBe('');
    });
  });
});
