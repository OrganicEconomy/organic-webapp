import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionAmounts } from './transaction-amounts';
import type { Amounts } from '../../utils/transaction-display.util';

describe('TransactionAmounts', () => {
  let fixture: ComponentFixture<TransactionAmounts>;

  function showAmounts(amounts: Amounts): HTMLElement {
    fixture = TestBed.createComponent(TransactionAmounts);
    fixture.componentRef.setInput('amounts', amounts);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  describe('template', () => {
    it('should show money spent as a signed spending', () => {
      const shown = showAmounts({ money: -2, invests: 0, experience: 0, engagement: null });

      expect(shown.querySelector('.spending')?.textContent).toContain('−2');
    });

    it('should write a single invest in the singular', () => {
      const shown = showAmounts({ money: 0, invests: 1, experience: 0, engagement: null });

      expect(shown.querySelector('.gain')?.textContent?.trim()).toBe('+1 investissement');
    });

    it('should show an engagement as the invests it holds back per day, without any sign', () => {
      const shown = showAmounts({ money: 0, invests: 0, experience: 0, engagement: { investsPerDay: 2, days: 5 } });

      expect(shown.querySelector('.engagement')?.textContent?.trim()).toBe('2 investissements/jour pendant 5 jours');
    });

    it('should write a single invest held back for a single day in the singular', () => {
      const shown = showAmounts({ money: 0, invests: 0, experience: 0, engagement: { investsPerDay: 1, days: 1 } });

      expect(shown.querySelector('.engagement')?.textContent?.trim()).toBe('1 investissement/jour pendant 1 jour');
    });

    it('should show the money and invests of a creation as gains', () => {
      const shown = showAmounts({ money: 3, invests: 3, experience: 0, engagement: null });

      const gains = Array.from(shown.querySelectorAll('.gain')).map((gain) => gain.textContent?.trim());
      expect(gains).toEqual(['+3', '+3 investissements']);
    });

    it('should show the experience gained as a badge', () => {
      const shown = showAmounts({ money: -1, invests: 0, experience: 1, engagement: null });

      expect(shown.querySelector('.experience-badge')?.textContent?.trim()).toBe('+1 XP');
    });

    it('should show nothing for a transaction that moves no amount', () => {
      const shown = showAmounts({ money: 0, invests: 0, experience: 0, engagement: null });

      expect(shown.textContent?.trim()).toBe('');
    });
  });
});
